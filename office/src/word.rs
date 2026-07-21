//! Word (.docx) <-> `WordDoc` model, via `docx-rs`. Both directions use
//! in-memory buffers, so this runs unchanged on wasm.

use std::io::Cursor;

use docx_rs::*;

use crate::model::{Block, Run as MRun, WordDoc};

// Numbering instance ids we register once and reference from list paragraphs.
const NUM_BULLET: usize = 1;
const NUM_ORDERED: usize = 2;

/// Serialize a `WordDoc` model to .docx bytes.
pub fn export(doc: &WordDoc) -> Result<Vec<u8>, String> {
    let mut docx = Docx::new()
        // Register one bullet and one decimal numbering definition up front so
        // any List block can reference them.
        .add_abstract_numbering(
            AbstractNumbering::new(NUM_BULLET).add_level(Level::new(
                0,
                Start::new(1),
                NumberFormat::new("bullet"),
                LevelText::new("•"),
                LevelJc::new("left"),
            )),
        )
        .add_numbering(Numbering::new(NUM_BULLET, NUM_BULLET))
        .add_abstract_numbering(
            AbstractNumbering::new(NUM_ORDERED).add_level(Level::new(
                0,
                Start::new(1),
                NumberFormat::new("decimal"),
                LevelText::new("%1."),
                LevelJc::new("left"),
            )),
        )
        .add_numbering(Numbering::new(NUM_ORDERED, NUM_ORDERED));

    for block in &doc.blocks {
        match block {
            Block::Heading { level, text } => {
                let lvl = (*level).clamp(1, 6);
                let run = Run::new().add_text(text).bold().size(heading_size(lvl));
                let style_id = format!("Heading{lvl}");
                docx = docx.add_paragraph(Paragraph::new().style(&style_id).add_run(run));
            }
            Block::Paragraph { runs, align } => {
                let mut p = Paragraph::new();
                if let Some(a) = align {
                    if let Some(at) = alignment(a) {
                        p = p.align(at);
                    }
                }
                for r in runs {
                    p = p.add_run(build_run(r));
                }
                docx = docx.add_paragraph(p);
            }
            Block::List { ordered, items } => {
                let num_id = if *ordered { NUM_ORDERED } else { NUM_BULLET };
                for item in items {
                    docx = docx.add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(item))
                            .numbering(NumberingId::new(num_id), IndentLevel::new(0)),
                    );
                }
            }
            Block::Table { rows } => {
                if rows.is_empty() {
                    continue;
                }
                let table_rows: Vec<TableRow> = rows
                    .iter()
                    .map(|row| {
                        let cells: Vec<TableCell> = row
                            .iter()
                            .map(|cell| {
                                TableCell::new().add_paragraph(
                                    Paragraph::new().add_run(Run::new().add_text(cell)),
                                )
                            })
                            .collect();
                        TableRow::new(cells)
                    })
                    .collect();
                docx = docx.add_table(Table::new(table_rows));
            }
        }
    }

    let mut buf = Cursor::new(Vec::new());
    docx.build().pack(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf.into_inner())
}

/// Parse .docx bytes into a `WordDoc` model. Best-effort ("practical"): text,
/// character formatting, headings, list items and tables. Anything else is
/// flattened to paragraphs.
pub fn import(bytes: &[u8]) -> Result<WordDoc, String> {
    let docx = read_docx(bytes).map_err(|e| e.to_string())?;
    let mut blocks: Vec<Block> = Vec::new();
    // Consecutive numbered/bulleted paragraphs coalesce into one List block.
    let mut pending_list: Option<(bool, Vec<String>)> = None;

    macro_rules! flush_list {
        () => {
            if let Some((ordered, items)) = pending_list.take() {
                if !items.is_empty() {
                    blocks.push(Block::List { ordered, items });
                }
            }
        };
    }

    for child in &docx.document.children {
        match child {
            DocumentChild::Paragraph(p) => {
                let runs = collect_runs(p);
                let text: String = runs.iter().map(|r| r.text.clone()).collect();

                if let Some(level) = heading_level(p) {
                    flush_list!();
                    blocks.push(Block::Heading {
                        level,
                        text: text.trim().to_string(),
                    });
                } else if is_list_item(p) {
                    let ordered = false; // format not inspected — default bullet
                    match &mut pending_list {
                        Some((o, items)) if *o == ordered => items.push(text.trim().to_string()),
                        _ => {
                            flush_list!();
                            pending_list = Some((ordered, vec![text.trim().to_string()]));
                        }
                    }
                } else {
                    flush_list!();
                    // Skip fully-empty paragraphs so blank lines don't pile up.
                    if runs.iter().any(|r| !r.text.trim().is_empty()) {
                        blocks.push(Block::Paragraph { runs, align: None });
                    } else {
                        blocks.push(Block::Paragraph {
                            runs: vec![],
                            align: None,
                        });
                    }
                }
            }
            DocumentChild::Table(t) => {
                flush_list!();
                let rows = collect_table(t);
                if !rows.is_empty() {
                    blocks.push(Block::Table { rows });
                }
            }
            _ => {}
        }
    }
    flush_list!();

    Ok(WordDoc { blocks })
}

// ---------- write helpers ----------

fn build_run(r: &MRun) -> Run {
    let mut run = Run::new().add_text(&r.text);
    if r.bold {
        run = run.bold();
    }
    if r.italic {
        run = run.italic();
    }
    if r.underline {
        run = run.underline("single");
    }
    run
}

fn heading_size(level: u8) -> usize {
    match level {
        1 => 36,
        2 => 32,
        3 => 28,
        4 => 26,
        5 => 24,
        _ => 22,
    }
}

fn alignment(a: &str) -> Option<AlignmentType> {
    match a {
        "center" => Some(AlignmentType::Center),
        "right" => Some(AlignmentType::Right),
        "justify" => Some(AlignmentType::Both),
        "left" => Some(AlignmentType::Left),
        _ => None,
    }
}

// ---------- read helpers ----------

fn collect_runs(p: &Paragraph) -> Vec<MRun> {
    let mut out: Vec<MRun> = Vec::new();
    for child in &p.children {
        if let ParagraphChild::Run(run) = child {
            let mut text = String::new();
            for rc in &run.children {
                match rc {
                    RunChild::Text(t) => text.push_str(&t.text),
                    RunChild::Tab(_) => text.push('\t'),
                    _ => {}
                }
            }
            if text.is_empty() {
                continue;
            }
            let rp = &run.run_property;
            out.push(MRun {
                text,
                bold: rp.bold.is_some(),
                italic: rp.italic.is_some(),
                underline: rp.underline.is_some(),
            });
        }
    }
    out
}

fn heading_level(p: &Paragraph) -> Option<u8> {
    let style = p.property.style.as_ref()?;
    let id = &style.val;
    let lower = id.to_ascii_lowercase();
    if let Some(rest) = lower.strip_prefix("heading") {
        return rest.trim().parse::<u8>().ok().map(|n| n.clamp(1, 6));
    }
    None
}

fn is_list_item(p: &Paragraph) -> bool {
    p.property.numbering_property.is_some()
}

fn collect_table(t: &Table) -> Vec<Vec<String>> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    for row_child in &t.rows {
        let TableChild::TableRow(row) = row_child;
        let mut cells: Vec<String> = Vec::new();
        for cell_child in &row.cells {
            let TableRowChild::TableCell(cell) = cell_child;
            let mut cell_text = String::new();
            for content in &cell.children {
                if let TableCellContent::Paragraph(p) = content {
                    let runs = collect_runs(p);
                    if !cell_text.is_empty() {
                        cell_text.push('\n');
                    }
                    cell_text.push_str(&runs.iter().map(|r| r.text.clone()).collect::<String>());
                }
            }
            cells.push(cell_text.trim().to_string());
        }
        rows.push(cells);
    }
    rows
}

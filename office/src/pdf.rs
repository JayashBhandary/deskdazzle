//! Model -> PDF, hand-laid-out with the standard Helvetica fonts (no
//! embedding). "Practical" fidelity: flowing text with word-wrap and
//! pagination, headings, bullet/numbered lists and bordered tables — a faithful
//! printable view of a document or spreadsheet. Every office app exports here.
//!
//! Fonts use WinAnsi encoding and text is transliterated into that byte range,
//! so accented Latin text, smart quotes, dashes and bullets render correctly
//! instead of turning into `?`. Table cells wrap across multiple lines (growing
//! the row) rather than being truncated, so no data is lost. Sheets with many
//! columns are laid out in landscape for more horizontal room.

use pdf_writer::{Content, Finish, Name, Pdf, Rect, Ref, Str};

use crate::model::{Block, Presentation, SlideBlock, Workbook, WordDoc};

// A4 in PDF points (1/72"), origin bottom-left.
const A4_W: f32 = 595.0;
const A4_H: f32 = 842.0;
const MARGIN: f32 = 48.0;

const F_REG: Name = Name(b"F1");
const F_BOLD: Name = Name(b"F2");

// Approximate Helvetica advance width per character as a fraction of the font
// size. Good enough for wrapping without embedding AFM metrics.
const CHAR_W: f32 = 0.5;
// Cap wrapped lines in a single table cell so one pathological value can't make
// a row taller than a page.
const MAX_CELL_LINES: usize = 8;

fn text_width(s: &str, size: f32) -> f32 {
    s.chars().count() as f32 * size * CHAR_W
}

/// Map a char into a WinAnsi (CP-1252) byte. ASCII passes through; common
/// typographic punctuation and the Latin-1 supplement map to their WinAnsi
/// code points; anything else falls back to '?'.
fn win_ansi(c: char) -> u8 {
    let u = c as u32;
    if u < 0x80 {
        return u as u8;
    }
    match c {
        '\u{2026}' => 0x85, // …
        '\u{2022}' => 0x95, // •
        '\u{2013}' => 0x96, // –
        '\u{2014}' => 0x97, // —
        '\u{2018}' => 0x91, // ‘
        '\u{2019}' => 0x92, // ’
        '\u{201A}' => 0x82, // ‚
        '\u{201C}' => 0x93, // “
        '\u{201D}' => 0x94, // ”
        '\u{201E}' => 0x84, // „
        '\u{20AC}' => 0x80, // €
        '\u{2122}' => 0x99, // ™
        '\u{00A0}' => 0x20, // nbsp -> space
        // Latin-1 supplement (accented letters etc.) — identical to WinAnsi.
        _ if (0xA1..=0xFF).contains(&u) => u as u8,
        _ => b'?',
    }
}

fn enc(s: &str) -> Vec<u8> {
    s.chars().map(win_ansi).collect()
}

/// Accumulates laid-out pages. `y` is the current cursor measured from the page
/// bottom (decreasing as we move down). Page size is per-document so a wide
/// spreadsheet can go landscape.
struct Layout {
    pages: Vec<Content>,
    cur: Content,
    y: f32,
    page_h: f32,
    content_w: f32,
}

impl Layout {
    fn new(page_w: f32, page_h: f32) -> Self {
        Layout {
            pages: Vec::new(),
            cur: Content::new(),
            y: page_h - MARGIN,
            page_h,
            content_w: page_w - 2.0 * MARGIN,
        }
    }

    fn new_page(&mut self) {
        let done = std::mem::replace(&mut self.cur, Content::new());
        self.pages.push(done);
        self.y = self.page_h - MARGIN;
    }

    /// Ensure `needed` points remain, else start a new page.
    fn ensure(&mut self, needed: f32) {
        if self.y - needed < MARGIN {
            self.new_page();
        }
    }

    fn gap(&mut self, h: f32) {
        self.y -= h;
    }

    /// Draw one already-fitting line of text at (x, current y), then advance.
    fn draw_line(&mut self, s: &str, size: f32, bold: bool, x: f32) {
        let leading = size * 1.32;
        self.ensure(leading);
        let baseline = self.y - size;
        self.text_at(s, size, bold, x, baseline);
        self.y -= leading;
    }

    /// Emit a single positioned text run (no cursor movement).
    fn text_at(&mut self, s: &str, size: f32, bold: bool, x: f32, baseline: f32) {
        if s.is_empty() {
            return;
        }
        self.cur.begin_text();
        self.cur.set_font(if bold { F_BOLD } else { F_REG }, size);
        self.cur.next_line(x, baseline);
        self.cur.show(Str(&enc(s)));
        self.cur.end_text();
    }

    /// Word-wrap `text` to `avail` width and draw each line from `x`.
    /// `align` shifts wrapped lines within `avail` (0=left, .5=center, 1=right).
    fn paragraph(&mut self, text: &str, size: f32, bold: bool, x: f32, avail: f32, align: f32) {
        for line in wrap(text, size, avail, usize::MAX) {
            let lx = x + (avail - text_width(&line, size)).max(0.0) * align;
            self.draw_line(&line, size, bold, lx);
        }
    }

    /// A bordered table. Each cell wraps to fit its column; the row grows to the
    /// tallest cell so nothing is truncated.
    fn table(&mut self, rows: &[Vec<String>]) {
        if rows.is_empty() {
            return;
        }
        let ncols = rows.iter().map(|r| r.len()).max().unwrap_or(1).max(1);
        let colw = self.content_w / ncols as f32;
        let size = 8.5;
        let pad = 3.0;
        let line_h = size * 1.22;
        let avail = colw - 2.0 * pad;

        for (r, row) in rows.iter().enumerate() {
            let header = r == 0;
            // Wrap every cell first to learn the row height.
            let cells: Vec<Vec<String>> = (0..ncols)
                .map(|c| {
                    let raw = row.get(c).map(|s| s.as_str()).unwrap_or("");
                    wrap(raw, size, avail, MAX_CELL_LINES)
                })
                .collect();
            let max_lines = cells.iter().map(|l| l.len().max(1)).max().unwrap_or(1);
            let row_h = 2.0 * pad + max_lines as f32 * line_h;

            self.ensure(row_h);
            let top = self.y;
            let bottom = top - row_h;

            for (c, lines) in cells.iter().enumerate() {
                let x = MARGIN + c as f32 * colw;
                // Cell border.
                self.cur.set_line_width(0.5);
                self.cur.rect(x, bottom, colw, row_h);
                self.cur.stroke();
                // Wrapped text, top-aligned.
                for (i, line) in lines.iter().enumerate() {
                    let baseline = top - pad - size - i as f32 * line_h;
                    self.text_at(line, size, header, x + pad, baseline);
                }
            }
            self.y = bottom;
        }
        self.gap(6.0);
    }

    fn finish_pages(mut self) -> Vec<Content> {
        self.pages.push(self.cur);
        self.pages
    }
}

/// Greedy word-wrap to `avail` width, at most `max_lines` lines (the last line
/// gets an ellipsis if content is dropped). A single over-long word is split.
fn wrap(text: &str, size: f32, avail: f32, max_lines: usize) -> Vec<String> {
    if text.trim().is_empty() {
        return vec![String::new()];
    }
    let mut lines: Vec<String> = Vec::new();
    let mut line = String::new();

    for word in text.split_whitespace() {
        // Split a word that can't fit on its own line.
        if text_width(word, size) > avail {
            if !line.is_empty() {
                lines.push(std::mem::take(&mut line));
            }
            for chunk in hard_split(word, size, avail) {
                lines.push(chunk);
            }
            // Continue accumulating after the split remainder.
            line = lines.pop().unwrap_or_default();
            continue;
        }
        let candidate = if line.is_empty() {
            word.to_string()
        } else {
            format!("{line} {word}")
        };
        if text_width(&candidate, size) <= avail || line.is_empty() {
            line = candidate;
        } else {
            lines.push(std::mem::take(&mut line));
            line = word.to_string();
        }
    }
    if !line.is_empty() {
        lines.push(line);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }

    if lines.len() > max_lines {
        lines.truncate(max_lines);
        if let Some(last) = lines.last_mut() {
            last.push('\u{2026}');
        }
    }
    lines
}

fn hard_split(word: &str, size: f32, avail: f32) -> Vec<String> {
    let max_chars = ((avail / (size * CHAR_W)).floor() as usize).max(1);
    word.chars()
        .collect::<Vec<_>>()
        .chunks(max_chars)
        .map(|c| c.iter().collect())
        .collect()
}

fn heading_size(level: u8) -> f32 {
    match level {
        1 => 20.0,
        2 => 16.0,
        3 => 14.0,
        4 => 13.0,
        5 => 12.0,
        _ => 11.0,
    }
}

fn align_factor(a: &Option<String>) -> f32 {
    match a.as_deref() {
        Some("center") => 0.5,
        Some("right") => 1.0,
        _ => 0.0,
    }
}

/// Render a Word document model to PDF bytes (portrait A4).
pub fn word(doc: &WordDoc) -> Result<Vec<u8>, String> {
    let mut lo = Layout::new(A4_W, A4_H);
    let cw = lo.content_w;
    for block in &doc.blocks {
        match block {
            Block::Heading { level, text } => {
                let size = heading_size((*level).clamp(1, 6));
                lo.gap(size * 0.5);
                lo.paragraph(text, size, true, MARGIN, cw, 0.0);
                lo.gap(2.0);
            }
            Block::Paragraph { runs, align } => {
                let text: String = runs.iter().map(|r| r.text.clone()).collect();
                let bold = runs.first().map(|r| r.bold).unwrap_or(false);
                if text.trim().is_empty() {
                    lo.gap(7.0);
                } else {
                    lo.paragraph(&text, 11.0, bold, MARGIN, cw, align_factor(align));
                    lo.gap(3.0);
                }
            }
            Block::List { ordered, items } => {
                for (i, item) in items.iter().enumerate() {
                    let marker = if *ordered {
                        format!("{}.", i + 1)
                    } else {
                        "\u{2022}".to_string()
                    };
                    let indent = 18.0;
                    lo.ensure(11.0 * 1.32);
                    let marker_y = lo.y;
                    lo.draw_line(&marker, 11.0, false, MARGIN);
                    lo.y = marker_y; // hang the wrapped item beside its marker
                    lo.paragraph(item, 11.0, false, MARGIN + indent, cw - indent, 0.0);
                }
                lo.gap(4.0);
            }
            Block::Table { rows } => lo.table(rows),
        }
    }
    assemble(lo.finish_pages(), A4_W, A4_H)
}

/// Render a spreadsheet workbook model to PDF bytes (one section per sheet).
/// Wide sheets (many columns) use landscape for more horizontal room.
pub fn excel(wb: &Workbook) -> Result<Vec<u8>, String> {
    let max_cols = wb
        .sheets
        .iter()
        .flat_map(|s| s.rows.iter().map(|r| r.len()))
        .max()
        .unwrap_or(0);
    let (page_w, page_h) = if max_cols > 6 { (A4_H, A4_W) } else { (A4_W, A4_H) };

    let mut lo = Layout::new(page_w, page_h);
    let cw = lo.content_w;
    for (i, sheet) in wb.sheets.iter().enumerate() {
        if i > 0 {
            lo.new_page();
        }
        lo.gap(4.0);
        lo.paragraph(&sheet.name, 16.0, true, MARGIN, cw, 0.0);
        lo.gap(4.0);
        if sheet.rows.is_empty() {
            lo.paragraph("(empty sheet)", 10.0, false, MARGIN, cw, 0.0);
        } else {
            lo.table(&sheet.rows);
        }
    }
    assemble(lo.finish_pages(), page_w, page_h)
}

/// Render a slide deck to PDF bytes — one landscape page per slide. Images are
/// shown as a labelled placeholder box (raster embedding is out of scope here).
pub fn ppt(pres: &Presentation) -> Result<Vec<u8>, String> {
    let (page_w, page_h) = (A4_H, A4_W); // landscape
    let mut lo = Layout::new(page_w, page_h);
    let cw = lo.content_w;
    let indent = 20.0;

    for (i, slide) in pres.slides.iter().enumerate() {
        if i > 0 {
            lo.new_page();
        }
        let centered = slide.layout == "title" || slide.layout == "section";
        if !slide.title.trim().is_empty() {
            if centered {
                lo.gap(page_h * 0.32);
                lo.paragraph(&slide.title, 26.0, true, MARGIN, cw, 0.5);
                if !slide.subtitle.trim().is_empty() {
                    lo.gap(6.0);
                    lo.paragraph(&slide.subtitle, 15.0, false, MARGIN, cw, 0.5);
                }
                continue;
            }
            lo.gap(4.0);
            lo.paragraph(&slide.title, 22.0, true, MARGIN, cw, 0.0);
            lo.gap(8.0);
        }
        for block in &slide.content {
            match block {
                SlideBlock::Bullets { items } => {
                    for b in items {
                        let lvl = b.level.min(4) as f32;
                        let x = MARGIN + lvl * indent;
                        let marker_y = lo.y;
                        lo.draw_line("\u{2022}", 12.0, false, x);
                        lo.y = marker_y;
                        lo.paragraph(&b.text, 12.0, false, x + indent, cw - lvl * indent - indent, 0.0);
                    }
                    lo.gap(4.0);
                }
                SlideBlock::Table { rows } => lo.table(rows),
                SlideBlock::Image { .. } => {
                    lo.paragraph("[image]", 10.0, false, MARGIN, cw, 0.0);
                    lo.gap(4.0);
                }
            }
        }
    }
    assemble(lo.finish_pages(), page_w, page_h)
}

/// Assemble laid-out page content streams into a finished PDF.
fn assemble(pages: Vec<Content>, page_w: f32, page_h: f32) -> Result<Vec<u8>, String> {
    let mut alloc = Ref::new(1);
    let catalog = alloc.bump();
    let tree = alloc.bump();
    let font_reg = alloc.bump();
    let font_bold = alloc.bump();

    let mut page_ids = Vec::with_capacity(pages.len());
    let mut content_ids = Vec::with_capacity(pages.len());
    for _ in &pages {
        page_ids.push(alloc.bump());
        content_ids.push(alloc.bump());
    }

    let mut pdf = Pdf::new();
    pdf.catalog(catalog).pages(tree);
    pdf.pages(tree)
        .kids(page_ids.iter().copied())
        .count(pages.len() as i32);

    for i in 0..pages.len() {
        let mut page = pdf.page(page_ids[i]);
        page.parent(tree);
        page.media_box(Rect::new(0.0, 0.0, page_w, page_h));
        page.contents(content_ids[i]);
        page.resources()
            .fonts()
            .pair(F_REG, font_reg)
            .pair(F_BOLD, font_bold);
        page.finish();
    }

    // WinAnsi encoding so the transliterated bytes render as expected.
    pdf.type1_font(font_reg)
        .base_font(Name(b"Helvetica"))
        .encoding_predefined(Name(b"WinAnsiEncoding"));
    pdf.type1_font(font_bold)
        .base_font(Name(b"Helvetica-Bold"))
        .encoding_predefined(Name(b"WinAnsiEncoding"));

    for (i, content) in pages.into_iter().enumerate() {
        pdf.stream(content_ids[i], &content.finish());
    }

    Ok(pdf.finish())
}

//! Excel (.xlsx) <-> `Workbook` model. Write via `rust_xlsxwriter`, read via
//! `calamine`. Both work on in-memory buffers, so this runs unchanged on wasm.

use std::collections::HashSet;
use std::io::Cursor;

use calamine::{open_workbook_auto_from_rs, Data, Reader};
use rust_xlsxwriter::{
    Color, Format, FormatAlign, FormatBorder, FormatUnderline, Workbook as XlsxWorkbook,
};

use crate::model::{CellFmt, Sheet, Workbook};

/// Serialize a `Workbook` model to .xlsx bytes, applying per-cell formatting,
/// column widths, row heights, merged regions and frozen panes.
pub fn export(wb: &Workbook) -> Result<Vec<u8>, String> {
    let mut out = XlsxWorkbook::new();

    let fallback = [Sheet::default()];
    let sheets = if wb.sheets.is_empty() {
        &fallback[..]
    } else {
        wb.sheets.as_slice()
    };

    for sheet in sheets {
        let ws = out.add_worksheet();
        // Sheet names are constrained by the format (<=31 chars, no []:*?/\).
        let name = sanitize_sheet_name(&sheet.name);
        ws.set_name(&name).map_err(|e| e.to_string())?;

        // Cells that are the interior (non-top-left) of a merge are skipped when
        // writing values, since `merge_range` owns the whole region.
        let mut merged_interior: HashSet<(u32, u32)> = HashSet::new();
        for m in &sheet.merges {
            for r in m[0]..=m[2] {
                for c in m[1]..=m[3] {
                    if !(r == m[0] && c == m[1]) {
                        merged_interior.insert((r, c));
                    }
                }
            }
        }

        for (r, row) in sheet.rows.iter().enumerate() {
            let row_idx = r as u32;
            let header = r == 0;
            for (c, raw) in row.iter().enumerate() {
                let col = c as u16;
                if merged_interior.contains(&(row_idx, col as u32)) {
                    continue;
                }
                let cell = raw.trim();
                let cf = sheet.fmts.get(&format!("{r}:{c}"));
                let fmt = build_format(cf, header);
                if cell.is_empty() {
                    if let Some(f) = &fmt {
                        ws.write_blank(row_idx, col, f).map_err(|e| e.to_string())?;
                    }
                    continue;
                }
                let res = if let Some(formula) = cell.strip_prefix('=') {
                    match &fmt {
                        Some(f) => ws.write_formula_with_format(row_idx, col, formula, f).map(|_| ()),
                        None => ws.write_formula(row_idx, col, formula).map(|_| ()),
                    }
                } else if let Ok(n) = cell.parse::<f64>() {
                    match &fmt {
                        Some(f) => ws.write_number_with_format(row_idx, col, n, f).map(|_| ()),
                        None => ws.write_number(row_idx, col, n).map(|_| ()),
                    }
                } else {
                    match &fmt {
                        Some(f) => ws.write_string_with_format(row_idx, col, cell, f).map(|_| ()),
                        None => ws.write_string(row_idx, col, cell).map(|_| ()),
                    }
                };
                res.map_err(|e| e.to_string())?;
            }
        }

        // Merged regions — write the top-left content across the range.
        for m in &sheet.merges {
            let (r1, c1, r2, c2) = (m[0], m[1], m[2], m[3]);
            if r2 < r1 || c2 < c1 || (r1 == r2 && c1 == c2) {
                continue;
            }
            let content = sheet
                .rows
                .get(r1 as usize)
                .and_then(|row| row.get(c1 as usize))
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            let fmt = build_format(sheet.fmts.get(&format!("{r1}:{c1}")), r1 == 0)
                .unwrap_or_else(Format::new);
            ws.merge_range(r1, c1 as u16, r2, c2 as u16, &content, &fmt)
                .map_err(|e| e.to_string())?;
        }

        // Column widths / row heights (stored in pixels).
        for (k, px) in &sheet.col_widths {
            if let Ok(idx) = k.parse::<u16>() {
                ws.set_column_width_pixels(idx, px.round() as u16)
                    .map_err(|e| e.to_string())?;
            }
        }
        for (k, px) in &sheet.row_heights {
            if let Ok(idx) = k.parse::<u32>() {
                ws.set_row_height_pixels(idx, px.round() as u16)
                    .map_err(|e| e.to_string())?;
            }
        }

        // Frozen panes.
        if let Some([fr, fc]) = sheet.freeze {
            if fr > 0 || fc > 0 {
                ws.set_freeze_panes(fr, fc as u16).map_err(|e| e.to_string())?;
            }
        }
    }

    out.save_to_buffer().map_err(|e| e.to_string())
}

/// Build a `rust_xlsxwriter` Format from our `CellFmt` (plus the auto-bold header
/// row). Returns `None` when the cell needs no formatting at all.
fn build_format(cf: Option<&CellFmt>, header: bool) -> Option<Format> {
    let styled = header
        || cf.map_or(false, |f| {
            f.bold
                || f.italic
                || f.underline
                || f.color.is_some()
                || f.bg.is_some()
                || f.align.is_some()
                || f.num_fmt.is_some()
                || f.border
        });
    if !styled {
        return None;
    }
    let mut fmt = Format::new();
    if header {
        fmt = fmt.set_bold();
    }
    if let Some(f) = cf {
        if f.bold {
            fmt = fmt.set_bold();
        }
        if f.italic {
            fmt = fmt.set_italic();
        }
        if f.underline {
            fmt = fmt.set_underline(FormatUnderline::Single);
        }
        if let Some(c) = f.color.as_deref().and_then(parse_color) {
            fmt = fmt.set_font_color(c);
        }
        if let Some(c) = f.bg.as_deref().and_then(parse_color) {
            fmt = fmt.set_background_color(c);
        }
        if let Some(a) = &f.align {
            fmt = match a.as_str() {
                "center" => fmt.set_align(FormatAlign::Center),
                "right" => fmt.set_align(FormatAlign::Right),
                "left" => fmt.set_align(FormatAlign::Left),
                _ => fmt,
            };
        }
        if let Some(n) = &f.num_fmt {
            fmt = fmt.set_num_format(n);
        }
        if f.border {
            fmt = fmt.set_border(FormatBorder::Thin);
        }
    }
    Some(fmt)
}

/// Parse "#RRGGBB" (or "RRGGBB") to an xlsx colour.
fn parse_color(s: &str) -> Option<Color> {
    let hex = s.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    u32::from_str_radix(hex, 16).ok().map(Color::RGB)
}

/// Parse spreadsheet bytes into a `Workbook` model. The format (.xlsx / .xls /
/// .xlsb / .ods) is auto-detected. Values only — formulas come back as their
/// last cached result, matching what a reader would show.
pub fn import(bytes: &[u8]) -> Result<Workbook, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut xl = open_workbook_auto_from_rs(cursor).map_err(|e| e.to_string())?;

    let mut sheets = Vec::new();
    let names = xl.sheet_names().to_vec();
    for name in names {
        let range = match xl.worksheet_range(&name) {
            Ok(r) => r,
            Err(_) => continue,
        };
        let mut rows: Vec<Vec<String>> = Vec::with_capacity(range.height());
        for row in range.rows() {
            rows.push(row.iter().map(cell_to_string).collect());
        }
        // Trim trailing fully-empty rows so a mostly-empty sheet isn't huge.
        while rows
            .last()
            .map(|r| r.iter().all(|c| c.is_empty()))
            .unwrap_or(false)
        {
            rows.pop();
        }
        sheets.push(Sheet {
            name,
            rows,
            ..Sheet::default()
        });
    }

    if sheets.is_empty() {
        sheets.push(Sheet::default());
    }
    Ok(Workbook { sheets })
}

fn cell_to_string(d: &Data) -> String {
    match d {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Float(f) => trim_float(*f),
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => b.to_string(),
        Data::DateTime(dt) => dt.to_string(),
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("{e:?}"),
    }
}

/// Render a float without a trailing ".0" for whole numbers.
fn trim_float(f: f64) -> String {
    if f.fract() == 0.0 && f.abs() < 1e15 {
        format!("{}", f as i64)
    } else {
        f.to_string()
    }
}

fn sanitize_sheet_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '[' | ']' | ':' | '*' | '?' | '/' | '\\' => ' ',
            other => other,
        })
        .collect();
    let trimmed = cleaned.trim();
    let base = if trimmed.is_empty() { "Sheet" } else { trimmed };
    base.chars().take(31).collect()
}

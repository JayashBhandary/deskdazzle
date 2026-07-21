//! Excel (.xlsx) <-> `Workbook` model. Write via `rust_xlsxwriter`, read via
//! `calamine`. Both work on in-memory buffers, so this runs unchanged on wasm.

use std::io::Cursor;

use calamine::{open_workbook_auto_from_rs, Data, Reader};
use rust_xlsxwriter::{Format, Workbook as XlsxWorkbook};

use crate::model::{Sheet, Workbook};

/// Serialize a `Workbook` model to .xlsx bytes.
pub fn export(wb: &Workbook) -> Result<Vec<u8>, String> {
    let mut out = XlsxWorkbook::new();
    let bold = Format::new().set_bold();

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

        for (r, row) in sheet.rows.iter().enumerate() {
            let row_idx = r as u32;
            let header = r == 0;
            for (c, raw) in row.iter().enumerate() {
                let col = c as u16;
                let cell = raw.trim();
                if cell.is_empty() {
                    continue;
                }
                let res = if let Some(formula) = cell.strip_prefix('=') {
                    ws.write_formula(row_idx, col, formula)
                        .map(|_| ())
                } else if let Ok(n) = cell.parse::<f64>() {
                    ws.write_number(row_idx, col, n).map(|_| ())
                } else if header {
                    ws.write_string_with_format(row_idx, col, cell, &bold)
                        .map(|_| ())
                } else {
                    ws.write_string(row_idx, col, cell).map(|_| ())
                };
                res.map_err(|e| e.to_string())?;
            }
        }
    }

    out.save_to_buffer().map_err(|e| e.to_string())
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
        sheets.push(Sheet { name, rows });
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

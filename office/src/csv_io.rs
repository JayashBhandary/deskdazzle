//! CSV <-> a single sheet's grid (`Vec<Vec<String>>`). CSV is inherently a
//! single flat table, so these operate on one sheet's rows — the Excel app
//! imports a .csv as a one-sheet workbook and exports the active sheet as .csv.
//! Proper RFC-4180 quoting/escaping is handled by the `csv` crate.

use crate::model::Sheet;

/// Parse CSV text into a grid of raw cell strings.
pub fn import(text: &str) -> Result<Vec<Vec<String>>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false) // keep every line, including the first — the app
        .flexible(true) //      decides what the header row is
        .from_reader(text.as_bytes());

    let mut rows: Vec<Vec<String>> = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|e| e.to_string())?;
        rows.push(record.iter().map(|s| s.to_string()).collect());
    }
    Ok(rows)
}

/// Serialize a grid of cell strings to CSV text.
pub fn export(rows: &[Vec<String>]) -> Result<String, String> {
    let mut writer = csv::WriterBuilder::new()
        .flexible(true)
        .from_writer(Vec::new());
    for row in rows {
        writer.write_record(row).map_err(|e| e.to_string())?;
    }
    writer.flush().map_err(|e| e.to_string())?;
    let bytes = writer
        .into_inner()
        .map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

/// Convenience: CSV text -> a one-sheet `Sheet` model value.
pub fn import_sheet(text: &str, name: &str) -> Result<Sheet, String> {
    Ok(Sheet {
        name: name.to_string(),
        rows: import(text)?,
        ..Sheet::default()
    })
}

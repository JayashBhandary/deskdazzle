//! Desk Dazzle office core.
//!
//! Pure conversion logic (`model` + `word` + `excel`) turns a small native
//! JSON document model into real .docx/.xlsx bytes and back. The browser-facing
//! `#[wasm_bindgen]` layer in `bindings` is gated behind the `wasm` feature
//! (enabled by wasm-pack), so the same logic can be exercised natively in tests.

pub mod csv_io;
pub mod excel;
pub mod model;
pub mod pdf;
pub mod pdfops;
pub mod pptx;
pub mod word;

#[cfg(feature = "wasm")]
mod bindings;

pub use model::{Presentation, Workbook, WordDoc};

/// Model JSON -> .docx bytes.
pub fn word_export(model_json: &str) -> Result<Vec<u8>, String> {
    let doc: WordDoc = serde_json::from_str(model_json).map_err(|e| e.to_string())?;
    word::export(&doc)
}

/// .docx bytes -> model JSON.
pub fn word_import(bytes: &[u8]) -> Result<String, String> {
    let doc = word::import(bytes)?;
    serde_json::to_string(&doc).map_err(|e| e.to_string())
}

/// Model JSON -> .xlsx bytes.
pub fn excel_export(model_json: &str) -> Result<Vec<u8>, String> {
    let wb: Workbook = serde_json::from_str(model_json).map_err(|e| e.to_string())?;
    excel::export(&wb)
}

/// Spreadsheet bytes (.xlsx/.xls/.xlsb/.ods) -> model JSON.
pub fn excel_import(bytes: &[u8]) -> Result<String, String> {
    let wb = excel::import(bytes)?;
    serde_json::to_string(&wb).map_err(|e| e.to_string())
}

/// Presentation model JSON -> .pptx bytes.
pub fn ppt_export(model_json: &str) -> Result<Vec<u8>, String> {
    let pres: Presentation = serde_json::from_str(model_json).map_err(|e| e.to_string())?;
    pptx::export(&pres)
}

/// .pptx bytes -> presentation model JSON.
pub fn ppt_import(bytes: &[u8]) -> Result<String, String> {
    let pres = pptx::import(bytes)?;
    serde_json::to_string(&pres).map_err(|e| e.to_string())
}

/// Presentation model JSON -> .pdf bytes.
pub fn ppt_pdf(model_json: &str) -> Result<Vec<u8>, String> {
    let pres: Presentation = serde_json::from_str(model_json).map_err(|e| e.to_string())?;
    pdf::ppt(&pres)
}

/// Word model JSON -> .pdf bytes.
pub fn word_pdf(model_json: &str) -> Result<Vec<u8>, String> {
    let doc: WordDoc = serde_json::from_str(model_json).map_err(|e| e.to_string())?;
    pdf::word(&doc)
}

/// Workbook model JSON -> .pdf bytes.
pub fn excel_pdf(model_json: &str) -> Result<Vec<u8>, String> {
    let wb: Workbook = serde_json::from_str(model_json).map_err(|e| e.to_string())?;
    pdf::excel(&wb)
}

/// Number of pages in a PDF.
pub fn pdf_page_count(bytes: &[u8]) -> Result<u32, String> {
    pdfops::page_count(bytes)
}

/// Merge PDF `a` followed by PDF `b`.
pub fn pdf_merge(a: &[u8], b: &[u8]) -> Result<Vec<u8>, String> {
    pdfops::merge(a, b)
}

/// Reorder / delete / rotate / extract pages. `ops_json` is
/// `[{"page":<0-based>,"rotate":<deg>}]` in the desired output order.
pub fn pdf_organize(bytes: &[u8], ops_json: &str) -> Result<Vec<u8>, String> {
    pdfops::organize(bytes, ops_json)
}

/// CSV text -> grid JSON (`[[String]]`).
pub fn csv_import(text: &str) -> Result<String, String> {
    let rows = csv_io::import(text)?;
    serde_json::to_string(&rows).map_err(|e| e.to_string())
}

/// Grid JSON (`[[String]]`) -> CSV text.
pub fn csv_export(rows_json: &str) -> Result<String, String> {
    let rows: Vec<Vec<String>> = serde_json::from_str(rows_json).map_err(|e| e.to_string())?;
    csv_io::export(&rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_roundtrip() {
        let model = r#"{"blocks":[
            {"type":"heading","level":1,"text":"Hello"},
            {"type":"paragraph","runs":[{"text":"bold ","bold":true},{"text":"plain"}]},
            {"type":"list","ordered":false,"items":["a","b"]},
            {"type":"table","rows":[["h1","h2"],["r1","r2"]]}
        ]}"#;
        let bytes = word_export(model).expect("export");
        assert!(bytes.len() > 500, "docx too small: {}", bytes.len());
        // zip magic
        assert_eq!(&bytes[0..2], b"PK");
        let back = word_import(&bytes).expect("import");
        assert!(back.contains("Hello"), "missing heading: {back}");
        assert!(back.contains("bold"), "missing run: {back}");
        assert!(back.contains("h1"), "missing table cell: {back}");
    }

    #[test]
    fn ppt_roundtrip_and_pdf() {
        let model = r#"{"slides":[
            {"layout":"title","title":"My Deck","subtitle":"By me","notes":"hello notes"},
            {"layout":"titleContent","title":"Agenda","content":[
                {"type":"bullets","items":[{"text":"First","level":0},{"text":"Sub","level":1}]},
                {"type":"table","rows":[["A","B"],["1","2"]]}
            ]}
        ]}"#;
        let pptx = ppt_export(model).expect("pptx");
        assert_eq!(&pptx[0..2], b"PK", "not a zip");
        let back = ppt_import(&pptx).expect("import");
        assert!(back.contains("My Deck"), "title lost: {back}");
        assert!(back.contains("First"), "bullet lost: {back}");
        assert!(back.contains("hello notes"), "notes lost: {back}");
        let pdf = ppt_pdf(model).expect("ppt pdf");
        assert_eq!(&pdf[0..5], b"%PDF-");
    }

    #[test]
    fn pdf_edit_ops() {
        // Make a 1-page and a 2-page PDF from the composer, then merge + organize.
        let one = word_pdf(r#"{"blocks":[{"type":"heading","level":1,"text":"One"}]}"#).unwrap();
        let two = excel_pdf(r#"{"sheets":[{"name":"S1","rows":[["a"]]},{"name":"S2","rows":[["b"]]}]}"#).unwrap();
        assert_eq!(pdf_page_count(&one).unwrap(), 1);
        assert_eq!(pdf_page_count(&two).unwrap(), 2);

        let merged = pdf_merge(&one, &two).expect("merge");
        assert_eq!(pdf_page_count(&merged).unwrap(), 3, "merge page count");

        // Keep pages 2 and 0 (reorder + delete), rotate the first 90°.
        let organized = pdf_organize(&merged, r#"[{"page":2,"rotate":90},{"page":0}]"#).expect("organize");
        assert_eq!(pdf_page_count(&organized).unwrap(), 2, "organize page count");
    }

    #[test]
    fn pdf_export() {
        let word_model = r#"{"blocks":[
            {"type":"heading","level":1,"text":"Report"},
            {"type":"paragraph","runs":[{"text":"Some body text that is long enough to wrap across more than a single line so the word wrap logic actually runs during this test."}]},
            {"type":"list","ordered":true,"items":["first","second"]},
            {"type":"table","rows":[["A","B"],["1","2"]]}
        ]}"#;
        let pdf = word_pdf(word_model).expect("word pdf");
        assert_eq!(&pdf[0..5], b"%PDF-", "not a pdf");
        assert!(pdf.len() > 400);

        let xl_model = r#"{"sheets":[{"name":"S1","rows":[["h","i"],["1","2"]]}]}"#;
        let pdf2 = excel_pdf(xl_model).expect("excel pdf");
        assert_eq!(&pdf2[0..5], b"%PDF-");
    }

    #[test]
    fn csv_roundtrip() {
        let text = "a,b,c\n1,\"two, and a comma\",3\n";
        let grid_json = csv_import(text).expect("import");
        assert!(grid_json.contains("two, and a comma"), "quoted field lost: {grid_json}");
        let out = csv_export(&grid_json).expect("export");
        // Re-importing the exported CSV must yield the same grid.
        assert_eq!(csv_import(&out).unwrap(), grid_json);
    }

    #[test]
    fn excel_roundtrip() {
        let model = r#"{"sheets":[{"name":"Data","rows":[["Item","Qty"],["Apples","5"],["Total","=B2*2"]]}]}"#;
        let bytes = excel_export(model).expect("export");
        assert_eq!(&bytes[0..2], b"PK");
        let back = excel_import(&bytes).expect("import");
        assert!(back.contains("Apples"), "missing value: {back}");
        assert!(back.contains("Item"), "missing header: {back}");
    }
}

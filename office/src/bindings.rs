//! Browser-facing wasm-bindgen surface. Exports take/return the native model as
//! a JSON string and documents as byte arrays (`Uint8Array` on the JS side).
//! Errors surface as thrown JS exceptions via `Result<_, JsError>`.

use wasm_bindgen::prelude::*;

/// Model JSON -> .docx bytes.
#[wasm_bindgen]
pub fn word_export(model_json: &str) -> Result<Vec<u8>, JsError> {
    crate::word_export(model_json).map_err(|e| JsError::new(&e))
}

/// .docx bytes -> model JSON.
#[wasm_bindgen]
pub fn word_import(bytes: &[u8]) -> Result<String, JsError> {
    crate::word_import(bytes).map_err(|e| JsError::new(&e))
}

/// Model JSON -> .xlsx bytes.
#[wasm_bindgen]
pub fn excel_export(model_json: &str) -> Result<Vec<u8>, JsError> {
    crate::excel_export(model_json).map_err(|e| JsError::new(&e))
}

/// Spreadsheet bytes (.xlsx/.xls/.xlsb/.ods) -> model JSON.
#[wasm_bindgen]
pub fn excel_import(bytes: &[u8]) -> Result<String, JsError> {
    crate::excel_import(bytes).map_err(|e| JsError::new(&e))
}

/// Word model JSON -> .pdf bytes.
#[wasm_bindgen]
pub fn word_pdf(model_json: &str) -> Result<Vec<u8>, JsError> {
    crate::word_pdf(model_json).map_err(|e| JsError::new(&e))
}

/// Presentation model JSON -> .pptx bytes.
#[wasm_bindgen]
pub fn ppt_export(model_json: &str) -> Result<Vec<u8>, JsError> {
    crate::ppt_export(model_json).map_err(|e| JsError::new(&e))
}

/// .pptx bytes -> presentation model JSON.
#[wasm_bindgen]
pub fn ppt_import(bytes: &[u8]) -> Result<String, JsError> {
    crate::ppt_import(bytes).map_err(|e| JsError::new(&e))
}

/// Presentation model JSON -> .pdf bytes.
#[wasm_bindgen]
pub fn ppt_pdf(model_json: &str) -> Result<Vec<u8>, JsError> {
    crate::ppt_pdf(model_json).map_err(|e| JsError::new(&e))
}

/// Workbook model JSON -> .pdf bytes.
#[wasm_bindgen]
pub fn excel_pdf(model_json: &str) -> Result<Vec<u8>, JsError> {
    crate::excel_pdf(model_json).map_err(|e| JsError::new(&e))
}

/// Number of pages in a PDF.
#[wasm_bindgen]
pub fn pdf_page_count(bytes: &[u8]) -> Result<u32, JsError> {
    crate::pdf_page_count(bytes).map_err(|e| JsError::new(&e))
}

/// Merge PDF `a` followed by PDF `b`.
#[wasm_bindgen]
pub fn pdf_merge(a: &[u8], b: &[u8]) -> Result<Vec<u8>, JsError> {
    crate::pdf_merge(a, b).map_err(|e| JsError::new(&e))
}

/// Reorder / delete / rotate / extract PDF pages.
#[wasm_bindgen]
pub fn pdf_organize(bytes: &[u8], ops_json: &str) -> Result<Vec<u8>, JsError> {
    crate::pdf_organize(bytes, ops_json).map_err(|e| JsError::new(&e))
}

/// Named blobs (concatenated) -> .zip bytes.
#[wasm_bindgen]
pub fn zip_files(manifest_json: &str, data: &[u8]) -> Result<Vec<u8>, JsError> {
    crate::zip_files(manifest_json, data).map_err(|e| JsError::new(&e))
}

/// JPEG images (concatenated) -> .pdf bytes (one image per page).
#[wasm_bindgen]
pub fn images_to_pdf(manifest_json: &str, data: &[u8]) -> Result<Vec<u8>, JsError> {
    crate::images_to_pdf(manifest_json, data).map_err(|e| JsError::new(&e))
}

/// .zip bytes -> length-prefixed manifest + concatenated file bytes.
#[wasm_bindgen]
pub fn unzip(bytes: &[u8]) -> Result<Vec<u8>, JsError> {
    crate::unzip(bytes).map_err(|e| JsError::new(&e))
}

/// CSV text -> grid JSON.
#[wasm_bindgen]
pub fn csv_import(text: &str) -> Result<String, JsError> {
    crate::csv_import(text).map_err(|e| JsError::new(&e))
}

/// Grid JSON -> CSV text.
#[wasm_bindgen]
pub fn csv_export(rows_json: &str) -> Result<String, JsError> {
    crate::csv_export(rows_json).map_err(|e| JsError::new(&e))
}

/// Crate version, for a quick "wasm alive" check from the UI.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

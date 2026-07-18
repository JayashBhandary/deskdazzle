//! PocketKnife core.
//!
//! Pure logic modules (tasks, scheduling, search, conversions) compile for any
//! target — including `wasm32-wasip1` for a future headless/CLI build. The
//! browser-facing `#[wasm_bindgen]` layer lives in `bindings` and is gated
//! behind the `wasm` feature (enabled by wasm-pack), so the WASI compile-check
//! exercises the same logic without pulling in wasm-bindgen.

pub mod convert;
pub mod dates;
pub mod model;
pub mod nlp;
pub mod search;
pub mod views;

#[cfg(feature = "wasm")]
mod bindings;

/// Text/data conversion dispatch, shared by the wasm bindings and any native
/// caller. `kind` selects the conversion; returns the converted string.
pub fn convert_text(kind: &str, input: &str) -> Result<String, String> {
    match kind {
        "md2html" => Ok(convert::md_to_html(input)),
        "csv2json" => convert::csv_to_json(input),
        "json2yaml" => convert::json_to_yaml(input),
        "yaml2json" => convert::yaml_to_json(input),
        "base64enc" => Ok(convert::base64_encode(input)),
        "base64dec" => convert::base64_decode(input),
        "urlenc" => Ok(convert::url_encode(input)),
        "urldec" => convert::url_decode(input),
        other => Err(format!("unknown conversion kind: {other}")),
    }
}

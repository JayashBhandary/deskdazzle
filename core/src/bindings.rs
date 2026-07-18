//! Browser-facing wasm-bindgen API. Thin JSON-in / JSON-out wrappers over the
//! pure logic modules — keeps the TS boundary simple and strongly typeable.

use wasm_bindgen::prelude::*;

use crate::model::Task;
use crate::search::SearchDoc;

fn err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

/// Parse a natural-language quick-add string. Returns JSON `ParseResult`.
#[wasm_bindgen]
pub fn quick_parse(input: &str, now_ms: f64) -> Result<String, JsValue> {
    let r = crate::nlp::parse(input, now_ms as i64);
    serde_json::to_string(&r).map_err(err)
}

/// Bucket tasks into Today / Upcoming / Someday / Overdue. Returns JSON `SmartViews`.
#[wasm_bindgen]
pub fn smart_views(tasks_json: &str, now_ms: f64) -> Result<String, JsValue> {
    let tasks: Vec<Task> = serde_json::from_str(tasks_json).map_err(err)?;
    let v = crate::views::smart_views(tasks, now_ms as i64);
    serde_json::to_string(&v).map_err(err)
}

/// Sort tasks by urgency. Returns JSON `Task[]`.
#[wasm_bindgen]
pub fn sort_tasks(tasks_json: &str) -> Result<String, JsValue> {
    let tasks: Vec<Task> = serde_json::from_str(tasks_json).map_err(err)?;
    let sorted = crate::views::sort_tasks(tasks);
    serde_json::to_string(&sorted).map_err(err)
}

/// Given a completed recurring task, return the next occurrence as JSON `Task`,
/// or the JSON literal `null` when the task does not recur.
#[wasm_bindgen]
pub fn next_occurrence(task_json: &str) -> Result<String, JsValue> {
    let task: Task = serde_json::from_str(task_json).map_err(err)?;
    let next = crate::views::next_occurrence(&task);
    serde_json::to_string(&next).map_err(err)
}

/// Full-text search across tasks + notes. Returns JSON `SearchHit[]`.
#[wasm_bindgen]
pub fn search(query: &str, docs_json: &str) -> Result<String, JsValue> {
    let docs: Vec<SearchDoc> = serde_json::from_str(docs_json).map_err(err)?;
    let hits = crate::search::search(query, &docs);
    serde_json::to_string(&hits).map_err(err)
}

/// Run a text/data conversion. See `crate::convert_text` for `kind` values.
#[wasm_bindgen]
pub fn convert_text(kind: &str, input: &str) -> Result<String, JsValue> {
    crate::convert_text(kind, input).map_err(err)
}

/// Semver of the core, surfaced in the UI/about.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

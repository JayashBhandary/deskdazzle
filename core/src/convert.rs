//! Client-side text/data conversions. All pure — no I/O, no network.
//! (Image conversion is done in JS via Canvas; see the TS converter module.)

use base64::{engine::general_purpose::STANDARD, Engine};
use pulldown_cmark::{html, Options, Parser};
use serde_json::Value;

pub fn md_to_html(md: &str) -> String {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    opts.insert(Options::ENABLE_FOOTNOTES);
    let parser = Parser::new_ext(md, opts);
    let mut out = String::new();
    html::push_html(&mut out, parser);
    out
}

/// CSV -> JSON array of objects using the first row as headers.
/// Handles quoted fields, embedded commas/newlines, and `""` escapes.
pub fn csv_to_json(csv: &str) -> Result<String, String> {
    let rows = parse_csv(csv);
    if rows.is_empty() {
        return Ok("[]".to_string());
    }
    let headers = &rows[0];
    let mut out: Vec<Value> = Vec::new();
    for row in &rows[1..] {
        let mut obj = serde_json::Map::new();
        for (i, h) in headers.iter().enumerate() {
            let cell = row.get(i).cloned().unwrap_or_default();
            obj.insert(h.clone(), infer_value(&cell));
        }
        out.push(Value::Object(obj));
    }
    serde_json::to_string_pretty(&out).map_err(|e| e.to_string())
}

fn infer_value(s: &str) -> Value {
    let t = s.trim();
    if t.is_empty() {
        return Value::Null;
    }
    if let Ok(i) = t.parse::<i64>() {
        return Value::from(i);
    }
    if let Ok(f) = t.parse::<f64>() {
        if f.is_finite() {
            return Value::from(f);
        }
    }
    match t {
        "true" => return Value::Bool(true),
        "false" => return Value::Bool(false),
        _ => {}
    }
    Value::String(s.to_string())
}

fn parse_csv(input: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut field = String::new();
    let mut row: Vec<String> = Vec::new();
    let mut in_quotes = false;
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    field.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                field.push(c);
            }
        } else {
            match c {
                '"' => in_quotes = true,
                ',' => {
                    row.push(std::mem::take(&mut field));
                }
                '\n' => {
                    row.push(std::mem::take(&mut field));
                    rows.push(std::mem::take(&mut row));
                }
                '\r' => {}
                _ => field.push(c),
            }
        }
    }
    // Flush trailing field/row if the input didn't end on a newline.
    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }
    rows
}

pub fn json_to_yaml(json: &str) -> Result<String, String> {
    let v: Value = serde_json::from_str(json).map_err(|e| format!("invalid JSON: {e}"))?;
    serde_yaml::to_string(&v).map_err(|e| e.to_string())
}

pub fn yaml_to_json(yaml: &str) -> Result<String, String> {
    let v: serde_yaml::Value =
        serde_yaml::from_str(yaml).map_err(|e| format!("invalid YAML: {e}"))?;
    serde_json::to_string_pretty(&v).map_err(|e| e.to_string())
}

pub fn base64_encode(text: &str) -> String {
    STANDARD.encode(text.as_bytes())
}

pub fn base64_decode(text: &str) -> Result<String, String> {
    let bytes = STANDARD
        .decode(text.trim())
        .map_err(|e| format!("invalid base64: {e}"))?;
    String::from_utf8(bytes).map_err(|e| format!("decoded bytes are not UTF-8: {e}"))
}

pub fn url_encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for &b in text.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

pub fn url_decode(text: &str) -> Result<String, String> {
    let bytes = text.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' => {
                if i + 2 >= bytes.len() {
                    return Err("truncated percent-escape".into());
                }
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
                let v = u8::from_str_radix(hex, 16).map_err(|_| "invalid percent-escape")?;
                out.push(v);
                i += 3;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8(out).map_err(|e| format!("decoded bytes are not UTF-8: {e}"))
}

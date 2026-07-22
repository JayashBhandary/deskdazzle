//! Native document models. These are the single source of truth the React UI
//! edits; the `word`/`excel` modules convert between these and real
//! .docx/.xlsx bytes. Kept intentionally small ("practical" fidelity): the
//! common structures every editor and reader agree on.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ---------------- Word ----------------

/// A word-processor document: an ordered list of block-level elements.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WordDoc {
    #[serde(default)]
    pub blocks: Vec<Block>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Block {
    /// A heading, `level` 1..=6.
    Heading {
        #[serde(default = "one")]
        level: u8,
        #[serde(default)]
        text: String,
    },
    /// A normal paragraph made of styled text runs.
    Paragraph {
        #[serde(default)]
        runs: Vec<Run>,
        /// "left" | "center" | "right" | "justify" (default left).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        align: Option<String>,
    },
    /// A bullet or numbered list.
    List {
        #[serde(default)]
        ordered: bool,
        #[serde(default)]
        items: Vec<String>,
    },
    /// A simple grid table (first row treated as the header).
    Table {
        #[serde(default)]
        rows: Vec<Vec<String>>,
    },
}

/// An inline run of text with character formatting.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Run {
    #[serde(default)]
    pub text: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub bold: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub italic: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub underline: bool,
}

fn one() -> u8 {
    1
}
fn is_false(b: &bool) -> bool {
    !*b
}

// ---------------- Excel ----------------

/// A spreadsheet workbook: one or more named sheets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workbook {
    #[serde(default)]
    pub sheets: Vec<Sheet>,
}

impl Default for Workbook {
    fn default() -> Self {
        Workbook {
            sheets: vec![Sheet::default()],
        }
    }
}

/// A single sheet as a dense row-major grid of raw cell strings. A value that
/// parses as a number is written as a number; one starting with `=` is written
/// as a formula; everything else is text. This keeps the model trivially
/// editable in a plain `<input>` grid while still producing a real .xlsx.
///
/// Presentation (fonts, colours, number formats, column widths, merges, frozen
/// panes) rides alongside the values in optional maps keyed by `"row:col"` (or a
/// bare index), so the grid stays a plain string matrix while still round-
/// tripping rich .xlsx formatting.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sheet {
    #[serde(default = "default_sheet_name")]
    pub name: String,
    #[serde(default)]
    pub rows: Vec<Vec<String>>,
    /// Per-cell formatting, keyed `"row:col"`.
    #[serde(default)]
    pub fmts: HashMap<String, CellFmt>,
    /// Column widths in pixels, keyed by column index.
    #[serde(default)]
    pub col_widths: HashMap<String, f64>,
    /// Row heights in pixels, keyed by row index.
    #[serde(default)]
    pub row_heights: HashMap<String, f64>,
    /// Merged regions as `[r1, c1, r2, c2]`.
    #[serde(default)]
    pub merges: Vec<[u32; 4]>,
    /// Frozen panes as `[rows, cols]` (top rows / left cols kept in view).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub freeze: Option<[u32; 2]>,
}

impl Default for Sheet {
    fn default() -> Self {
        Sheet {
            name: default_sheet_name(),
            rows: Vec::new(),
            fmts: HashMap::new(),
            col_widths: HashMap::new(),
            row_heights: HashMap::new(),
            merges: Vec::new(),
            freeze: None,
        }
    }
}

/// Character + cell formatting for one cell. Every field is optional so a lightly
/// styled sheet stays small in JSON.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellFmt {
    #[serde(default, skip_serializing_if = "is_false")]
    pub bold: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub italic: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub underline: bool,
    /// Font colour as "#RRGGBB".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Fill/background colour as "#RRGGBB".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bg: Option<String>,
    /// "left" | "center" | "right".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub align: Option<String>,
    /// Excel number-format code, e.g. "0.00", "$#,##0.00", "0%", "yyyy-mm-dd".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub num_fmt: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub border: bool,
}

fn default_sheet_name() -> String {
    "Sheet1".to_string()
}

// ---------------- PowerPoint ----------------

/// A slide deck: an ordered list of slides.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Presentation {
    #[serde(default)]
    pub slides: Vec<Slide>,
}

/// One slide. `layout` picks the arrangement; the content region is a stack of
/// blocks (bullets / image / table) so a slide can mix them cleanly.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Slide {
    /// "title" | "titleContent" | "section" | "blank"
    #[serde(default = "default_layout")]
    pub layout: String,
    #[serde(default)]
    pub title: String,
    /// Subtitle / section text (used by the title & section layouts).
    #[serde(default)]
    pub subtitle: String,
    #[serde(default)]
    pub content: Vec<SlideBlock>,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SlideBlock {
    /// A (possibly multi-level) bullet list.
    Bullets {
        #[serde(default)]
        items: Vec<Bullet>,
    },
    /// An embedded raster image (base64 payload, no data: prefix).
    Image {
        #[serde(default)]
        data: String,
        /// "image/png" | "image/jpeg"
        #[serde(default)]
        mime: String,
    },
    /// A simple grid table (first row treated as the header).
    Table {
        #[serde(default)]
        rows: Vec<Vec<String>>,
    },
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Bullet {
    #[serde(default)]
    pub text: String,
    /// Indent level 0..=4.
    #[serde(default)]
    pub level: u8,
}

fn default_layout() -> String {
    "titleContent".to_string()
}

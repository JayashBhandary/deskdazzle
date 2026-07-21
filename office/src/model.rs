//! Native document models. These are the single source of truth the React UI
//! edits; the `word`/`excel` modules convert between these and real
//! .docx/.xlsx bytes. Kept intentionally small ("practical" fidelity): the
//! common structures every editor and reader agree on.

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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sheet {
    #[serde(default = "default_sheet_name")]
    pub name: String,
    #[serde(default)]
    pub rows: Vec<Vec<String>>,
}

impl Default for Sheet {
    fn default() -> Self {
        Sheet {
            name: default_sheet_name(),
            rows: Vec::new(),
        }
    }
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

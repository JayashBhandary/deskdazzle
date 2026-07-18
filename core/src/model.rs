//! Serde-serializable domain types shared across the core.
//! `camelCase` on the wire so JSON maps 1:1 onto the TS interfaces.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    None,
    Low,
    Medium,
    High,
}

impl Priority {
    /// Higher = more urgent. Used by the sorter.
    pub fn weight(self) -> i32 {
        match self {
            Priority::High => 3,
            Priority::Medium => 2,
            Priority::Low => 1,
            Priority::None => 0,
        }
    }
}

impl Default for Priority {
    fn default() -> Self {
        Priority::None
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Freq {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recurrence {
    pub freq: Freq,
    /// e.g. interval 2 + weekly = every 2 weeks.
    #[serde(default = "one")]
    pub interval: u32,
}

fn one() -> u32 {
    1
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub done: bool,
    #[serde(default)]
    pub priority: Priority,
    /// Due date as epoch milliseconds (UTC).
    #[serde(default)]
    pub due: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
    /// Set when this task is a subtask of another.
    #[serde(default)]
    pub parent_id: Option<String>,
    /// Manual sort key within a project/column.
    #[serde(default)]
    pub order: f64,
    #[serde(default)]
    pub created_ms: i64,
    #[serde(default)]
    pub completed_ms: Option<i64>,
    #[serde(default)]
    pub recurrence: Option<Recurrence>,
}

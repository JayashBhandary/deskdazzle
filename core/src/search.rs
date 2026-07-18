//! Full-text search / filter across heterogeneous docs (tasks + notes).
//! Term-based scoring with field weighting; supports `#tag` filter terms.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchDoc {
    pub id: String,
    /// "task" | "note" — passed through to the hit so the UI can route.
    pub kind: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub id: String,
    pub kind: String,
    pub score: i32,
    /// Short excerpt around the first body match, for result previews.
    pub snippet: String,
}

fn snippet(body: &str, term: &str) -> String {
    let lb = body.to_lowercase();
    if let Some(pos) = lb.find(term) {
        let start = pos.saturating_sub(30);
        let end = (pos + term.len() + 60).min(body.len());
        // Snap to char boundaries.
        let start = (start..=pos).rev().find(|&i| body.is_char_boundary(i)).unwrap_or(0);
        let end = (end..=body.len()).find(|&i| body.is_char_boundary(i)).unwrap_or(body.len());
        let mut s = String::new();
        if start > 0 {
            s.push('…');
        }
        s.push_str(body[start..end].trim());
        if end < body.len() {
            s.push('…');
        }
        s
    } else {
        body.chars().take(80).collect()
    }
}

pub fn search(query: &str, docs: &[SearchDoc]) -> Vec<SearchHit> {
    let terms: Vec<String> = query.split_whitespace().map(|t| t.to_lowercase()).collect();
    if terms.is_empty() {
        return Vec::new();
    }

    let mut hits: Vec<SearchHit> = Vec::new();
    for doc in docs {
        let title = doc.title.to_lowercase();
        let body = doc.body.to_lowercase();
        let mut score = 0i32;
        let mut all_terms_hit = true;
        let mut snip_term: Option<String> = None;

        for term in &terms {
            // #tag filter term
            if let Some(tag) = term.strip_prefix('#') {
                if doc.tags.iter().any(|t| t == tag) {
                    score += 8;
                } else {
                    all_terms_hit = false;
                }
                continue;
            }

            let mut term_hit = false;
            if title == *term {
                score += 20;
                term_hit = true;
            } else if title.contains(term) {
                score += 10;
                term_hit = true;
            }
            if doc.tags.iter().any(|t| t.contains(term)) {
                score += 6;
                term_hit = true;
            }
            if body.contains(term) {
                score += 3;
                term_hit = true;
                snip_term.get_or_insert_with(|| term.clone());
            }
            if !term_hit {
                all_terms_hit = false;
            }
        }

        if score > 0 && all_terms_hit {
            let snippet = match &snip_term {
                Some(t) => snippet(&doc.body, t),
                None => doc.body.chars().take(80).collect(),
            };
            hits.push(SearchHit {
                id: doc.id.clone(),
                kind: doc.kind.clone(),
                score,
                snippet,
            });
        }
    }

    hits.sort_by(|a, b| b.score.cmp(&a.score));
    hits
}

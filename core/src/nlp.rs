//! Natural-language quick-add parser.
//! e.g. `pay rent friday !high #finance every 2 weeks`
//!   -> title="pay rent", due=<coming friday 09:00>, priority=high,
//!      tags=["finance"], recurrence=every 2 weeks.

use crate::dates::{date_at_9am_ms, next_weekday};
use crate::model::{Freq, Priority, Recurrence};
use chrono::{Datelike, Duration, Weekday};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseResult {
    pub title: String,
    pub priority: Priority,
    pub tags: Vec<String>,
    pub due: Option<i64>,
    pub recurrence: Option<Recurrence>,
}

fn weekday(word: &str) -> Option<Weekday> {
    Some(match word {
        "monday" | "mon" => Weekday::Mon,
        "tuesday" | "tue" | "tues" => Weekday::Tue,
        "wednesday" | "wed" => Weekday::Wed,
        "thursday" | "thu" | "thur" | "thurs" => Weekday::Thu,
        "friday" | "fri" => Weekday::Fri,
        "saturday" | "sat" => Weekday::Sat,
        "sunday" | "sun" => Weekday::Sun,
        _ => return None,
    })
}

fn freq(word: &str) -> Option<Freq> {
    Some(match word {
        "day" | "days" | "daily" => Freq::Daily,
        "week" | "weeks" | "weekly" => Freq::Weekly,
        "month" | "months" | "monthly" => Freq::Monthly,
        "year" | "years" | "yearly" | "annually" => Freq::Yearly,
        _ => return None,
    })
}

pub fn parse(input: &str, now_ms: i64) -> ParseResult {
    let mut priority = Priority::None;
    let mut tags: Vec<String> = Vec::new();
    let mut due: Option<i64> = None;
    let mut recurrence: Option<Recurrence> = None;
    let mut title_words: Vec<String> = Vec::new();

    let today = crate::dates::from_ms(now_ms).date();
    let tokens: Vec<String> = input.split_whitespace().map(|s| s.to_string()).collect();
    let mut i = 0;

    while i < tokens.len() {
        let tok = &tokens[i];
        let low = tok.to_lowercase();

        // #tag
        if let Some(rest) = tok.strip_prefix('#') {
            if !rest.is_empty() {
                tags.push(rest.to_lowercase());
            }
            i += 1;
            continue;
        }

        // !priority
        if let Some(rest) = low.strip_prefix('!') {
            match rest {
                "high" | "h" | "1" | "urgent" => priority = Priority::High,
                "med" | "medium" | "m" | "2" => priority = Priority::Medium,
                "low" | "l" | "3" => priority = Priority::Low,
                _ => title_words.push(tok.clone()),
            }
            i += 1;
            continue;
        }

        // relative single-word dates
        match low.as_str() {
            "today" | "tod" => {
                due = Some(date_at_9am_ms(today));
                i += 1;
                continue;
            }
            "tomorrow" | "tmr" | "tom" => {
                due = Some(date_at_9am_ms(today + Duration::days(1)));
                i += 1;
                continue;
            }
            _ => {}
        }

        // "next <weekday>"
        if low == "next" {
            if let Some(next_tok) = tokens.get(i + 1) {
                if let Some(wd) = weekday(&next_tok.to_lowercase()) {
                    due = Some(date_at_9am_ms(next_weekday(now_ms, wd, true)));
                    i += 2;
                    continue;
                }
                if let Some(f) = freq(&next_tok.to_lowercase()) {
                    // "next week/month" -> shorthand due date
                    let d = match f {
                        Freq::Daily => today + Duration::days(1),
                        Freq::Weekly => today + Duration::days(7),
                        Freq::Monthly => crate::dates::add_months(today, 1),
                        Freq::Yearly => today.with_year(today.year() + 1).unwrap_or(today),
                    };
                    due = Some(date_at_9am_ms(d));
                    i += 2;
                    continue;
                }
            }
        }

        // bare weekday
        if let Some(wd) = weekday(&low) {
            due = Some(date_at_9am_ms(next_weekday(now_ms, wd, false)));
            i += 1;
            continue;
        }

        // "in N day(s)/week(s)/month(s)"
        if low == "in" {
            if let (Some(nstr), Some(unit)) = (tokens.get(i + 1), tokens.get(i + 2)) {
                if let (Ok(n), Some(f)) = (nstr.parse::<i64>(), freq(&unit.to_lowercase())) {
                    let d = match f {
                        Freq::Daily => today + Duration::days(n),
                        Freq::Weekly => today + Duration::days(n * 7),
                        Freq::Monthly => crate::dates::add_months(today, n),
                        Freq::Yearly => crate::dates::add_months(today, n * 12),
                    };
                    due = Some(date_at_9am_ms(d));
                    i += 3;
                    continue;
                }
            }
        }

        // recurrence: "every [N] <unit>" or bare "daily/weekly/monthly/yearly"
        if low == "every" {
            // every N unit
            if let (Some(nstr), Some(unit)) = (tokens.get(i + 1), tokens.get(i + 2)) {
                if let (Ok(n), Some(f)) = (nstr.parse::<u32>(), freq(&unit.to_lowercase())) {
                    recurrence = Some(Recurrence { freq: f, interval: n.max(1) });
                    i += 3;
                    continue;
                }
            }
            // every unit
            if let Some(unit) = tokens.get(i + 1) {
                if let Some(f) = freq(&unit.to_lowercase()) {
                    recurrence = Some(Recurrence { freq: f, interval: 1 });
                    i += 2;
                    continue;
                }
            }
        }
        if matches!(low.as_str(), "daily" | "weekly" | "monthly" | "yearly") {
            if let Some(f) = freq(&low) {
                recurrence = Some(Recurrence { freq: f, interval: 1 });
                i += 1;
                continue;
            }
        }

        title_words.push(tok.clone());
        i += 1;
    }

    ParseResult {
        title: title_words.join(" ").trim().to_string(),
        priority,
        tags,
        due,
        recurrence,
    }
}

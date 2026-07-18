//! Calendar helpers built on chrono's `NaiveDateTime` (no clock / no tz —
//! the caller supplies "now" as epoch millis, everything is treated as UTC).

use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveDateTime, Weekday};

pub fn from_ms(ms: i64) -> NaiveDateTime {
    DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.naive_utc())
        .unwrap_or_default()
}

pub fn to_ms(dt: NaiveDateTime) -> i64 {
    dt.and_utc().timestamp_millis()
}

/// Midnight of the day containing `ms`.
pub fn start_of_day_ms(ms: i64) -> i64 {
    let dt = from_ms(ms);
    to_ms(dt.date().and_hms_opt(0, 0, 0).unwrap())
}

/// One millisecond before the next midnight.
pub fn end_of_day_ms(ms: i64) -> i64 {
    start_of_day_ms(ms) + 86_400_000 - 1
}

/// A calendar date at 09:00 as epoch millis — the default time for a parsed due date.
pub fn date_at_9am_ms(date: NaiveDate) -> i64 {
    to_ms(date.and_hms_opt(9, 0, 0).unwrap())
}

/// The coming occurrence of `wd`. If today is `wd` and `force_next` is false,
/// today is returned; otherwise the following week's.
pub fn next_weekday(now_ms: i64, wd: Weekday, force_next: bool) -> NaiveDate {
    let today = from_ms(now_ms).date();
    let mut delta = (wd.num_days_from_monday() as i64
        - today.weekday().num_days_from_monday() as i64)
        .rem_euclid(7);
    if delta == 0 && force_next {
        delta = 7;
    }
    today + Duration::days(delta)
}

/// Add one recurrence step, keeping month/day-of-month sane at boundaries.
pub fn add_months(date: NaiveDate, months: i64) -> NaiveDate {
    let total = (date.year() as i64) * 12 + (date.month0() as i64) + months;
    let year = total.div_euclid(12) as i32;
    let month0 = total.rem_euclid(12) as u32;
    let month = month0 + 1;
    // Clamp the day to the last valid day of the target month.
    let mut day = date.day();
    loop {
        if let Some(d) = NaiveDate::from_ymd_opt(year, month, day) {
            return d;
        }
        if day <= 1 {
            return NaiveDate::from_ymd_opt(year, month, 1).unwrap();
        }
        day -= 1;
    }
}

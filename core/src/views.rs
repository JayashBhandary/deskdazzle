//! Scheduling logic: urgency sort, Today/Upcoming/Someday smart views,
//! and recurring-task expansion.

use crate::dates::{add_months, end_of_day_ms, start_of_day_ms};
use crate::model::{Freq, Recurrence, Task};
use chrono::Duration;
use serde::{Deserialize, Serialize};

/// Order tasks by urgency: open before done, then by due date (soonest first,
/// undated last), then by priority, then by manual order.
pub fn sort_tasks(mut tasks: Vec<Task>) -> Vec<Task> {
    tasks.sort_by(|a, b| {
        a.done
            .cmp(&b.done)
            .then(a.due.unwrap_or(i64::MAX).cmp(&b.due.unwrap_or(i64::MAX)))
            .then(b.priority.weight().cmp(&a.priority.weight()))
            .then(a.order.partial_cmp(&b.order).unwrap_or(std::cmp::Ordering::Equal))
    });
    tasks
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartViews {
    pub overdue: Vec<Task>,
    pub today: Vec<Task>,
    pub upcoming: Vec<Task>,
    pub someday: Vec<Task>,
}

/// Bucket open tasks (and top-level only — subtasks ride with their parent in
/// the UI) into the smart views relative to `now_ms`. Completed tasks drop out.
pub fn smart_views(tasks: Vec<Task>, now_ms: i64) -> SmartViews {
    let day_start = start_of_day_ms(now_ms);
    let day_end = end_of_day_ms(now_ms);
    let mut v = SmartViews::default();

    for t in sort_tasks(tasks) {
        if t.done || t.parent_id.is_some() {
            continue;
        }
        match t.due {
            None => v.someday.push(t),
            Some(due) if due < day_start => v.overdue.push(t),
            Some(due) if due <= day_end => v.today.push(t),
            Some(_) => v.upcoming.push(t),
        }
    }
    v
}

/// The next due timestamp for a recurring task, stepping forward from `from_ms`
/// by the recurrence rule.
pub fn next_due(rec: &Recurrence, from_ms: i64) -> i64 {
    let dt = crate::dates::from_ms(from_ms);
    let step = rec.interval.max(1) as i64;
    let next = match rec.freq {
        Freq::Daily => dt + Duration::days(step),
        Freq::Weekly => dt + Duration::weeks(step),
        Freq::Monthly => {
            let d = add_months(dt.date(), step);
            d.and_time(dt.time())
        }
        Freq::Yearly => {
            let d = add_months(dt.date(), step * 12);
            d.and_time(dt.time())
        }
    };
    crate::dates::to_ms(next)
}

/// Given a task being completed, produce the next occurrence to schedule
/// (caller assigns a fresh id + persists). Returns `None` for non-recurring tasks.
pub fn next_occurrence(task: &Task) -> Option<Task> {
    let rec = task.recurrence.as_ref()?;
    let base = task.due?;
    let mut next = task.clone();
    next.due = Some(next_due(rec, base));
    next.done = false;
    next.completed_ms = None;
    Some(next)
}

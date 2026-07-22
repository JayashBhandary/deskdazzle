// Natural-language quick-add parser for Tasks.
//
// Turns a line like:
//   "pay rent tomorrow at 5pm !high #finance every month"
// into { title, priority, tags, due, recurrence }, matching the wire shape the
// rest of the app uses (priority 'none'|'low'|'medium'|'high'; recurrence
// { freq:'daily'|'weekly'|'monthly'|'yearly', interval:n }; due = epoch ms).
//
// Everything is computed in LOCAL time — "today"/"tomorrow"/"9am" mean the
// user's local day and clock, so the parsed `due` always agrees with the local
// date labels shown in the UI. (The old wasm parser worked in UTC, which made
// "today" render as "Tomorrow" for many timezones.)
//
// Pure and dependency-free; `now` is injectable for tests.

const WEEKDAYS = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, weds: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const FREQ = {
  day: 'daily', days: 'daily', daily: 'daily',
  week: 'weekly', weeks: 'weekly', weekly: 'weekly',
  month: 'monthly', months: 'monthly', monthly: 'monthly',
  year: 'yearly', years: 'yearly', yearly: 'yearly', annually: 'yearly', annual: 'yearly',
};

const NUM_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

// Named times of day → [hour, minute].
const NAMED_TIMES = {
  morning: [9, 0], noon: [12, 0], midday: [12, 0], afternoon: [14, 0],
  evening: [18, 0], night: [20, 0], tonight: [20, 0], midnight: [0, 0],
};

const DEFAULT_HOUR = 9; // default time for a date with no explicit clock time

// ---- local-time date helpers -------------------------------------------
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => {
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // clamp to last valid day of the target month
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return t;
};
const addYears = (d, n) => addMonths(d, n * 12);
const withTime = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);

// ---- small token helpers -----------------------------------------------
const clean = (w) => w.toLowerCase().replace(/[.,;:]+$/, '');
const stripOrdinal = (w) => w.replace(/(\d+)(st|nd|rd|th)$/i, '$1');
const asInt = (w) => {
  const s = stripOrdinal(clean(w));
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s in NUM_WORDS) return NUM_WORDS[s];
  return null;
};

// Parse a clock time token like "5pm", "5:30pm", "17:30", "3 pm" (already one
// token). Returns [h, m] or null.
function parseClock(tok) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(tok);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return [h, m[2] ? parseInt(m[2], 10) : 0];
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(tok);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const mm = parseInt(h24[2], 10);
    if (h < 24 && mm < 60) return [h, mm];
  }
  return null;
}

// ---- main parser --------------------------------------------------------
export function parseTask(input, now = Date.now()) {
  const nowD = new Date(now);
  const today = startOfDay(nowD);

  const raw = String(input || '');
  const tokens = raw.split(/\s+/).filter(Boolean);
  const used = new Array(tokens.length).fill(false);

  let priority = 'none';
  const tags = [];
  let dueDate = null; // a Date at local midnight (date part)
  let timeHM = null; // [h, m] if an explicit time was given
  let recurrence = null;

  const lc = tokens.map(clean);
  const take = (...idx) => idx.forEach((k) => { used[k] = true; });

  const nextWeekday = (targetDow, forceNext) => {
    let delta = (targetDow - today.getDay() + 7) % 7;
    if (delta === 0 && forceNext) delta = 7;
    return addDays(today, delta);
  };

  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    const w = lc[i];
    const orig = tokens[i];

    // #tag
    if (orig.startsWith('#') && orig.length > 1) { tags.push(orig.slice(1).toLowerCase()); take(i); continue; }

    // !priority  and  p1/p2/p3
    if (orig.startsWith('!')) {
      if (/^!+$/.test(orig)) { priority = 'high'; take(i); continue; } // "!" / "!!" / "!!!"
      const r = w.slice(1);
      if (['high', 'h', '1', 'urgent'].includes(r)) { priority = 'high'; take(i); continue; }
      if (['med', 'medium', 'm', '2'].includes(r)) { priority = 'medium'; take(i); continue; }
      if (['low', 'l', '3'].includes(r)) { priority = 'low'; take(i); continue; }
    }
    if (/^p[123]$/.test(w)) { priority = w === 'p1' ? 'high' : w === 'p2' ? 'medium' : 'low'; take(i); continue; }
    if (['urgent', 'asap', 'important'].includes(w)) { priority = 'high'; take(i); continue; }

    // recurrence: "every [N|other] <unit>"  or  "every <weekday>"
    if (w === 'every') {
      const a = lc[i + 1];
      const b = lc[i + 2];
      // every other <unit>
      if (a === 'other' && b && FREQ[b]) { recurrence = { freq: FREQ[b], interval: 2 }; take(i, i + 1, i + 2); continue; }
      // every N <unit>
      const n = a != null ? asInt(a) : null;
      if (n && b && FREQ[b]) { recurrence = { freq: FREQ[b], interval: Math.max(1, n) }; take(i, i + 1, i + 2); continue; }
      // every <unit>
      if (a && FREQ[a]) { recurrence = { freq: FREQ[a], interval: 1 }; take(i, i + 1); continue; }
      // every <weekday>  → weekly, and set the due to that weekday
      if (a && a in WEEKDAYS) {
        recurrence = { freq: 'weekly', interval: 1 };
        if (!dueDate) dueDate = nextWeekday(WEEKDAYS[a], false);
        take(i, i + 1); continue;
      }
    }
    // biweekly / fortnightly / bare daily|weekly|monthly|yearly
    if (w === 'biweekly' || w === 'fortnightly') { recurrence = { freq: 'weekly', interval: 2 }; take(i); continue; }
    if (['daily', 'weekly', 'monthly', 'yearly', 'annually'].includes(w) && !(i > 0 && lc[i - 1] === 'every')) {
      recurrence = { freq: FREQ[w], interval: 1 }; take(i); continue;
    }

    // ---- dates ----
    // today / tonight / tomorrow / yesterday / "day after tomorrow"
    if (w === 'today' || w === 'tod') { dueDate = today; take(i); continue; }
    if (w === 'tonight') { dueDate = today; timeHM = timeHM || NAMED_TIMES.tonight; take(i); continue; }
    if (['tomorrow', 'tmr', 'tmrw', 'tom', 'tmw'].includes(w)) { dueDate = addDays(today, 1); take(i); continue; }
    if (w === 'yesterday') { dueDate = addDays(today, -1); take(i); continue; }
    if (w === 'day' && lc[i + 1] === 'after' && lc[i + 2] === 'tomorrow') { dueDate = addDays(today, 2); take(i, i + 1, i + 2); continue; }
    if (w === 'overmorrow') { dueDate = addDays(today, 2); take(i); continue; }

    // "next"/"this" <weekday|unit|weekend>
    if (w === 'next' || w === 'this') {
      const a = lc[i + 1];
      if (a && a in WEEKDAYS) { dueDate = nextWeekday(WEEKDAYS[a], w === 'next'); take(i, i + 1); continue; }
      if (a === 'weekend') { dueDate = nextWeekday(6, w === 'next'); take(i, i + 1); continue; } // Saturday
      if (a === 'week') { dueDate = addDays(today, 7); take(i, i + 1); continue; }
      if (a === 'month') { dueDate = addMonths(today, 1); take(i, i + 1); continue; }
      if (a === 'year') { dueDate = addYears(today, 1); take(i, i + 1); continue; }
    }
    if (w === 'weekend') { dueDate = nextWeekday(6, false); take(i); continue; }

    // "end of week/month/year"  and  eod/eow/eom
    if (w === 'eod') { dueDate = today; take(i); continue; }
    if (w === 'eow') { dueDate = nextWeekday(5, false); take(i); continue; } // Friday
    if (w === 'eom') { dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); take(i); continue; }
    if (w === 'end' && lc[i + 1] === 'of') {
      const a = lc[i + 2];
      if (a === 'week') { dueDate = nextWeekday(5, false); take(i, i + 1, i + 2); continue; }
      if (a === 'month') { dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); take(i, i + 1, i + 2); continue; }
      if (a === 'year') { dueDate = new Date(today.getFullYear(), 11, 31); take(i, i + 1, i + 2); continue; }
    }

    // "in N <unit>"  (days/weeks/months/years/hours/minutes)
    if (w === 'in') {
      const n = lc[i + 1] != null ? asInt(lc[i + 1]) : null;
      const unit = lc[i + 2];
      if (n != null && unit) {
        if (/^(day|days)$/.test(unit)) { dueDate = addDays(today, n); take(i, i + 1, i + 2); continue; }
        if (/^(week|weeks)$/.test(unit)) { dueDate = addDays(today, n * 7); take(i, i + 1, i + 2); continue; }
        if (/^(month|months)$/.test(unit)) { dueDate = addMonths(today, n); take(i, i + 1, i + 2); continue; }
        if (/^(year|years)$/.test(unit)) { dueDate = addYears(today, n); take(i, i + 1, i + 2); continue; }
        if (/^(hour|hours|hr|hrs|h)$/.test(unit)) { const t = new Date(now + n * 3600_000); dueDate = startOfDay(t); timeHM = [t.getHours(), t.getMinutes()]; take(i, i + 1, i + 2); continue; }
        if (/^(min|mins|minute|minutes|m)$/.test(unit)) { const t = new Date(now + n * 60_000); dueDate = startOfDay(t); timeHM = [t.getHours(), t.getMinutes()]; take(i, i + 1, i + 2); continue; }
      }
    }

    // bare weekday
    if (w in WEEKDAYS) { dueDate = nextWeekday(WEEKDAYS[w], false); take(i); continue; }

    // month + day  ("jan 5", "january 5th")  and  day + month ("5 jan")
    if (w in MONTHS) {
      const dnum = asInt(lc[i + 1] || '');
      if (dnum != null && dnum >= 1 && dnum <= 31) {
        dueDate = monthDay(today, MONTHS[w], dnum);
        take(i, i + 1);
        continue;
      }
    }
    if (i + 1 < tokens.length && (lc[i + 1] in MONTHS)) {
      const dnum = asInt(w);
      if (dnum != null && dnum >= 1 && dnum <= 31) {
        dueDate = monthDay(today, MONTHS[lc[i + 1]], dnum);
        take(i, i + 1);
        continue;
      }
    }

    // ISO date yyyy-mm-dd
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w);
    if (m) { dueDate = new Date(+m[1], +m[2] - 1, +m[3]); take(i); continue; }
    // d/m or d/m/y (day-first; if first>12 it's clearly a day)
    m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(w);
    if (m) {
      let a = +m[1]; let b = +m[2];
      let day; let mon;
      if (a > 12) { day = a; mon = b - 1; } else { day = a; mon = b - 1; } // day-first
      const yr = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
      if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
        let d = new Date(yr, mon, day);
        if (!m[3] && d < today) d = new Date(yr + 1, mon, day); // roll to next year if past
        dueDate = d; take(i); continue;
      }
    }

    // "on the 15th" / bare ordinal day of month
    if (w === 'on' && (lc[i + 1] === 'the' || asInt(lc[i + 1] || '') != null)) {
      const dnum = asInt(lc[i + 2] || '') ?? asInt(lc[i + 1] || '');
      const skip = lc[i + 1] === 'the' ? [i, i + 1, i + 2] : [i, i + 1];
      if (dnum != null && dnum >= 1 && dnum <= 31) { dueDate = dayOfMonth(today, dnum); take(...skip); continue; }
    }
    if (/^\d{1,2}(st|nd|rd|th)$/.test(w)) {
      const dnum = asInt(w);
      if (dnum != null && dnum >= 1 && dnum <= 31) { dueDate = dayOfMonth(today, dnum); take(i); continue; }
    }

    // ---- times ----
    // "at <time>"
    if (w === 'at') {
      const t = parseClock(lc[i + 1] || '') || (lc[i + 1] in NAMED_TIMES ? NAMED_TIMES[lc[i + 1]] : null);
      if (t) { timeHM = t; take(i, i + 1); continue; }
      // "at 5 pm" (space-separated am/pm)
      if (/^\d{1,2}(:\d{2})?$/.test(lc[i + 1] || '') && /^(am|pm)$/.test(lc[i + 2] || '')) {
        const t2 = parseClock(lc[i + 1] + lc[i + 2]);
        if (t2) { timeHM = t2; take(i, i + 1, i + 2); continue; }
      }
    }
    // bare clock ("5pm", "17:30")
    const clk = parseClock(w);
    if (clk) { timeHM = clk; take(i); continue; }
    // "5 pm" without "at"
    if (/^\d{1,2}(:\d{2})?$/.test(w) && /^(am|pm)$/.test(lc[i + 1] || '')) {
      const t2 = parseClock(w + lc[i + 1]);
      if (t2) { timeHM = t2; take(i, i + 1); continue; }
    }
    // named time of day
    if (w in NAMED_TIMES && w !== 'tonight') { timeHM = NAMED_TIMES[w]; if (w === 'midnight') dueDate = dueDate || addDays(today, 1); take(i); continue; }
  }

  // ---- assemble due ----
  let due = null;
  if (dueDate) {
    const [h, min] = timeHM || [DEFAULT_HOUR, 0];
    due = withTime(dueDate, h, min).getTime();
  } else if (timeHM) {
    // time only, no date → today at that time
    due = withTime(today, timeHM[0], timeHM[1]).getTime();
  }

  // ---- title: the leftover words, tidied ----
  let title = tokens.filter((_, k) => !used[k]).join(' ').trim();
  // drop dangling connectors left at the edges ("... on", "by ...", "due")
  title = title.replace(/\s+(on|at|by|due|the|of|every|next|this|in)$/i, '').trim();
  title = title.replace(/^(on|at|by|due)\s+/i, '').trim();

  return { title, priority, tags, due, recurrence };
}

// A month/day in the current year, rolled to next year if already past.
function monthDay(today, month0, day) {
  const last = new Date(today.getFullYear(), month0 + 1, 0).getDate();
  let d = new Date(today.getFullYear(), month0, Math.min(day, last));
  if (d < today) d = new Date(today.getFullYear() + 1, month0, Math.min(day, last));
  return d;
}
// A day-of-month in the current month, rolled to next month if already past.
function dayOfMonth(today, day) {
  const clampToMonth = (year, month0) => {
    const last = new Date(year, month0 + 1, 0).getDate();
    return new Date(year, month0, Math.min(day, last));
  };
  const d = clampToMonth(today.getFullYear(), today.getMonth());
  if (d >= today) return d;
  const nm = addMonths(today, 1);
  return clampToMonth(nm.getFullYear(), nm.getMonth());
}

export default parseTask;

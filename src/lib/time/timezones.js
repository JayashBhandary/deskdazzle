// A curated set of world-clock cities → IANA timezone ids. Not exhaustive, but
// covers the major hubs people actually add. The browser's Intl engine does the
// real work of resolving each id to a current time and UTC offset.

import { uid } from './format';

export const TIMEZONES = [
  { city: 'Honolulu', zone: 'Pacific/Honolulu' },
  { city: 'Anchorage', zone: 'America/Anchorage' },
  { city: 'Los Angeles', zone: 'America/Los_Angeles' },
  { city: 'Vancouver', zone: 'America/Vancouver' },
  { city: 'Cupertino', zone: 'America/Los_Angeles' },
  { city: 'Denver', zone: 'America/Denver' },
  { city: 'Mexico City', zone: 'America/Mexico_City' },
  { city: 'Chicago', zone: 'America/Chicago' },
  { city: 'New York', zone: 'America/New_York' },
  { city: 'Toronto', zone: 'America/Toronto' },
  { city: 'Bogotá', zone: 'America/Bogota' },
  { city: 'São Paulo', zone: 'America/Sao_Paulo' },
  { city: 'Buenos Aires', zone: 'America/Argentina/Buenos_Aires' },
  { city: 'Reykjavík', zone: 'Atlantic/Reykjavik' },
  { city: 'London', zone: 'Europe/London' },
  { city: 'Lisbon', zone: 'Europe/Lisbon' },
  { city: 'Dublin', zone: 'Europe/Dublin' },
  { city: 'Madrid', zone: 'Europe/Madrid' },
  { city: 'Paris', zone: 'Europe/Paris' },
  { city: 'Amsterdam', zone: 'Europe/Amsterdam' },
  { city: 'Berlin', zone: 'Europe/Berlin' },
  { city: 'Zurich', zone: 'Europe/Zurich' },
  { city: 'Rome', zone: 'Europe/Rome' },
  { city: 'Stockholm', zone: 'Europe/Stockholm' },
  { city: 'Athens', zone: 'Europe/Athens' },
  { city: 'Istanbul', zone: 'Europe/Istanbul' },
  { city: 'Cairo', zone: 'Africa/Cairo' },
  { city: 'Lagos', zone: 'Africa/Lagos' },
  { city: 'Johannesburg', zone: 'Africa/Johannesburg' },
  { city: 'Nairobi', zone: 'Africa/Nairobi' },
  { city: 'Moscow', zone: 'Europe/Moscow' },
  { city: 'Riyadh', zone: 'Asia/Riyadh' },
  { city: 'Dubai', zone: 'Asia/Dubai' },
  { city: 'Tehran', zone: 'Asia/Tehran' },
  { city: 'Karachi', zone: 'Asia/Karachi' },
  { city: 'Mumbai', zone: 'Asia/Kolkata' },
  { city: 'Delhi', zone: 'Asia/Kolkata' },
  { city: 'Kathmandu', zone: 'Asia/Kathmandu' },
  { city: 'Dhaka', zone: 'Asia/Dhaka' },
  { city: 'Bangkok', zone: 'Asia/Bangkok' },
  { city: 'Jakarta', zone: 'Asia/Jakarta' },
  { city: 'Singapore', zone: 'Asia/Singapore' },
  { city: 'Hong Kong', zone: 'Asia/Hong_Kong' },
  { city: 'Shanghai', zone: 'Asia/Shanghai' },
  { city: 'Taipei', zone: 'Asia/Taipei' },
  { city: 'Seoul', zone: 'Asia/Seoul' },
  { city: 'Tokyo', zone: 'Asia/Tokyo' },
  { city: 'Perth', zone: 'Australia/Perth' },
  { city: 'Adelaide', zone: 'Australia/Adelaide' },
  { city: 'Sydney', zone: 'Australia/Sydney' },
  { city: 'Brisbane', zone: 'Australia/Brisbane' },
  { city: 'Auckland', zone: 'Pacific/Auckland' },
];

// Seed cities for a fresh world clock — shared by the Clock app tab and the
// desktop widget so they agree on the initial set.
export const defaultWorldClocks = () =>
  ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo'].map((zone) => {
    const found = TIMEZONES.find((t) => t.zone === zone);
    return { id: uid(), city: found?.city ?? zone, zone };
  });

// The viewer's own timezone (used as the reference for "today / +N hrs" labels).
export const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

// { time: "09:41", day: "Today"|"Tomorrow"|"Yesterday", offsetLabel: "+3HRS" }
// for a given zone at a given instant, relative to the viewer's local time.
export function zoneInfo(zone, nowMs, reference = localZone()) {
  const now = new Date(nowMs);
  let time = '';
  try {
    time = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(now);
  } catch {
    return { time: '--:--', day: '', offsetLabel: '' };
  }

  // Day comparison: the calendar date in the target zone vs the reference zone.
  const dayIn = (z) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const here = dayIn(reference);
  const there = dayIn(zone);
  let day = 'Today';
  if (there > here) day = 'Tomorrow';
  else if (there < here) day = 'Yesterday';

  // Offset in whole hours between the two zones.
  const offsetHrs = Math.round((zoneOffsetMinutes(zone, now) - zoneOffsetMinutes(reference, now)) / 60);
  const offsetLabel =
    offsetHrs === 0 ? 'Same time' : `${offsetHrs > 0 ? '+' : '−'}${Math.abs(offsetHrs)} HRS`;

  return { time, day, offsetLabel };
}

// Minutes east of UTC for a zone at a given instant (handles DST).
function zoneOffsetMinutes(zone, date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === '24' ? '0' : parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

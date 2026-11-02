import { dayFromEpochDay, dayToString, isDay } from './day';
import { isTimeOfDay, timeOfDayFromMillis } from './time-of-day';
import { Instant } from './types';
import { checkInstant, dayAtTime, MAX_INSTANT, timeZoneOffset } from './zone';

const MS_PER_DAY = 86400000;

// date [T or space] time [offset]
const INSTANT_RE = new RegExp(
  '^([+-]\\d{6}|\\d{4})-(\\d{2})-(\\d{2})[Tt ]' +
    '(\\d{2}):(\\d{2})(?::(\\d{2})(?:[.,](\\d{1,9}))?)?' +
    '(?:([Zz])|([+-])(\\d{2})(?::?(\\d{2}))?)?$',
);

/**
 * Parse an ISO 8601 date and time into an instant: `2026-01-31T09:00:00Z`,
 * `2026-01-31T09:00:00.123-08:00`, `2026-01-31 09:00+0530`, ...
 *
 * Text without a UTC offset or `Z` is a wall clock time, so it needs a zone: pass `zone` to read
 * it there (clock changes resolved as {@link dayAtTime} 'compatible'), otherwise it is rejected.
 * A date alone is a {@link Day}, not an instant: use `dayParse`. Returns undefined for anything
 * that isn't valid, unlike `Date.parse`, which accepts many forms and reads a date alone as UTC
 * midnight.
 *
 * @public
 */
export const instantParse = (s: string, zone?: string): Instant | undefined => {
  const m = typeof s === 'string' ? INSTANT_RE.exec(s) : null;
  if (!m || m[1] === '-000000') {
    return undefined;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const dd = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  const millis = m[7] ? Number((m[7] + '00').slice(0, 3)) : 0;
  const d = { year, month, day: dd };
  const t = { hour, minute, second, millis };
  if (!isDay(d) || !isTimeOfDay(t)) {
    return undefined;
  }

  let r: number;
  if (m[8]) {
    r = dayAtTime(d, t, 'Etc/UTC');
  } else if (m[9]) {
    const oh = Number(m[10]);
    const om = m[11] ? Number(m[11]) : 0;
    if (oh > 23 || om > 59) {
      return undefined;
    }
    const offset = (oh * 60 + om) * 60000 * (m[9] === '-' ? -1 : 1);
    r = dayAtTime(d, t, 'Etc/UTC') - offset;
  } else if (zone !== undefined) {
    r = dayAtTime(d, t, zone);
  } else {
    return undefined;
  }
  return isFinite(r) && Math.abs(r) <= MAX_INSTANT ? r : undefined;
};

const pad = (n: number, w: number): string => {
  let s = String(n);
  while (s.length < w) {
    s = '0' + s;
  }
  return s;
};

/**
 * Format an instant as ISO 8601 with milliseconds. Without a zone it is in UTC
 * (`2026-01-31T17:00:00.000Z`, the same as `Date.toISOString()`); with a zone it is that zone's
 * wall clock time and offset (`2026-01-31T09:00:00.000-08:00`).
 *
 * @public
 */
export const instantToString = (instant: Instant, zone?: string): string => {
  checkInstant(instant);
  const offset = zone === undefined ? 0 : timeZoneOffset(zone, instant);
  const wall = Math.floor(instant + offset);
  const n = Math.floor(wall / MS_PER_DAY);
  const t = timeOfDayFromMillis(wall - n * MS_PER_DAY);
  const time = `${pad(t.hour, 2)}:${pad(t.minute, 2)}:${pad(t.second, 2)}.${pad(t.millis, 3)}`;
  let suffix = 'Z';
  if (zone !== undefined) {
    const mins = Math.round(Math.abs(offset) / 60000);
    suffix = `${offset < 0 ? '-' : '+'}${pad(Math.floor(mins / 60), 2)}:${pad(mins % 60, 2)}`;
  }
  return `${dayToString(dayFromEpochDay(n))}T${time}${suffix}`;
};

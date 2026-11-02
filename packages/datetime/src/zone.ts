import { tzFromUTC, tzResolveId } from '@phensley/timezone';
import { dayFromEpochDay, dayToEpochDay } from './day';
import { timeOfDayFromMillis, timeOfDayToMillis } from './time-of-day';
import { Day, Disambiguation, Instant, TimeOfDay } from './types';

/**
 * The only functions that take a time zone. Everything else in this package is plain integer
 * math on days and times of day; daylight saving time is handled here and nowhere else.
 *
 * Zones are IANA ids such as 'America/Vancouver' (aliases and any letter case are accepted).
 * An unknown zone throws a RangeError: silently falling back to UTC is how off-by-one-day bugs
 * start.
 */

const MS_PER_DAY = 86400000;

/**
 * Same range as JavaScript Date.
 *
 * @internal
 */
export const MAX_INSTANT = 8.64e15;

/**
 * @internal
 */
export const checkInstant = (instant: Instant): void => {
  if (typeof instant !== 'number' || !isFinite(instant) || Math.abs(instant) > MAX_INSTANT) {
    throw new RangeError(`Invalid instant: ${instant}`);
  }
};

/**
 * The zone's offset from UTC, in milliseconds, at an instant. Throws a RangeError for an
 * unknown zone.
 *
 * @public
 */
export const timeZoneOffset = (zone: string, instant: Instant): number => {
  const info = tzFromUTC(zone, instant);
  if (!info) {
    throw new RangeError(`Unknown time zone: ${JSON.stringify(zone)}`);
  }
  return info.offset;
};

/**
 * The time zone the device or server is set to, as a canonical IANA id, or undefined if the
 * platform doesn't report one this package's time zone data knows. Servers commonly report
 * 'Etc/UTC'.
 *
 * @public
 */
export const systemTimeZone = (): string | undefined => {
  let id: string | undefined;
  try {
    id = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
  return id ? tzResolveId(id) : undefined;
};

/**
 * Wall clock milliseconds (as if the zone were UTC) for an instant.
 */
const toWall = (instant: Instant, zone: string): number => {
  checkInstant(instant);
  return instant + timeZoneOffset(zone, instant);
};

/**
 * The day it is in `zone` at `instant`. For "today", see {@link dayToday}.
 *
 * @public
 */
export const dayFromInstant = (instant: Instant, zone: string): Day =>
  dayFromEpochDay(Math.floor(toWall(instant, zone) / MS_PER_DAY));

/**
 * The wall clock time in `zone` at `instant`.
 *
 * @public
 */
export const timeOfDayFromInstant = (instant: Instant, zone: string): TimeOfDay => {
  const wall = Math.floor(toWall(instant, zone));
  return timeOfDayFromMillis(wall - Math.floor(wall / MS_PER_DAY) * MS_PER_DAY);
};

/**
 * Today's date in `zone`. `now` defaults to `Date.now()`; pass it to make code testable.
 *
 * Which zone "today" is in is a product decision: the user's zone for "is my invoice overdue?",
 * the customer's zone for "is it overdue for them?". A server usually runs in UTC, so code that
 * asks the system for today gets the wrong day for much of the world.
 *
 * @public
 */
export const dayToday = (zone: string, now: Instant = Date.now()): Day => dayFromInstant(now, zone);

/**
 * Options for {@link dayAtTime}.
 *
 * @public
 */
export interface DayAtTimeOptions {
  /**
   * What to do when the time is skipped or repeated because the clocks change that day.
   * Default 'compatible'.
   */
  disambiguation?: Disambiguation;
}

/**
 * The instant when the wall clock in `zone` shows `time` on day `d`: "9:00 on the due date in
 * Tokyo". When the clocks change that day the time can be skipped (02:30 on a spring-forward
 * day) or happen twice (01:30 on a fall-back day); `options.disambiguation` decides, with the
 * same rules as JavaScript Temporal.
 *
 * Use this to schedule: store the day (or a rule that picks days), the time of day and, for a
 * pinned schedule, the zone; compute the instant when needed. Don't store the instant as the
 * source of truth: time zone rules change, and a repeating time isn't every 24 hours.
 *
 * @public
 */
export const dayAtTime = (d: Day, time: TimeOfDay, zone: string, options?: DayAtTimeOptions): Instant => {
  const mode = (options && options.disambiguation) || 'compatible';
  const wall = dayToEpochDay(d) * MS_PER_DAY + timeOfDayToMillis(time);

  // Offsets in effect a day before and a day after; one of them applies unless the zone
  // changed its offset more than once within two days, which no real zone does.
  const before = timeZoneOffset(zone, wall - MS_PER_DAY);
  const after = timeZoneOffset(zone, wall + MS_PER_DAY);

  const candidates: number[] = [];
  const consider = (offset: number) => {
    const t = wall - offset;
    if (timeZoneOffset(zone, t) === offset && candidates.indexOf(t) === -1) {
      candidates.push(t);
    }
  };
  consider(before);
  consider(after);
  candidates.sort((a, b) => a - b);

  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length > 1) {
    // Repeated: the clocks went back, so this wall time happens twice.
    switch (mode) {
      case 'reject':
        throw new RangeError(`Time happens twice in ${zone} that day`);
      case 'later':
        return candidates[candidates.length - 1];
      default:
        return candidates[0];
    }
  }

  // Skipped: the clocks went forward over this wall time. Read with the offset from before
  // the change it lands after the gap (02:30 -> 03:30); with the offset from after, before it.
  switch (mode) {
    case 'reject':
      throw new RangeError(`Time doesn't exist in ${zone} that day`);
    case 'earlier':
      return wall - after;
    default:
      return wall - before;
  }
};

/**
 * The instant day `d` starts in `zone`: midnight, or the first moment after midnight when a
 * clock change skips it.
 *
 * @public
 */
export const dayStartInstant = (d: Day, zone: string): Instant =>
  dayAtTime(d, { hour: 0, minute: 0, second: 0, millis: 0 }, zone);

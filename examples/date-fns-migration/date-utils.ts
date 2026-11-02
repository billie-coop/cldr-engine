/**
 * A drop-in replacement for an app's date helper module (`@billie-coop/date-utils`) that used
 * date-fns, built on `@phensley/datetime` instead. The `DateUtils` object keeps the same names,
 * arguments and results, so its callers don't change; under the hood every date string is a
 * `Day` (no time, no zone) and "today" is asked for in an explicit zone.
 *
 * New code should use `@phensley/datetime` directly (`Day`, `dayToday(zone)`, `dayAtTime`, ...):
 * it never goes through a JavaScript `Date`, so it can't shift by a day.
 *
 * Differences from the date-fns version, all for invalid input:
 * - A string that looks like `YYYY-MM-DD` but names a day that doesn't exist (`2025-02-30`)
 *   is invalid. The date-fns version rolled it over to March 2nd.
 * - Timestamps are parsed by `instantParse`: ISO 8601 date and time, with or without an
 *   offset (without one it is read in the device's zone). date-fns `parseISO` also accepted
 *   partial forms such as `2025-12` or `20251208`.
 */
import type { Day } from '@phensley/datetime';
import {
  dayAdd,
  dayCompare,
  dayFromInstant,
  dayParse,
  dayStartOfWeek,
  dayToString,
  dayToday,
  dayUntil,
  instantParse,
  systemTimeZone,
  timeOfDayFromInstant,
} from '@phensley/datetime';

/** The device's time zone ('Etc/UTC' if the platform doesn't report one we know). */
export const localZone = (): string => systemTimeZone() ?? 'Etc/UTC';

/** A date string (YYYY-MM-DD, or an ISO timestamp) as the day it names in the device's zone. */
const toDay = (dateString: string): Day | undefined => {
  const d = dayParse(dateString);
  if (d) return d;
  const zone = localZone();
  const instant = instantParse(dateString, zone);
  return instant === undefined ? undefined : dayFromInstant(instant, zone);
};

/** Local midnight on a day, as a JavaScript Date (for the Date-returning API). */
const localMidnight = (d: Day): Date => {
  const date = new Date(2000, 0, 1);
  date.setFullYear(d.year, d.month - 1, d.day);
  return date;
};

const INVALID = 'NaN-NaN-NaN'; // what the date-fns version produced for invalid input

/** Add days, weeks or months to a date string, returning YYYY-MM-DD. */
const addTo = (dateString: string, duration: { days?: number; weeks?: number; months?: number }): string => {
  const d = toDay(dateString);
  return d ? dayToString(dayAdd(d, duration)) : INVALID;
};

export type DateGroup = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'later';

/**
 * Centralized date utilities. Date strings are YYYY-MM-DD; "today" is in the device's zone.
 */
export const DateUtils = {
  // ============= Parsing & Validation =============

  /** Parse a date string (YYYY-MM-DD) to a Date at local midnight. */
  parseDate(dateString: string): Date {
    return DateUtils.parseDateSafe(dateString);
  },

  /** Check if a value is a valid date (a valid date string, or a valid Date). */
  isValidDate(date: unknown): boolean {
    if (typeof date === 'string') {
      return toDay(date) !== undefined;
    }
    return date instanceof Date && !Number.isNaN(date.getTime());
  },

  // ============= Today Calculations =============

  /** Today at local midnight. */
  getToday(): Date {
    return localMidnight(dayToday(localZone()));
  },

  /** Today as YYYY-MM-DD. */
  getTodayString(): string {
    return dayToString(dayToday(localZone()));
  },

  /** The current moment. */
  getNow(): Date {
    return new Date();
  },

  /** Current local hour (0-23). */
  getCurrentHour(): number {
    return timeOfDayFromInstant(Date.now(), localZone()).hour;
  },

  // ============= Comparisons =============

  /** True if the date is before today. */
  isOverdue(dateString: string): boolean {
    const d = toDay(dateString);
    return d !== undefined && dayCompare(d, dayToday(localZone())) < 0;
  },

  /** True if the date is today. */
  isToday(dateString: string): boolean {
    return DateUtils.getDaysUntil(dateString) === 0;
  },

  /** True if the date is tomorrow. */
  isTomorrow(dateString: string): boolean {
    return DateUtils.getDaysUntil(dateString) === 1;
  },

  /** True if the date is in the current Sunday-to-Saturday week. */
  isThisWeek(dateString: string): boolean {
    const d = toDay(dateString);
    if (!d) return false;
    const start = dayStartOfWeek(dayToday(localZone()), 1);
    const n = dayUntil(start, d);
    return n >= 0 && n <= 6;
  },

  /** Days until the date (negative if past; NaN for an invalid date). */
  getDaysUntil(dateString: string): number {
    const d = toDay(dateString);
    return d ? dayUntil(dayToday(localZone()), d) : Number.NaN;
  },

  /** Days overdue (0 if not overdue). */
  getDaysOverdue(dateString: string): number {
    const daysUntil = DateUtils.getDaysUntil(dateString);
    return daysUntil < 0 ? Math.abs(daysUntil) : 0;
  },

  // ============= Date Arithmetic =============

  /** Add days to a date string, returning YYYY-MM-DD. */
  addDays(args: { dateString: string; days: number }): string {
    return addTo(args.dateString, { days: args.days });
  },

  /** Add weeks to a date string, returning YYYY-MM-DD. */
  addWeeks(args: { dateString: string; weeks: number }): string {
    return addTo(args.dateString, { weeks: args.weeks });
  },

  /** Add months to a date string, returning YYYY-MM-DD (clamped to the end of shorter months). */
  addMonths(args: { dateString: string; months: number }): string {
    return addTo(args.dateString, { months: args.months });
  },

  // ============= Grouping Helpers =============

  /** The display group for a date. */
  getDateGroup(dateString: string): DateGroup {
    const daysUntil = DateUtils.getDaysUntil(dateString);
    if (daysUntil < 0) return 'overdue';
    if (daysUntil === 0) return 'today';
    if (daysUntil === 1) return 'tomorrow';
    if (daysUntil <= 7) return 'thisWeek';
    if (daysUntil <= 14) return 'nextWeek';
    if (daysUntil <= 30) return 'thisMonth';
    return 'later';
  },

  /** Sort date strings chronologically (oldest first). */
  sortByDate(dates: string[]): string[] {
    return [...dates].sort(
      (a, b) => DateUtils.parseDateSafe(a).getTime() - DateUtils.parseDateSafe(b).getTime(),
    );
  },

  /** Group dates by their display category, each group sorted. */
  groupDates(dates: string[]): Record<DateGroup, string[]> {
    const groups: Record<DateGroup, string[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      nextWeek: [],
      thisMonth: [],
      later: [],
    };
    for (const date of dates) {
      groups[DateUtils.getDateGroup(date)].push(date);
    }
    for (const group of Object.keys(groups) as DateGroup[]) {
      groups[group] = DateUtils.sortByDate(groups[group]);
    }
    return groups;
  },

  // ============= Storage Format =============

  /** The moment a Unix ms timestamp names. */
  fromTimestamp(timestampMs: number): Date {
    return new Date(timestampMs);
  },

  /** A Date's local calendar day as YYYY-MM-DD. */
  toStorageFormat(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /** True if two date strings are the same day. */
  isSameDay(dateString1: string, dateString2: string): boolean {
    const a = toDay(dateString1);
    const b = toDay(dateString2);
    return a !== undefined && b !== undefined && dayCompare(a, b) === 0;
  },

  // ============= Safe Date Parsing =============

  /**
   * Parse a date string as a Date: YYYY-MM-DD at local midnight, a timestamp at its moment.
   * Invalid input gives an invalid Date.
   */
  parseDateSafe(dateString: string): Date {
    const d = dayParse(dateString);
    if (d) return localMidnight(d);
    const instant = instantParse(dateString, localZone());
    return new Date(instant === undefined ? Number.NaN : instant);
  },

  /** Parse a date string and return local midnight of its day. */
  parseDateStartOfDay(dateString: string): Date {
    const d = toDay(dateString);
    return d ? localMidnight(d) : new Date(Number.NaN);
  },

  /** True if a date string is today. */
  isDateToday(dateString: string): boolean {
    return DateUtils.isToday(dateString);
  },

  /** True if a date string is before today. */
  isDateOverdue(dateString: string): boolean {
    return DateUtils.isOverdue(dateString);
  },
};

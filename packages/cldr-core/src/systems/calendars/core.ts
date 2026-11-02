import { DateField, emptyFields } from './fields';
import { initBaseFromUnixEpoch, unixEpochFromJD } from './math';
import { zoneInfoFromUTC } from './timezone';
import { CalendarDate, CalendarDateFields, CalendarSystem } from './types';

const { floor } = Math;

/**
 * Construct a date in the given calendar from a UTC epoch and time zone. Every date is
 * created here so all dates share one object shape.
 */
export const newDate = (
  calendar: CalendarSystem,
  epoch: number,
  zoneId: string,
  firstDay: number,
  minDays: number,
): CalendarDate => {
  const fields = emptyFields();
  const zoneInfo = initBaseFromUnixEpoch(fields, epoch, zoneId);
  calendar.computeFields(fields);
  const rule = calendar.weekRule;
  const first = rule ? rule[0] : firstDay;
  const min = rule ? rule[1] : minDays;
  computeWeekFields(calendar, fields, first, min);
  return { calendar, fields, zoneInfo, firstDay: first, minDays: min };
};

/**
 * Construct a date from a Julian day and milliseconds in the day (UTC).
 */
export const newDateFromJD = (
  calendar: CalendarSystem,
  jd: number,
  msDay: number,
  zoneId: string,
  firstDay: number,
  minDays: number,
): CalendarDate => newDate(calendar, unixEpochFromJD(jd, msDay), zoneId, firstDay, minDays);

/**
 * Returns true if the argument is a calendar date.
 *
 * @public
 */
export const isCalendarDate = (x: any): x is CalendarDate =>
  x !== null &&
  typeof x === 'object' &&
  Array.isArray(x.fields) &&
  typeof x.zoneInfo === 'object' &&
  typeof x.calendar === 'object' &&
  x.calendar !== null &&
  typeof x.calendar.computeFields === 'function';

/**
 * Construct a date in the given calendar from a UNIX epoch (milliseconds, UTC) and time zone.
 *
 * @public
 */
export const dateFromUnixEpoch = (
  calendar: CalendarSystem,
  epoch: number,
  zoneId: string,
  firstDay: number = 1,
  minDays: number = 1,
): CalendarDate => newDate(calendar, epoch, zoneId, firstDay, minDays);

/**
 * Construct a date in the given calendar from the given fields. Fields left out take the
 * calendar's defaults; the time zone defaults to UTC.
 *
 * Note: the 'year' field is the "extended year".
 *
 * @public
 */
export const dateFromFields = (
  calendar: CalendarSystem,
  fields: Partial<CalendarDateFields>,
  firstDay: number = 1,
  minDays: number = 1,
): CalendarDate => {
  const [epoch, zoneId] = calendar.resolveFields(
    { ...calendar.defaultFields, ...fields },
    zoneInfoFromUTC('UTC', 0).zoneid,
    0,
  );
  return newDate(calendar, epoch, zoneId, firstDay, minDays);
};

/**
 * Compute the week fields (week of month, day of week in month, week of year and its year for
 * both the date's week rule and ISO-8601) once, when the date is created, so the `date*`
 * accessors are plain reads. 1.x computed these on first access and memoized them.
 */
const computeWeekFields = (calendar: CalendarSystem, f: number[], firstDay: number, minDays: number): void => {
  const dow = f[DateField.DAY_OF_WEEK];
  const dom = f[DateField.DAY_OF_MONTH];
  f[DateField.WEEK_OF_MONTH] = weekNumber(firstDay, minDays, dom, dom, dow);
  f[DateField.DAY_OF_WEEK_IN_MONTH] = (((dom - 1) / 7) | 0) + 1;
  weekOfYear(calendar, f, DateField.WEEK_OF_YEAR, DateField.YEAR_WOY, firstDay, minDays);
  if (firstDay === 2 && minDays === 4) {
    // The week rule is ISO-8601's, so the ISO fields are the same.
    f[DateField.ISO_WEEK_OF_YEAR] = f[DateField.WEEK_OF_YEAR];
    f[DateField.ISO_YEAR_WOY] = f[DateField.YEAR_WOY];
  } else {
    weekOfYear(calendar, f, DateField.ISO_WEEK_OF_YEAR, DateField.ISO_YEAR_WOY, 2, 4);
  }
};

/**
 * Compute the week of year and the year of the week of year using the given week rule,
 * storing them in the fields `woyField` and `ywoyField`.
 */
const weekOfYear = (
  calendar: CalendarSystem,
  f: number[],
  woyField: DateField,
  ywoyField: DateField,
  firstDay: number,
  minDays: number,
): void => {
  const dow = f[DateField.DAY_OF_WEEK];
  const doy = f[DateField.DAY_OF_YEAR];
  const eyear = f[DateField.EXTENDED_YEAR];

  let ywoy = eyear;
  const rdow = (dow + 7 - firstDay) % 7;
  const rdowJan1 = (dow - doy + 7001 - firstDay) % 7;
  let woy = floor((doy - 1 + rdowJan1) / 7);
  if (7 - rdowJan1 >= minDays) {
    woy++;
  }

  if (woy === 0) {
    const prevDay = doy + yearLength(calendar, eyear - 1);
    woy = weekNumber(firstDay, minDays, prevDay, prevDay, dow);
    ywoy--;
  } else {
    const lastDoy = yearLength(calendar, eyear);
    if (doy >= lastDoy - 5) {
      let lastRdow = (rdow + lastDoy - doy) % 7;
      if (lastRdow < 0) {
        lastRdow += 7;
      }
      if (6 - lastRdow >= minDays && doy + 7 - rdow > lastDoy) {
        woy = 1;
        ywoy++;
      }
    }
  }

  f[woyField] = woy;
  f[ywoyField] = ywoy;
};

const yearLength = (calendar: CalendarSystem, y: number): number =>
  calendar.monthStart(y + 1, 0, false) - calendar.monthStart(y, 0, false);

const weekNumber = (
  firstDay: number,
  minDays: number,
  desiredDay: number,
  dayOfPeriod: number,
  dayOfWeek: number,
): number => {
  let psow = (dayOfWeek - firstDay - dayOfPeriod + 1) % 7;
  if (psow < 0) {
    psow += 7;
  }
  const weekNo = floor((desiredDay + psow - 1) / 7);
  return 7 - psow >= minDays ? weekNo + 1 : weekNo;
};

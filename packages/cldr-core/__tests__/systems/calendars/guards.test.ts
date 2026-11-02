import {
  buddhistDateFromUnixEpoch,
  gregorianDateFromUnixEpoch,
  isBuddhistDate,
  isCalendarDate,
  isGregorianDate,
  isPersianDate,
  iso8601DateFromUnixEpoch,
  japaneseDateFromUnixEpoch,
  persianDateFromUnixEpoch,
} from '../../../src';

const EPOCH = Date.UTC(2024, 0, 15, 12);

test('isCalendarDate accepts dates', () => {
  const dates = [
    gregorianDateFromUnixEpoch(EPOCH, 'America/New_York', 1, 1),
    iso8601DateFromUnixEpoch(EPOCH, 'UTC', 1, 1),
    buddhistDateFromUnixEpoch(EPOCH, 'Asia/Bangkok', 1, 1),
    japaneseDateFromUnixEpoch(EPOCH, 'Asia/Tokyo', 1, 1),
    persianDateFromUnixEpoch(EPOCH, 'Asia/Tehran', 1, 1),
    gregorianDateFromUnixEpoch(EPOCH, 'Not/AZone', 1, 1),
  ];
  for (const d of dates) {
    expect(isCalendarDate(d)).toBe(true);
    expect(isCalendarDate({ ...d })).toBe(true);
  }
  expect(isGregorianDate(dates[1])).toBe(true);
  expect(isBuddhistDate(dates[2])).toBe(true);
  expect(isPersianDate(dates[4])).toBe(true);
  expect(isGregorianDate(dates[4])).toBe(false);
});

test('isCalendarDate rejects incomplete objects', () => {
  const d = gregorianDateFromUnixEpoch(EPOCH, 'America/New_York', 1, 1);
  const bad: any[] = [
    undefined,
    null,
    {},
    new Date(EPOCH),
    { date: EPOCH, zoneId: 'UTC' },
    { ...d, zoneInfo: null },
    { ...d, zoneInfo: {} },
    { ...d, zoneInfo: { ...d.zoneInfo, offset: '0' } },
    { ...d, zoneInfo: { ...d.zoneInfo, zoneid: undefined } },
    { ...d, fields: undefined },
    { ...d, firstDay: undefined },
    { ...d, minDays: '1' },
    { ...d, calendar: null },
    { ...d, calendar: { ...d.calendar, computeFields: undefined } },
    { ...d, calendar: { ...d.calendar, type: undefined } },
  ];
  for (const x of bad) {
    expect(isCalendarDate(x)).toBe(false);
    expect(isGregorianDate(x)).toBe(false);
  }
});

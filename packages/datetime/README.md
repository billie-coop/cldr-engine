# @phensley/datetime

Days, times of day and instants as plain data, with explicit time zones.

A JavaScript `Date` is an instant read in the device's time zone, so a due date stored as
`2026-01-31` becomes a different moment on every device and the wrong day on a server running
in UTC. This package keeps the kinds of value apart:

- **`Day`**: a calendar day, `{ year, month, day }`. No time, no zone. Due dates, birthdays.
- **`TimeOfDay`**: a wall clock time, `{ hour, minute, second, millis }`. No day, no zone.
  "Remind me at 9:00", an alarm.
- **`Instant`**: a moment, milliseconds since 1970 UTC (`Date.now()`). Payments, `created_at`.
- **Zone**: an IANA id such as `'America/Vancouver'`.

Day and time-of-day math is exact integer arithmetic and never touches a zone. Only a few
functions take one: they answer "what day is it there?" and "when is 9:00 there?". Daylight
saving time is handled in those functions and nowhere else.

```ts
import { dayFromString, dayAdd, dayUntil, dayToday, dayAtTime, timeOfDay, dayToString } from '@phensley/datetime';

const due = dayFromString('2026-01-31');
dayToString(dayAdd(due, { months: 1 })); // '2026-02-28' (clamped to the month end)
dayUntil(dayToday('America/Vancouver'), due); // days left, in Vancouver

// 9:00 on the due date in Tokyo, as an instant (skipped / repeated times handled like Temporal)
dayAtTime(due, timeOfDay(9), 'Asia/Tokyo');
```

Values are immutable plain objects, so they survive `JSON.stringify` and `structuredClone`.
Invalid input throws a `RangeError` (`day(2026, 2, 30)`, an unknown zone) or, for the parse
functions, returns `undefined`. Nothing rolls over silently.

## Scheduling

To schedule something at a wall clock time, store the day (or a rule that picks days), the
`TimeOfDay`, and either a zone ("9:00 Vancouver time", pinned) or nothing ("9:00 wherever I
am", floating, resolved with the device's current zone). Compute the instant with `dayAtTime`
when you need it. Don't store the computed instant as the source of truth: a daily 9:00 is not
every 24 hours across a clock change, and governments change time zone rules.

## Formatting

Locale-aware formatting is in `@phensley/cldr` (`formatDay`, `formatDayInterval`,
`formatDayRelative`, `formatTimeOfDay`, `formatInstant`, `formatInstantRelative`).

## Size

Day math alone is about 1.3 KB min+gzip. The zone functions pull in the time zone database
from `@phensley/timezone` (about 30 KB). Replace that data at runtime with `setTimeZoneData`.

See `examples/date-fns-migration` for a function-by-function table for date-fns users.

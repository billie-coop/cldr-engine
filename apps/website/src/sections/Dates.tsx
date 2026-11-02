import {
  type Day,
  dayAdd,
  dayAtTime,
  dayCompare,
  dayEndOf,
  dayFromInstant,
  dayParse,
  dayRange,
  dayStartOf,
  dayStartOfWeek,
  dayToday,
  dayToString,
  dayUntil,
  firstDayOfWeek,
  formatDay,
  formatDayInterval,
  formatDayRelative,
  formatInstant,
  formatInstantRelative,
  formatTimeOfDay,
  instantToString,
  type LocaleData,
  timeOfDay,
  timeOfDayParse,
  timeZoneOffset,
} from '@phensley/cldr';
import { useState } from 'react';
import { attempt, Example, Field, q, Section } from '../ui';

const DAY = 86400000;

/** The next day (within a year) when the zone's offset changes, if it has daylight saving. */
const nextClockChange = (zone: string, from: Day): Day | undefined => {
  const noon = (d: Day) => dayAtTime(d, timeOfDay(12), zone);
  for (let i = 0; i < 366; i++) {
    const d = dayAdd(from, { days: i });
    if (timeZoneOffset(zone, noon(d)) !== timeZoneOffset(zone, noon(d) - DAY)) {
      return d;
    }
  }
  return undefined;
};

const MonthView = ({ cldr, month, today }: { cldr: LocaleData; month: Day; today: Day }) => {
  const first = dayStartOf(month, 'month');
  const weeks = dayRange(dayStartOfWeek(first, firstDayOfWeek(cldr)), dayEndOf(month, 'month'), {
    weeks: 1,
  });
  const header = dayRange(weeks[0] as Day, dayAdd(weeks[0] as Day, { days: 6 }));
  return (
    <div className="inline-block rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-2 text-center text-sm font-medium">
        {formatDay(cldr, month, { skeleton: 'yMMMM' })}
      </div>
      <table className="text-center text-sm">
        <thead>
          <tr>
            {header.map((d) => (
              <th key={dayToString(d)} className="px-1.5 pb-1 text-xs font-normal text-zinc-500">
                {formatDay(cldr, d, { skeleton: 'EEEEEE' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={dayToString(w)}>
              {dayRange(w, dayAdd(w, { days: 6 })).map((d) => {
                const inMonth = d.month === month.month;
                const isToday = dayCompare(d, today) === 0;
                return (
                  <td
                    key={dayToString(d)}
                    className={`h-8 w-8 rounded-full ${inMonth ? '' : 'text-zinc-300 dark:text-zinc-600'} ${
                      isToday ? 'bg-indigo-600 text-white' : ''
                    }`}
                  >
                    {formatDay(cldr, d, { skeleton: 'd' })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Dates = ({ cldr, zone }: { cldr: LocaleData; zone: string }) => {
  const today = dayToday(zone);
  const [dueText, setDueText] = useState(dayToString(dayAdd(today, { days: 2 })));
  const [timeText, setTimeText] = useState('09:00');
  const due = dayParse(dueText);
  const time = timeOfDayParse(timeText);
  const z = q(zone);

  const days: [string, () => string][] = due
    ? [
        [`dayToday(${z})`, () => dayToString(today)],
        [
          `formatDay(locale, dayToday(${z}), { date: 'full' })`,
          () => formatDay(cldr, today, { date: 'full' }),
        ],
        [`due = dayParse(${q(dueText)})`, () => JSON.stringify(due)],
        [`formatDay(locale, due)`, () => formatDay(cldr, due)],
        [
          `formatDay(locale, due, { skeleton: 'MMMEd' })`,
          () => formatDay(cldr, due, { skeleton: 'MMMEd' }),
        ],
        [`dayUntil(today, due)`, () => String(dayUntil(today, due))],
        [`formatDayRelative(locale, due, today)`, () => formatDayRelative(cldr, due, today)],
        [
          `formatDayInterval(locale, today, due)`,
          () =>
            dayCompare(today, due) <= 0
              ? formatDayInterval(cldr, today, due)
              : formatDayInterval(cldr, due, today),
        ],
        [`dayToString(dayAdd(due, { months: 1 }))`, () => dayToString(dayAdd(due, { months: 1 }))],
      ]
    : [];

  const reminder = due && time ? dayAtTime(due, time, zone) : undefined;
  const schedule: [string, () => string][] =
    due && time && reminder !== undefined
      ? [
          [
            `formatTimeOfDay(locale, timeOfDayParse(${q(timeText)}))`,
            () => formatTimeOfDay(cldr, time),
          ],
          [`at = dayAtTime(due, time, ${z})`, () => String(reminder)],
          [`instantToString(at, ${z})`, () => instantToString(reminder, zone)],
          [
            `formatInstant(locale, at, ${z}, { datetime: 'medium' })`,
            () => formatInstant(cldr, reminder, zone, { datetime: 'medium' }),
          ],
          [
            `formatInstant(locale, at, 'Asia/Tokyo', { skeleton: 'MMMEdjmz' })`,
            () => formatInstant(cldr, reminder, 'Asia/Tokyo', { skeleton: 'MMMEdjmz' }),
          ],
          [
            `formatInstantRelative(locale, at, Date.now(), ${z})`,
            () => formatInstantRelative(cldr, reminder, Date.now(), zone),
          ],
        ]
      : [];

  const change = attempt(() => {
    const d = nextClockChange(zone, today);
    if (!d || !time) {
      return `${zone} has no clock change in the next year, so ${timeText} every day is exactly 24 hours apart.`;
    }
    const before = dayAtTime(dayAdd(d, { days: -1 }), time, zone);
    const after = dayAtTime(d, time, zone);
    const hours = (after - before) / 3600000;
    return `The clocks change in ${zone} on ${formatDay(cldr, d)}: ${formatTimeOfDay(cldr, time)} that day comes ${hours} hours after ${formatTimeOfDay(cldr, time)} the day before.`;
  });

  return (
    <Section
      id="dates"
      title="Days, times and zones"
      intro={
        <>
          A <code>Day</code> is a calendar date with no time or zone, so it can't shift by a day; a{' '}
          <code>TimeOfDay</code> is a wall clock time; instants are epoch milliseconds. Only a few
          functions take a zone: what day it is there (<code>dayToday</code>), and when a wall clock
          time happens there (<code>dayAtTime</code>).
        </>
      }
      controls={
        <>
          <Field label="Due date" type="date" value={dueText} onChange={setDueText} />
          <Field
            label="Reminder time"
            type="time"
            value={timeText}
            onChange={setTimeText}
            className="w-32"
          />
        </>
      }
    >
      {days.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
      {schedule.map(([code, f]) => (
        <Example key={code} code={code} result={attempt(f)} />
      ))}
      <div className="py-3 text-sm text-zinc-600 dark:text-zinc-400">{change}</div>
      <div className="flex flex-wrap gap-4 pt-3">
        <MonthView cldr={cldr} month={today} today={today} />
        {due && (due.month !== today.month || due.year !== today.year) && (
          <MonthView cldr={cldr} month={due} today={today} />
        )}
        <p className="max-w-xs self-center text-sm text-zinc-600 dark:text-zinc-400">
          The week starts on the locale's first day (<code>firstDayOfWeek(locale)</code> is{' '}
          {firstDayOfWeek(cldr)}, 1 = Sunday). The grid is <code>dayRange</code> over{' '}
          <code>dayStartOfWeek</code> in steps of a week. Today in {zone}:{' '}
          {dayToString(dayFromInstant(Date.now(), zone))}.
        </p>
      </div>
    </Section>
  );
};

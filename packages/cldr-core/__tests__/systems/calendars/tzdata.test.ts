import { defaultTimeZoneData, RawData, setTimeZoneData } from '@phensley/timezone';

// The metazone index is built on the first calendar operation and kept for the life of the
// module, so each test loads a fresh copy of the calendar code to control whether it is built
// before or after the time zone data is replaced.
const load = async () => {
  vi.resetModules();
  return import('../../../src');
};

const JAN_2024 = Date.UTC(2024, 0, 15, 12);

// Two zones with no transitions, one alias: a canonical list unrelated to the bundled one.
const CUSTOM: RawData = {
  zoneids: 'Etc/UTC|Foo/Bar',
  links: 'Zulu:0|Foo/Baz:1',
  index: '',
  zoneinfo: ['0_0_0__UTC:0:0__', `${(3600).toString(36)}_0_0_XX_FOO:0:${(3600).toString(36)}__`],
};

/**
 * Copy of the bundled data with two zones swapped in the canonical list (zone records and
 * link targets moved with them), so the data is consistent but every positional index into
 * the bundled list is wrong for those two zones.
 */
const swapped = (a: string, b: string): RawData => {
  const ids = defaultTimeZoneData.zoneids.split('|');
  const i = ids.indexOf(a);
  const j = ids.indexOf(b);
  const swap = (k: number) => (k === i ? j : k === j ? i : k);
  const zoneinfo = defaultTimeZoneData.zoneinfo.slice();
  [ids[i], ids[j]] = [ids[j], ids[i]];
  [zoneinfo[i], zoneinfo[j]] = [zoneinfo[j], zoneinfo[i]];
  const links = defaultTimeZoneData.links
    .split('|')
    .map((e) => {
      const [alias, k] = e.split(':');
      return `${alias}:${swap(Number(k))}`;
    })
    .join('|');
  return { ...defaultTimeZoneData, zoneids: ids.join('|'), links, zoneinfo };
};

afterEach(() => setTimeZoneData(defaultTimeZoneData));

const check = (c: Awaited<ReturnType<typeof load>>) => {
  let d = c.gregorianDateFromUnixEpoch(JAN_2024, 'America/New_York');
  expect(c.dateTimeZoneOffset(d)).toEqual(-18000000);
  expect(c.dateMetaZoneId(d)).toEqual('America_Eastern');
  expect(c.dateTimeZoneStableId(d)).toEqual('America/New_York');

  d = c.gregorianDateFromUnixEpoch(JAN_2024, 'Europe/London');
  expect(c.dateTimeZoneOffset(d)).toEqual(0);
  expect(c.dateMetaZoneId(d)).toEqual('GMT');
  expect(c.dateTimeZoneStableId(d)).toEqual('Europe/London');
};

test('different canonical zone list installed before first use', async () => {
  setTimeZoneData(CUSTOM);
  const c = await load();

  let d = c.gregorianDateFromUnixEpoch(0, 'Foo/Bar');
  expect(c.dateTimeZoneId(d)).toEqual('Foo/Bar');
  expect(c.dateTimeZoneOffset(d)).toEqual(3600000);
  expect(c.dateMetaZoneId(d)).toEqual('');
  expect(c.dateTimeZoneStableId(d)).toEqual('Foo/Bar');

  d = c.gregorianDateFromUnixEpoch(0, 'Etc/UTC');
  expect(c.dateTimeZoneOffset(d)).toEqual(0);
  expect(c.dateMetaZoneId(d)).toEqual('GMT');

  // Zones missing from the active data fall back to UTC, as for any unknown zone.
  d = c.gregorianDateFromUnixEpoch(0, 'America/New_York');
  expect(c.dateTimeZoneId(d)).toEqual('Etc/UTC');

  setTimeZoneData(defaultTimeZoneData);
  check(c);
});

test('reordered zone list installed before first use', async () => {
  setTimeZoneData(swapped('America/New_York', 'Europe/London'));
  const c = await load();
  check(c);

  // Restoring the bundled data gives the same answers.
  setTimeZoneData(defaultTimeZoneData);
  check(c);
});

test('reordered zone list installed after first use', async () => {
  const c = await load();
  check(c);
  setTimeZoneData(swapped('America/New_York', 'Europe/London'));
  check(c);
  setTimeZoneData(defaultTimeZoneData);
  check(c);
});

test('metazone lookups by zone id', async () => {
  setTimeZoneData(swapped('America/New_York', 'Europe/London'));
  vi.resetModules();
  const c = await import('../../../src/systems/calendars/timezone');
  expect(c.getStableTimeZoneId('america/new_york')).toEqual('America/New_York');
  expect(c.getStableTimeZoneId('Asia/Calcutta')).toEqual('Asia/Calcutta');
  expect(c.getStableTimeZoneId('Asia/Kolkata')).toEqual('Asia/Calcutta');
  expect(c.currentMetazone('Europe/London')).toEqual('GMT');
  expect(c.currentMetazone('America/New_York')).toEqual('America_Eastern');
});

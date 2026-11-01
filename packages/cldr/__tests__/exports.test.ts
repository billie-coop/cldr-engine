import {
  BuddhistDate,
  CalendarDate,
  DecimalConstants,
  GregorianDate,
  ISO8601Date,
  JapaneseDate,
  PersianDate,
  buildMessageMatcher,
  getCurrencyForRegion,
  getCurrencyFractions,
  parseMessagePattern,
  decimal,
  decimalToString,
  rational,
  rationalToDecimal,
  languageTag,
  tagLanguage,
  tagRegion,
  tagScript,
  createLocaleMatcher,
  matchLocale,
  getPluralRules,
  pluralCardinal,
  defaultMessageArgConverter,
} from '../src';

// These tests are simply to ensure that all top-level exported symbols are present and functional.

test('message matcher', () => {
  const matcher = buildMessageMatcher(['foo', 'bar'], true);
  const pattern = parseMessagePattern('a {0} b', matcher);
  expect(pattern).toEqual([
    4,
    [
      [0, 'a '],
      [1, 0],
      [0, ' b'],
    ],
  ]);
});

test('plural rules', () => {
  const rules = getPluralRules('en', 'US');

  expect(pluralCardinal(rules, DecimalConstants.ONE)).toEqual('one');
  expect(pluralCardinal(rules, decimal('5'))).toEqual('other');
});

test('currency fractions', () => {
  expect(getCurrencyFractions('AUD')).toEqual({ cashDigits: 2, cashRounding: 0, digits: 2, rounding: 0 });
  expect(getCurrencyFractions('CAD')).toEqual({ cashDigits: 2, cashRounding: 5, digits: 2, rounding: 0 });
  expect(getCurrencyFractions('JPY')).toEqual({ cashDigits: 0, cashRounding: 0, digits: 0, rounding: 0 });
  expect(getCurrencyFractions('USD')).toEqual({ cashDigits: 2, cashRounding: 0, digits: 2, rounding: 0 });
  expect(getCurrencyFractions('FOO')).toEqual({ cashDigits: 2, cashRounding: 0, digits: 2, rounding: 0 });
});

test('currency regions', () => {
  expect(getCurrencyForRegion('US')).toEqual('USD');
  expect(getCurrencyForRegion('MX')).toEqual('MXN');
  expect(getCurrencyForRegion('CA')).toEqual('CAD');
  expect(getCurrencyForRegion('JP')).toEqual('JPY');
  expect(getCurrencyForRegion('XX')).toEqual('USD');
});

test('dates', () => {
  const zoneId = 'America/Los_Angeles';
  const epoch = 1520751625000;
  const buddhist: CalendarDate = BuddhistDate.fromUnixEpoch(epoch, zoneId, 0, 0);
  expect(buddhist.year()).toEqual(2561);

  const gregorian: CalendarDate = GregorianDate.fromUnixEpoch(epoch, zoneId, 0, 0);
  expect(gregorian.year()).toEqual(2018);
  expect(gregorian.type()).toEqual('gregory');

  const japanese: CalendarDate = JapaneseDate.fromUnixEpoch(epoch, zoneId, 0, 0);
  expect(japanese.year()).toEqual(30);

  const persian: PersianDate = PersianDate.fromUnixEpoch(epoch, zoneId, 0, 0);
  expect(persian.year()).toEqual(1396);

  const iso: CalendarDate = ISO8601Date.fromUnixEpoch(epoch, zoneId, 0, 0);
  expect(iso.year()).toEqual(2018);
});

test('rational', () => {
  const r = rational('1/5');
  expect(decimalToString(rationalToDecimal(r))).toEqual('0.2');
});

// test('message arg converter', () => {});

test('language tag', () => {
  const tag = languageTag('en', undefined, 'US');
  expect(tagLanguage(tag)).toEqual('en');
  expect(tagScript(tag)).toEqual('Zzzz');
  expect(tagRegion(tag)).toEqual('US');
});

test('locale matcher', () => {
  const matcher = createLocaleMatcher('en, fr-CA');
  expect(matchLocale(matcher, 'fr').locale.id).toEqual('fr-CA');
});

test('messages', () => {
  const converter = defaultMessageArgConverter;
  expect(converter.asDecimal('1.23')).toEqual(decimal('1.23'));
});

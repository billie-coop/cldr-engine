import { UnitType } from '@phensley/cldr-types';
import {
  rational,
  rationalCompare,
  rationalMultiply,
  rationalToString,
  decimal,
  decimalToString,
} from '@phensley/decimal';
import { ANGLE, AREA, DURATION, FactorDef, UnitConversion, UnitConverter, UnitFactors } from '../src';

test('factors', () => {
  const factors: FactorDef[] = [['g-force', '9.80665', 'meter-per-square-second']];
  const map = new UnitFactors(factors);
  let c: UnitConversion;

  const f = (e: UnitConversion) => e.factors.map((x) => rationalToString(x));

  c = map.get('g-force', 'meter-per-square-second')!;
  expect(f(c)).toEqual(['9.80665 / 1']);

  c = map.get('meter-per-square-second', 'g-force')!;
  expect(f(c)).toEqual(['1 / 9.80665']);
});

test('angle', () => {
  const map = new UnitFactors(ANGLE);
  let c: UnitConversion;

  const f = (e: UnitConversion) => e.factors.map((x) => rationalToString(x));

  c = map.get('arc-second', 'arc-minute')!;
  expect(f(c)).toEqual(['1 / 60']);

  c = map.get('arc-minute', 'arc-second')!;
  expect(f(c)).toEqual(['60 / 1']);

  c = map.get('arc-second', 'degree')!;
  expect(f(c)).toEqual(['1 / 60', '1 / 60']);

  c = map.get('degree', 'arc-second')!;
  expect(f(c)).toEqual(['60 / 1', '60 / 1']);
});

test('area', () => {
  const map = new UnitFactors(AREA);
  let c: UnitConversion;

  const f = (e: UnitConversion) => e.factors.map((x) => rationalToString(x));

  c = map.get('acre', 'square-foot')!;
  expect(f(c)).toEqual(['43560 / 1']);

  c = map.get('acre', 'square-inch')!;
  expect(f(c)).toEqual(['43560 / 1', '144 / 1']);

  c = map.get('square-inch', 'acre')!;
  expect(f(c)).toEqual(['1 / 144', '1 / 43560']);

  // Caching coverage
  c = map.get('acre', 'square-foot')!;
  expect(f(c)).toEqual(['43560 / 1']);

  c = map.get('acre', 'square-foot')!;
  expect(f(c)).toEqual(['43560 / 1']);
});

test('rational factors', () => {
  let c: UnitConversion;
  const map = new UnitFactors([['foo' as UnitType, rational('2 / 1'), 'bar' as UnitType]]);

  c = map.get('foo', 'bar')!;
  expect(c.path).toEqual(['foo', 'bar']);
  expect(c.factors.length).toEqual(1);
  expect(rationalToString(c.factors[0])).toEqual('2 / 1');
});

test('duration century is 100 years (CLDR 48.2.0 convertUnits: century = 100 year)', () => {
  const map = new UnitFactors(DURATION);
  const c = map.get('century', 'year')!;
  const fac = c.factors.reduce((p, x) => rationalMultiply(p, x), rational(1));
  expect(rationalCompare(fac, '100 / 1')).toEqual(0);

  const conv = new UnitConverter();
  conv.add('duration', new UnitFactors(DURATION));
  expect(decimalToString(conv.convert('duration', decimal(1), 'century', 'second')!)).toEqual('3155695200');
  expect(decimalToString(conv.convert('duration', decimal(1), 'century', 'year')!)).toEqual('100');
  expect(decimalToString(conv.convert('duration', decimal(1), 'year', 'second')!)).toEqual('31556952');
});

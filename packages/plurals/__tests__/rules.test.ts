import { decimal } from '@phensley/decimal';
import { pluralRules, Plurals, PluralRules } from '../src';

test('missing rules', () => {
  const rules: PluralRules = pluralRules.get('xyz');
  const n = decimal('12345.678');

  let cat = rules.cardinal(n);
  expect(cat).toEqual('other');

  cat = rules.ordinal(n);
  expect(cat).toEqual('other');
});

test('constructor', () => {
  const rules: PluralRules = new Plurals().get('en');

  let cat = rules.cardinal(decimal('1'));
  expect(cat).toEqual('one');

  cat = rules.cardinal(decimal('5'));
  expect(cat).toEqual('other');
});

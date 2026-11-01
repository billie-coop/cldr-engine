/// <reference path="../../../cldr-utils/__benchmarks__/typings.d.ts" />

import { join } from 'path';
import { makeSuite, readLines } from '../../../cldr-utils/__benchmarks__/util';
import { decimal, decimalToString } from '@phensley/decimal';

export const numberFormatSuite = makeSuite('Number Format');

const CASES = readLines(join(__dirname, './numbers.txt'));

CASES.forEach((n) => {
  const parsed = decimal(n);
  numberFormatSuite.add(`format ${n}`, () => {
    decimalToString(parsed);
  });
});

import { DayPeriodType } from '@phensley/cldr-types';
import { binarySearch, Cache, cacheGet, createCache } from '@phensley/cldr-utils';

import { Bundle } from '../../resource/bundle';
import { numarray } from '../../utils/string';

import { dayPeriodKeys, dayPeriodRules } from './autogen.dayperiods';
import { PATTERN_CACHE_SIZE } from '../general/internal';

interface Rule {
  minutes: number[];
  keys: DayPeriodType[];
}

const parseRule = (raw: string): Rule => {
  const parts = raw.split('|');
  const minutes = numarray(parts[1], 36);
  const keys = numarray(parts[0]).map((n) => dayPeriodKeys[n]);
  return { keys, minutes };
};

let cache: Cache<Rule> | undefined;

/**
 * Flexible day period ('in the afternoon', ...) for the minutes of the day, using the rules for
 * the bundle's language and region.
 *
 * @internal
 */
export const flexDayPeriod = (bundle: Bundle, minutes: number): DayPeriodType | undefined => {
  const raw = dayPeriodRules[bundle.languageRegion] || dayPeriodRules[bundle.language];
  if (raw === undefined) {
    return undefined;
  }
  const rule = cacheGet(cache || (cache = createCache(parseRule, PATTERN_CACHE_SIZE)), raw);
  const i = binarySearch(rule.minutes, true, minutes);
  return rule.keys[i];
};

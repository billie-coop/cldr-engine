import { cardinalRules, ordinalRules } from './autogen.rules';
import { pluralRanges } from './autogen.ranges';
import type { PluralRules } from './rules';
import type { Rule, RuleMap } from './types';

const resolve = (r: RuleMap, language: string, region?: string): Rule[] =>
  (region ? r[`${language}-${region}`] : undefined) || r[language] || r.root;

/**
 * Get the plural rules for a given language and optional region.
 *
 * @public
 */
export const getPluralRules = (language: string, region?: string): PluralRules => ({
  cardinals: resolve(cardinalRules, language, region),
  ordinals: resolve(ordinalRules, language, region),
  ranges: pluralRanges[language] || pluralRanges.en,
});

import { Cache, cacheGet, cacheSize, createCache } from '@phensley/cldr-utils';
import { PluralRules, getPluralRules } from '@phensley/plurals';
import { buildMessageMatcher, parseMessagePattern, MessageCode, MessageMatcher } from './parser';
import { evaluateMessage, MessageArg, MessageFormatFuncMap, MessageNamedArgs } from './evaluation';
import { defaultMessageArgConverter, MessageArgConverter } from './evaluation/converter';

const DEFAULT_CACHE_SIZE = 100;

/**
 * Configures a MessageFormatter instance.
 *
 * @public
 */
export interface MessageFormatterOptions {
  /**
   * Language code, e.g. "en"
   */
  language?: string;

  /**
   * Region code. e.g. "US"
   */
  region?: string;

  /**
   * The plural rules you want to use. Otherwise it will be selected
   * using the language + region.
   */
  plurals?: PluralRules;

  /**
   * Functions to map raw arguments to the types required by the internal tags,
   * 'plural', 'select', 'selectordinal'.
   */
  converter?: MessageArgConverter;

  /**
   * Custom formatting functions.
   */
  formatters?: MessageFormatFuncMap;

  /**
   * Number of parsed messages to cache internally.
   */
  cacheSize?: number;

  /**
   * Disables the escaping of text between matching apostrophes.
   */
  disableEscapes?: boolean;
}

/**
 * Message formatter that caches parsed messages, as returned by
 * `createMessageFormatter`.
 *
 * @public
 */
export interface MessageFormatter {
  readonly plurals: PluralRules;
  readonly converter: MessageArgConverter;
  readonly formatters: MessageFormatFuncMap;
  readonly matcher: MessageMatcher;
  readonly cache: Cache<MessageCode>;
}

/**
 * Create a message formatter that parses messages on demand and caches them.
 *
 * @public
 */
export const createMessageFormatter = (options: MessageFormatterOptions = {}): MessageFormatter => {
  const formatters = options.formatters || {};
  const converter = options.converter || defaultMessageArgConverter;
  const plurals = options.plurals || getPluralRules(options.language || 'root', options.region);
  const size = options.cacheSize || DEFAULT_CACHE_SIZE;
  const matcher = buildMessageMatcher(Object.keys(formatters));
  const cache = createCache<MessageCode>((s) => parseMessagePattern(s, matcher, options.disableEscapes), size);
  return { plurals, converter, formatters, matcher, cache };
};

/**
 * Parse and evaluate the message against the given arguments. Parsed messages
 * are cached in the formatter for reuse.
 *
 * @public
 */
export const formatMessage = (
  formatter: MessageFormatter,
  message: string,
  positional: MessageArg[],
  named: MessageNamedArgs,
): string =>
  evaluateMessage(
    formatter.plurals,
    formatter.converter,
    formatter.formatters,
    cacheGet(formatter.cache, message),
    positional,
    named,
  );

/**
 * String representation of a message formatter.
 *
 * @public
 */
export const messageFormatterToString = (formatter: MessageFormatter): string =>
  `MessageFormatter(formatters=${JSON.stringify(Object.keys(formatter.formatters))} cached=${cacheSize(formatter.cache)})`;

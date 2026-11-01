import { CalendarSchema, ContextType, TimeZoneSchema } from '@phensley/cldr-types';
import { LocaleData } from '../../locale-data';
import { CalendarDate } from '../../systems/calendars';
import { ContextTransformInfo, NumberingSystem } from '../../common/private';
import { DateFormatAltOptions } from '../../common/calendars';

/**
 * All context needed for a single format operation.
 */
export interface CalendarContext<T extends CalendarDate> {
  /**
   * Calendar-specific date
   */
  date: T;

  /**
   * Resource bundle for accessing strings
   */
  bundle: LocaleData;

  // TODO: number params

  /**
   * Numbering system for formatting decimal numbers into strings
   */
  system: NumberingSystem;

  /**
   * Latin decimal digit numbering system.
   */
  latnSystem: NumberingSystem;

  /**
   * Context in which we're formatting.
   */
  context?: ContextType;

  /**
   * Context transform info.
   */
  transform: ContextTransformInfo;

  /**
   * Specify alternate fields.
   */
  alt: DateFormatAltOptions;
}

/**
 * The schema parts a calendar formatter reads: the calendar's own fields and the time zone names.
 * Format with `calendarFormat(formatter, value, ctx, nodes, first)`.
 */
export interface CalendarFormatter {
  readonly cal: CalendarSchema;
  readonly tz: TimeZoneSchema;
}

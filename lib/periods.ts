import { getIntlLocale } from '@/lib/locales';

/** Maximum length allowed for a custom date range. */
export const MAX_CUSTOM_RANGE_DAYS = 365;

/** Last.fm does not return listening time; 3.5 min is the documented fallback. */
export const DEFAULT_TRACK_DURATION_SECONDS = 210;

/** Only the most scrobbled tracks get a real duration from track.getInfo. */
export const MAX_DURATION_LOOKUPS = 50;

const MS_PER_DAY = 86_400_000;

export type PeriodKind = 'week' | 'month' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ResolvedPeriod extends DateRange {
  kind: PeriodKind;
  /** Unix seconds, ready for the Last.fm API. */
  fromUnix: number;
  toUnix: number;
}

export type RangeValidationCode =
  | 'invalid_range'
  | 'end_future'
  | 'before_registration'
  | 'range_too_long';

export interface RangeValidationIssue {
  code: RangeValidationCode;
  /** Present for `range_too_long`. */
  maxDays?: number;
  /** Present for `before_registration`. */
  registered?: Date;
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Inclusive calendar-day difference, immune to DST shifts. */
export function daysBetweenInclusive(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY) + 1;
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function getWeekRange(now: Date = new Date()): DateRange {
  return {
    from: startOfDay(addDays(now, -7)),
    to: now,
  };
}

export function getMonthRange(now: Date = new Date()): DateRange {
  return {
    from: startOfMonth(now),
    to: now,
  };
}

/**
 * Custom ranges are chosen as calendar dates (from `<input type="date">`).
 * The start is inclusive from 00:00 and the end includes the whole day, but is
 * capped at "now" so we never ask Last.fm for the future.
 */
export function getCustomRange(start: Date, end: Date, now: Date = new Date()): DateRange {
  const from = startOfDay(start);
  const endOfRange = endOfDay(end);
  const to = endOfRange.getTime() > now.getTime() ? now : endOfRange;
  return { from, to };
}

export function resolvePeriod(
  kind: PeriodKind,
  options: { now?: Date; customStart?: Date; customEnd?: Date } = {},
): ResolvedPeriod {
  const now = options.now ?? new Date();

  if (kind === 'week') {
    const range = getWeekRange(now);
    return { ...range, kind, fromUnix: toUnixSeconds(range.from), toUnix: toUnixSeconds(range.to) };
  }

  if (kind === 'month') {
    const range = getMonthRange(now);
    return { ...range, kind, fromUnix: toUnixSeconds(range.from), toUnix: toUnixSeconds(range.to) };
  }

  if (!options.customStart || !options.customEnd) {
    throw new Error('Custom periods require a start and an end date.');
  }

  const range = getCustomRange(options.customStart, options.customEnd, now);
  return { ...range, kind, fromUnix: toUnixSeconds(range.from), toUnix: toUnixSeconds(range.to) };
}

/**
 * Validates a custom range against the user's Last.fm registration date,
 * today's date and the maximum range length. Returns the first blocking issue
 * or `null` when the range is valid.
 */
export function validateCustomRange(options: {
  start: Date;
  end: Date;
  registered?: Date | null;
  now?: Date;
  maxDays?: number;
}): RangeValidationIssue | null {
  const { start, end, registered, now = new Date(), maxDays = MAX_CUSTOM_RANGE_DAYS } = options;

  if (startOfDay(start).getTime() > startOfDay(end).getTime()) {
    return { code: 'invalid_range' };
  }

  if (startOfDay(end).getTime() > startOfDay(now).getTime()) {
    return { code: 'end_future' };
  }

  if (registered && startOfDay(start).getTime() < startOfDay(registered).getTime()) {
    return { code: 'before_registration', registered };
  }

  if (daysBetweenInclusive(start, end) > maxDays) {
    return { code: 'range_too_long', maxDays };
  }

  return null;
}

/** Local `YYYY-MM-DD` string for `<input type="date">`. */
export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` as a local calendar date (not UTC). */
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateRange(range: DateRange, locale: string): string {
  const intlLocale = getIntlLocale(locale);
  const formatter = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  try {
    return formatter.formatRange(range.from, range.to);
  } catch {
    return `${formatter.format(range.from)} – ${formatter.format(range.to)}`;
  }
}

export function formatMonth(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatFullDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Human label for a period, e.g. "novembro de 2026" or "11–18 de nov. de 2026".
 * The same label is used inside the generated card, so it is entirely locale
 * driven by `Intl`.
 */
export function formatPeriodLabel(kind: PeriodKind, range: DateRange, locale: string): string {
  return kind === 'month' ? formatMonth(range.from, locale) : formatDateRange(range, locale);
}

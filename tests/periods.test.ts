import { describe, expect, it } from 'vitest';
import {
  MAX_CUSTOM_RANGE_DAYS,
  addDays,
  daysBetweenInclusive,
  formatDateInput,
  formatMonth,
  formatPeriodLabel,
  getCustomRange,
  getMonthRange,
  getWeekRange,
  parseDateInput,
  resolvePeriod,
  startOfDay,
  validateCustomRange,
} from '@/lib/periods';

// Local-time constructor: the app and its tests run in the visitor's timezone.
const NOW = new Date(2026, 10, 18, 15, 30, 0);
const REGISTERED = new Date(2019, 2, 14, 22, 10, 0);

describe('period ranges', () => {
  it('computes the last 7 days from midnight', () => {
    const range = getWeekRange(NOW);
    expect(range.from).toEqual(new Date(2026, 10, 11, 0, 0, 0, 0));
    expect(range.to).toBe(NOW);
    expect(daysBetweenInclusive(range.from, range.to)).toBe(8);
  });

  it('computes the current month from the first day at 00:00', () => {
    const range = getMonthRange(NOW);
    expect(range.from).toEqual(new Date(2026, 10, 1, 0, 0, 0, 0));
    expect(range.to).toBe(NOW);
  });

  it('resolves week, month and custom periods with unix seconds', () => {
    const week = resolvePeriod('week', { now: NOW });
    expect(week.fromUnix).toBe(Math.floor(new Date(2026, 10, 11).getTime() / 1000));
    expect(week.toUnix).toBe(Math.floor(NOW.getTime() / 1000));

    const month = resolvePeriod('month', { now: NOW });
    expect(month.fromUnix).toBe(Math.floor(new Date(2026, 10, 1).getTime() / 1000));

    const custom = resolvePeriod('custom', {
      now: NOW,
      customStart: new Date(2026, 8, 1),
      customEnd: new Date(2026, 10, 18),
    });
    expect(custom.from).toEqual(new Date(2026, 8, 1));
    expect(custom.to.getTime()).toBe(NOW.getTime());
  });

  it('caps a custom range ending today at "now"', () => {
    const range = getCustomRange(new Date(2026, 10, 1), new Date(2026, 10, 18), NOW);
    expect(range.to).toBe(NOW);
  });

  it('includes the whole final day for ranges that ended in the past', () => {
    const range = getCustomRange(new Date(2026, 9, 1), new Date(2026, 9, 3), NOW);
    expect(range.to.getHours()).toBe(23);
    expect(range.to.getMinutes()).toBe(59);
    expect(range.to.getMilliseconds()).toBe(999);
    expect(addDays(range.from, 0)).not.toBe(range.from);
  });
});

describe('custom range validation', () => {
  it('rejects a start date after the end date', () => {
    expect(
      validateCustomRange({
        start: new Date(2026, 10, 10),
        end: new Date(2026, 10, 1),
        registered: REGISTERED,
        now: NOW,
      })?.code,
    ).toBe('invalid_range');
  });

  it('rejects an end date in the future', () => {
    expect(
      validateCustomRange({
        start: new Date(2026, 10, 1),
        end: new Date(2026, 10, 19),
        registered: REGISTERED,
        now: NOW,
      })?.code,
    ).toBe('end_future');
  });

  it('allows today as the end date', () => {
    expect(
      validateCustomRange({
        start: new Date(2026, 10, 1),
        end: new Date(2026, 10, 18),
        registered: REGISTERED,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('rejects a start before the Last.fm registration date', () => {
    const issue = validateCustomRange({
      start: new Date(2019, 2, 1),
      end: new Date(2019, 2, 20),
      registered: REGISTERED,
      now: NOW,
    });
    expect(issue?.code).toBe('before_registration');
    expect(issue?.registered).toBe(REGISTERED);
  });

  it('allows starting on the registration day', () => {
    expect(
      validateCustomRange({
        start: new Date(2019, 2, 14),
        end: new Date(2019, 2, 20),
        registered: REGISTERED,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('caps the range at one year', () => {
    expect(
      validateCustomRange({
        start: new Date(2024, 0, 1),
        end: new Date(2025, 5, 1),
        registered: REGISTERED,
        now: NOW,
      })?.code,
    ).toBe('range_too_long');

    const issue = validateCustomRange({
      start: new Date(2025, 0, 1),
      end: new Date(2026, 1, 1),
      now: NOW,
    });
    expect(issue?.code).toBe('range_too_long');
    expect(issue?.maxDays).toBe(MAX_CUSTOM_RANGE_DAYS);

    expect(
      validateCustomRange({
        start: new Date(2025, 10, 19),
        end: new Date(2026, 10, 18),
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe('local date input helpers', () => {
  it('round-trips YYYY-MM-DD without timezone shifts', () => {
    const date = new Date(2026, 0, 5);
    expect(formatDateInput(date)).toBe('2026-01-05');
    expect(parseDateInput('2026-01-05')).toEqual(date);
  });

  it('supports leap days and rejects impossible dates', () => {
    expect(parseDateInput('2024-02-29')).toEqual(new Date(2024, 1, 29));
    expect(parseDateInput('2026-02-29')).toBeNull();
    expect(parseDateInput('18/11/2026')).toBeNull();
    expect(parseDateInput('2026-13-01')).toBeNull();
  });
});

describe('Intl formatting', () => {
  it('formats month labels per locale', () => {
    const range = getMonthRange(NOW);
    expect(formatMonth(range.from, 'pt')).toContain('novembro');
    expect(formatMonth(range.from, 'en')).toContain('November');
    expect(formatMonth(range.from, 'ja')).toContain('2026年11月');
  });

  it('formats week ranges per locale', () => {
    const range = getWeekRange(NOW);
    const pt = formatPeriodLabel('week', range, 'pt');
    const en = formatPeriodLabel('week', range, 'en');
    const ja = formatPeriodLabel('week', range, 'ja');

    expect(pt).toContain('11');
    expect(pt).toContain('18');
    expect(en).toContain('Nov');
    expect(ja).toContain('11');
    expect(ja).toContain('18');
  });

  it('formats minutes grouping according to the locale', () => {
    expect(new Intl.NumberFormat('pt-BR').format(4231)).toBe('4.231');
    expect(new Intl.NumberFormat('en-US').format(4231)).toBe('4,231');
    expect(new Intl.NumberFormat('de-DE').format(4231)).toBe('4.231');
  });

  it('starts days at local midnight', () => {
    expect(startOfDay(NOW)).toEqual(new Date(2026, 10, 18, 0, 0, 0, 0));
  });
});

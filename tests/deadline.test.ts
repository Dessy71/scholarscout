import { describe, expect, it } from 'vitest';
import { parseDeadlineDate, classifyDeadline, extractDeadlineFromText, extractTimezone } from '../src/core/deadline';

describe('parseDeadlineDate', () => {
  it('parses "4 November 2025"', () => {
    expect(parseDeadlineDate('Applications close on 4 November 2025 at noon')).toBe('2025-11-04');
  });
  it('parses ordinal "4th November 2025"', () => {
    expect(parseDeadlineDate('Deadline: 4th November 2025')).toBe('2025-11-04');
  });
  it('parses "November 4, 2025"', () => {
    expect(parseDeadlineDate('Due by November 4, 2025')).toBe('2025-11-04');
  });
  it('parses ISO dates', () => {
    expect(parseDeadlineDate('closes 2026-10-15')).toBe('2026-10-15');
  });
  it('parses unambiguous numeric dd/mm/yyyy', () => {
    expect(parseDeadlineDate('Deadline 25/03/2026')).toBe('2026-03-25');
  });
  it('refuses ambiguous numeric dates (never guesses)', () => {
    expect(parseDeadlineDate('Deadline 04/03/2026')).toBeNull();
  });
  it('rejects invalid dates', () => {
    expect(parseDeadlineDate('31 February 2026')).toBeNull();
  });
  it('returns null for no date', () => {
    expect(parseDeadlineDate('rolling admissions')).toBeNull();
  });
});

describe('extractDeadlineFromText', () => {
  it('finds deadline sentences with dates and timezones', () => {
    const d = extractDeadlineFromText('Some intro. Applications close on 4 November 2025 at 12:00 GMT. Other text.');
    expect(d.date).toBe('2025-11-04');
    expect(d.timezone).toBe('Etc/GMT');
    expect(d.rawText).toContain('4 November 2025');
  });
  it('keeps raw text even when no parseable date', () => {
    const d = extractDeadlineFromText('The application deadline will be announced soon.');
    expect(d.date).toBeNull();
    expect(d.rawText).toContain('deadline');
  });
  it('returns empty for irrelevant text', () => {
    const d = extractDeadlineFromText('Welcome to our beautiful campus.');
    expect(d.date).toBeNull();
    expect(d.rawText).toBeNull();
  });
});

describe('classifyDeadline', () => {
  const now = new Date('2026-08-17T10:00:00Z');
  const info = (date: string | null) => ({ date, rawText: null, timezone: null });
  it('classifies buckets correctly', () => {
    expect(classifyDeadline(info('2026-08-17'), now)).toBe('closing_today');
    expect(classifyDeadline(info('2026-08-19'), now)).toBe('closing_3_days');
    expect(classifyDeadline(info('2026-08-24'), now)).toBe('closing_7_days');
    expect(classifyDeadline(info('2026-09-10'), now)).toBe('closing_30_days');
    expect(classifyDeadline(info('2026-12-01'), now)).toBe('closing_later');
    expect(classifyDeadline(info('2026-08-16'), now)).toBe('expired');
    expect(classifyDeadline(info(null), now)).toBe('unknown');
  });
});

describe('extractTimezone', () => {
  it('maps common timezone abbreviations', () => {
    expect(extractTimezone('12:00 GMT')).toBe('Etc/GMT');
    expect(extractTimezone('5pm KST')).toBe('Asia/Seoul');
    expect(extractTimezone('no tz here')).toBeNull();
  });
});

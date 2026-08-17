import type { DeadlineBucket, DeadlineInfo } from './types';

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

const TZ_HINTS: Record<string, string> = {
  gmt: 'Etc/GMT', utc: 'Etc/UTC', bst: 'Europe/London', cet: 'Europe/Paris',
  cest: 'Europe/Paris', jst: 'Asia/Tokyo', kst: 'Asia/Seoul', aest: 'Australia/Sydney',
  est: 'America/New_York', edt: 'America/New_York', pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
};

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Parse a deadline date from free text. Conservative by design:
 *  - unambiguous named-month formats are parsed ("4 November 2025", "Nov 4, 2025")
 *  - ISO dates are parsed (2025-11-04)
 *  - ambiguous numeric formats (04/11/2025) are ONLY parsed when the day is > 12,
 *    otherwise we refuse to guess and return null.
 */
export function parseDeadlineDate(text: string): string | null {
  if (!text) return null;
  const t = text.trim();

  // ISO: 2025-11-04
  const isoM = t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoM) return iso(+isoM[1], +isoM[2], +isoM[3]);

  // "4 November 2025" / "4th November 2025"
  const dmy = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,.]?\s+(20\d{2})\b/i);
  if (dmy) {
    const m = MONTHS[dmy[2].toLowerCase()];
    if (m) return iso(+dmy[3], m, +dmy[1]);
  }

  // "November 4, 2025" / "November 4 2025"
  const mdy = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,.]?\s+(20\d{2})\b/i);
  if (mdy) {
    const m = MONTHS[mdy[1].toLowerCase()];
    if (m) return iso(+mdy[3], m, +mdy[2]);
  }

  // Numeric dd/mm/yyyy or mm/dd/yyyy — only when unambiguous (one part > 12)
  const num = t.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (num) {
    const a = +num[1], b = +num[2], y = +num[3];
    if (a > 12 && b <= 12) return iso(y, b, a); // must be dd/mm
    if (b > 12 && a <= 12) return iso(y, a, b); // must be mm/dd
    return null; // ambiguous — never guess
  }

  return null;
}

export function extractTimezone(text: string): string | null {
  if (!text) return null;
  const m = text.match(/\b(GMT|UTC|BST|CET|CEST|JST|KST|AEST|EST|EDT|PST|PDT)\b/i);
  return m ? TZ_HINTS[m[1].toLowerCase()] ?? null : null;
}

/** Find deadline-looking statements in page text and parse the nearest date. */
export function extractDeadlineFromText(text: string): DeadlineInfo {
  const empty: DeadlineInfo = { date: null, rawText: null, timezone: null };
  if (!text) return empty;
  const lines = text.split(/(?<=[.!?\n])\s+/);
  const cueRe = /(deadline|applications?\s+(close|closes|closing|must be (received|submitted))|closing date|apply\s+by|submission[s]?\s+(close|deadline)|due\s+(by|date)|no later than)/i;
  let fallback: DeadlineInfo | null = null;
  for (const line of lines) {
    if (!cueRe.test(line)) continue;
    const date = parseDeadlineDate(line);
    const raw = line.trim().replace(/\s+/g, ' ').slice(0, 220);
    if (date) return { date, rawText: raw, timezone: extractTimezone(line) };
    if (!fallback) fallback = { date: null, rawText: raw, timezone: extractTimezone(line) };
  }
  return fallback ?? empty;
}

/** Classify a deadline against "now". `now` is injected for testability. */
export function classifyDeadline(deadline: DeadlineInfo, now: Date = new Date()): DeadlineBucket {
  if (!deadline.date) return 'unknown';
  const d = new Date(deadline.date + 'T23:59:59Z');
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.floor((d.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days === 0) return 'closing_today';
  if (days <= 3) return 'closing_3_days';
  if (days <= 7) return 'closing_7_days';
  if (days <= 30) return 'closing_30_days';
  return 'closing_later';
}

export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const d = new Date(dateIso + 'T23:59:59Z');
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((d.getTime() - startOfToday.getTime()) / 86_400_000);
}

export const DEADLINE_BUCKET_LABELS: Record<DeadlineBucket, string> = {
  closing_today: 'Closing Today',
  closing_3_days: 'Closing in 3 Days',
  closing_7_days: 'Closing in 7 Days',
  closing_30_days: 'Closing in 30 Days',
  closing_later: 'Closing Later',
  expired: 'Expired',
  unknown: 'Deadline Unknown',
};

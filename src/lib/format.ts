import type { DeadlineBucket, FundingType, GhanaEligibility, AcademicFit, VerificationStatus } from '../core/types';

export { FUNDING_LABELS } from '../core/classify/funding';
export { GHANA_ELIGIBILITY_LABELS } from '../core/classify/nationality';
export { ACADEMIC_FIT_LABELS } from '../core/classify/academic';
export { TYPE_LABELS, LEVEL_LABELS } from '../core/classify/opportunityType';
export { DEADLINE_BUCKET_LABELS } from '../core/deadline';
export { TIER_LABELS } from '../core/score';

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: 'VERIFIED',
  needs_review: 'NEEDS REVIEW',
  source_unavailable: 'SOURCE UNAVAILABLE',
};

export function fundingChipClass(t: FundingType): string {
  switch (t) {
    case 'fully_funded':
    case 'fully_funded_stipend':
      return 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200';
    case 'tuition_stipend':
    case 'mostly_funded':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'partial':
    case 'tuition_waiver':
      return 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300';
    case 'travel_funded':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
    case 'unfunded':
      return 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
    default:
      return 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
  }
}

export function deadlineChipClass(b: DeadlineBucket): string {
  switch (b) {
    case 'closing_today':
    case 'closing_3_days':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'closing_7_days':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'closing_30_days':
      return 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300';
    case 'closing_later':
      return 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
    case 'expired':
      return 'bg-ink-100 text-ink-400 line-through dark:bg-ink-800 dark:text-ink-500';
    default:
      return 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
  }
}

export function ghanaChipClass(g: GhanaEligibility): string {
  switch (g) {
    case 'ghana_eligible': return 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200';
    case 'africa_eligible': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'international': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
    case 'restricted': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default: return 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
  }
}

export function academicChipClass(a: AcademicFit): string {
  switch (a) {
    case 'clearly_eligible': return 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200';
    case 'potentially_eligible': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'likely_ineligible': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default: return 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
  }
}

export function verificationChipClass(v: VerificationStatus): string {
  switch (v) {
    case 'verified': return 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200';
    case 'needs_review': return 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300';
    case 'source_unavailable': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  }
}

export function scoreColor(score: number): string {
  if (score >= 85) return 'text-brand-600 dark:text-brand-300';
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 55) return 'text-gold-600 dark:text-gold-400';
  return 'text-ink-400 dark:text-ink-500';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/** Next scheduled GitHub Actions update in Africa/Accra (UTC+0): 00:00 & 13:00. */
export function nextScheduledUpdate(now: Date = new Date()): Date {
  const candidates = [0, 13].map((h) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, 0, 0));
    if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  });
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

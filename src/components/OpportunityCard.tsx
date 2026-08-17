import React from 'react';
import { Link } from 'react-router-dom';
import type { Opportunity, ApplicationStatus } from '../core/types';
import { classifyDeadline, DEADLINE_BUCKET_LABELS, daysUntil } from '../core/deadline';
import {
  FUNDING_LABELS, GHANA_ELIGIBILITY_LABELS, ACADEMIC_FIT_LABELS, TYPE_LABELS,
  LEVEL_LABELS, VERIFICATION_LABELS, fundingChipClass, deadlineChipClass,
  ghanaChipClass, academicChipClass, verificationChipClass, formatDate, TIER_LABELS,
} from '../lib/format';
import { Chip, ScoreRing } from './ui';

interface Props {
  opportunity: Opportunity;
  status: ApplicationStatus;
  isNew?: boolean;
  isUpdated?: boolean;
  detailed?: boolean;
  onStatus: (status: ApplicationStatus) => void;
}

export function OpportunityCard({ opportunity: o, status, isNew, isUpdated, detailed = true, onStatus }: Props): React.ReactElement {
  const bucket = classifyDeadline(o.deadline);
  const days = o.deadline.date ? daysUntil(o.deadline.date) : null;

  return (
    <article className="card group relative p-5 transition-shadow hover:shadow-pop animate-fade-up" data-testid="opportunity-card">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {/* status ribbons */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {isNew && <Chip className="bg-brand-700 text-white dark:bg-brand-500">NEW</Chip>}
            {isUpdated && <Chip className="bg-sky-600 text-white">UPDATED</Chip>}
            {status === 'applied' && <Chip className="bg-gold-500 text-white">APPLIED</Chip>}
            {status === 'saved' && <Chip className="bg-ink-800 text-white dark:bg-ink-200 dark:text-ink-900">SAVED</Chip>}
            <Chip className={verificationChipClass(o.verificationStatus)} title="Where this information came from">
              {VERIFICATION_LABELS[o.verificationStatus]}
            </Chip>
          </div>

          <h3 className="font-display text-[15px] font-bold leading-snug">
            <Link to={`/opportunity/${o.id}`} className="hover:text-brand-600 dark:hover:text-brand-300">
              {o.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-500 dark:text-ink-400">
            {o.organization}
            {o.country ? ` · ${o.country}` : ''}
            {' · '}{TYPE_LABELS[o.type]}
            {' · '}{LEVEL_LABELS[o.level]}
          </p>

          {/* badges */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Chip className={fundingChipClass(o.fundingType)}>{FUNDING_LABELS[o.fundingType]}</Chip>
            <Chip className={deadlineChipClass(bucket)} title={o.deadline.rawText ?? undefined}>
              {o.deadline.date ? `${DEADLINE_BUCKET_LABELS[bucket]} · ${formatDate(o.deadline.date)}` : DEADLINE_BUCKET_LABELS[bucket]}
              {days !== null && days >= 0 && days <= 30 ? ` (${days}d)` : ''}
            </Chip>
            <Chip className={ghanaChipClass(o.ghanaEligibility)}>🇬🇭 {GHANA_ELIGIBILITY_LABELS[o.ghanaEligibility]}</Chip>
            <Chip className={academicChipClass(o.academicFit)}>🎓 {ACADEMIC_FIT_LABELS[o.academicFit]}</Chip>
          </div>

          {detailed && o.summary && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-600 dark:text-ink-300 line-clamp-3">{o.summary}</p>
          )}

          {detailed && (
            <div className="mt-3 space-y-1">
              {o.match.reasons.slice(0, 3).map((r) => (
                <div key={r} className="flex items-start gap-1.5 text-[12px] text-brand-700 dark:text-brand-300">
                  <span aria-hidden className="mt-px">✓</span><span>{r}</span>
                </div>
              ))}
              {o.match.concerns.slice(0, 2).map((c) => (
                <div key={c} className="flex items-start gap-1.5 text-[12px] text-gold-700 dark:text-gold-400">
                  <span aria-hidden className="mt-px">⚠</span><span>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* score */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <ScoreRing score={o.match.score} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            {TIER_LABELS[o.match.tier]}
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
        <Link to={`/opportunity/${o.id}`} className="btn-secondary !py-1.5 text-[13px]">Read More</Link>
        <a href={o.applicationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary !py-1.5 text-[13px]">
          Apply ↗
        </a>
        <div className="ml-auto flex gap-1">
          <button
            className={`btn-ghost !px-2.5 !py-1.5 text-[13px] ${status === 'saved' ? '!bg-ink-100 dark:!bg-ink-800' : ''}`}
            onClick={() => onStatus(status === 'saved' ? 'none' : 'saved')}
            aria-pressed={status === 'saved'}
          >
            {status === 'saved' ? '★ Saved' : '☆ Save'}
          </button>
          <button
            className={`btn-ghost !px-2.5 !py-1.5 text-[13px] ${status === 'applied' ? '!bg-gold-100 dark:!bg-gold-900/40' : ''}`}
            onClick={() => onStatus(status === 'applied' ? 'none' : 'applied')}
            aria-pressed={status === 'applied'}
          >
            {status === 'applied' ? '✓ Applied' : 'Mark Applied'}
          </button>
          <button
            className="btn-ghost !px-2.5 !py-1.5 text-[13px]"
            onClick={() => onStatus(status === 'hidden' ? 'none' : 'hidden')}
            aria-pressed={status === 'hidden'}
          >
            {status === 'hidden' ? 'Unhide' : 'Hide'}
          </button>
        </div>
      </div>
    </article>
  );
}

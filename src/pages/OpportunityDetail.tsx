import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppState } from '../lib/appState';
import { classifyDeadline } from '../core/deadline';
import {
  FUNDING_LABELS, GHANA_ELIGIBILITY_LABELS, ACADEMIC_FIT_LABELS, TYPE_LABELS,
  LEVEL_LABELS, VERIFICATION_LABELS, DEADLINE_BUCKET_LABELS,
  fundingChipClass, deadlineChipClass, ghanaChipClass, academicChipClass,
  verificationChipClass, formatDate, formatDateTime, TIER_LABELS,
} from '../lib/format';
import { classifyAcademic } from '../core/classify/academic';
import { Chip, ScoreRing, EmptyState } from '../components/ui';

export function OpportunityDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { dataset, saved, setStatus } = useAppState();
  const o = dataset.opportunities.find((x) => x.id === id);

  if (!o) {
    return (
      <EmptyState
        icon="🧭"
        title="Opportunity not found"
        message="It may have been removed from the dataset or the link is outdated."
        action={<Link to="/" className="btn-primary">Back to dashboard</Link>}
      />
    );
  }

  const status = saved[o.id]?.status ?? 'none';
  const bucket = classifyDeadline(o.deadline);
  const history = dataset.changes.filter((c) => c.opportunityId === o.id);
  const interpretation = classifyAcademic(o.academicRequirement ?? '').interpretation;

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-fade-up">
      <Link to="/" className="text-[13px] font-semibold text-brand-600 hover:underline dark:text-brand-300">← Back to dashboard</Link>

      <header className="card p-6">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Chip className={verificationChipClass(o.verificationStatus)}>{VERIFICATION_LABELS[o.verificationStatus]}</Chip>
              <Chip className="bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{TYPE_LABELS[o.type]}</Chip>
              <Chip className="bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{LEVEL_LABELS[o.level]}</Chip>
            </div>
            <h1 className="font-display text-2xl font-extrabold leading-tight">{o.title}</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {o.organization}{o.university ? ` · ${o.university}` : ''}{o.country ? ` · ${o.country}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip className={fundingChipClass(o.fundingType)}>{FUNDING_LABELS[o.fundingType]}</Chip>
              <Chip className={deadlineChipClass(bucket)}>{o.deadline.date ? `${DEADLINE_BUCKET_LABELS[bucket]} · ${formatDate(o.deadline.date)}` : DEADLINE_BUCKET_LABELS[bucket]}</Chip>
              <Chip className={ghanaChipClass(o.ghanaEligibility)}>🇬🇭 {GHANA_ELIGIBILITY_LABELS[o.ghanaEligibility]}</Chip>
              <Chip className={academicChipClass(o.academicFit)}>🎓 {ACADEMIC_FIT_LABELS[o.academicFit]}</Chip>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <ScoreRing score={o.match.score} size={64} />
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{TIER_LABELS[o.match.tier]}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
          <a href={o.applicationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">Apply on Official Site ↗</a>
          <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">View Source Page ↗</a>
          <div className="ml-auto flex gap-1.5">
            <button className="btn-secondary" onClick={() => setStatus(o.id, status === 'saved' ? 'none' : 'saved')}>{status === 'saved' ? '★ Saved' : '☆ Save'}</button>
            <button className="btn-secondary" onClick={() => setStatus(o.id, status === 'applied' ? 'none' : 'applied')}>{status === 'applied' ? '✓ Applied' : 'Mark Applied'}</button>
            <button className="btn-ghost" onClick={() => setStatus(o.id, status === 'hidden' ? 'none' : 'hidden')}>{status === 'hidden' ? 'Unhide' : 'Hide'}</button>
          </div>
        </div>
      </header>

      {o.summary && (
        <Section title="Programme Summary">
          <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{o.summary}</p>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section title="Funding">
          <Detail label="Classification" value={FUNDING_LABELS[o.fundingType]} />
          <Detail label="Details from source" value={o.fundingDetails ?? 'Not stated by the source — verify on the official page.'} quote={!!o.fundingDetails} />
        </Section>

        <Section title="Deadline & Duration">
          <Detail label="Deadline" value={o.deadline.date ? `${formatDate(o.deadline.date)}${o.deadline.timezone ? ` (${o.deadline.timezone})` : ''}` : 'Not confirmed by the source'} />
          {o.deadline.rawText && <Detail label="Exact wording" value={o.deadline.rawText} quote />}
          <Detail label="Duration" value={o.duration ?? 'Not stated'} />
          <Detail label="Start date" value={o.startDate ?? 'Not stated'} />
        </Section>

        <Section title="Nationality Eligibility">
          <Detail label="Ghana eligibility" value={GHANA_ELIGIBILITY_LABELS[o.ghanaEligibility]} />
          <Detail label="Source wording" value={o.nationalityRequirement ?? 'The source text does not establish nationality eligibility. Do not assume eligibility — check the official page.'} quote={!!o.nationalityRequirement} />
        </Section>

        <Section title="Academic Requirements">
          <Detail label="Classification" value={ACADEMIC_FIT_LABELS[o.academicFit]} />
          <Detail label="Exact requirement (from source)" value={o.academicRequirement ?? 'No academic threshold stated by the source.'} quote={!!o.academicRequirement} />
          {interpretation && <Detail label="Interpretation (ScholarScout — not the source)" value={interpretation} />}
        </Section>
      </div>

      <Section title={`Why this scores ${o.match.score}/100`}>
        <div className="space-y-2.5">
          {o.match.breakdown.map((b) => (
            <div key={b.key}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-semibold">{b.label}</span>
                <span className="font-mono text-[12px] text-ink-500 dark:text-ink-400">{b.earned}/{b.weight}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(b.earned / b.weight) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-[12px] text-ink-400 dark:text-ink-500">{b.reason}</p>
            </div>
          ))}
        </div>
        {o.match.concerns.length > 0 && (
          <div className="mt-4 rounded-lg bg-gold-50 p-3 dark:bg-gold-950/40">
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-gold-700 dark:text-gold-400">Potential concerns</h4>
            <ul className="mt-1.5 space-y-1 text-[13px] text-gold-800 dark:text-gold-300">
              {o.match.concerns.map((c) => <li key={c}>⚠ {c}</li>)}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Source & Verification">
        <Detail label="Source" value={o.sourceName} />
        <Detail label="Source URL" value={<a className="break-all text-brand-600 hover:underline dark:text-brand-300" href={o.sourceUrl} target="_blank" rel="noopener noreferrer">{o.sourceUrl}</a>} />
        <Detail label="Verification status" value={VERIFICATION_LABELS[o.verificationStatus]} />
        <Detail label="First discovered" value={formatDateTime(o.discoveredAt)} />
        <Detail label="Last verified" value={o.lastVerifiedAt ? formatDateTime(o.lastVerifiedAt) : 'Not yet verified'} />
      </Section>

      <Section title="Update History">
        {history.length === 0 ? (
          <p className="text-[13px] text-ink-400">No changes recorded since discovery.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((h, i) => (
              <li key={i} className="rounded-lg bg-ink-50 p-3 text-[13px] dark:bg-ink-950">
                <div className="font-semibold">{formatDateTime(h.changedAt)}</div>
                <ul className="mt-1 space-y-0.5 text-ink-500 dark:text-ink-400">
                  {h.changedFields.map((f) => (
                    <li key={f.field}><strong>{f.field}</strong>: {f.from ?? '—'} → {f.to ?? '—'}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="card p-5">
      <h2 className="section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, value, quote }: { label: string; value: React.ReactNode; quote?: boolean }): React.ReactElement {
  return (
    <div className="mb-2.5 last:mb-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">{label}</dt>
      <dd className={`mt-0.5 text-[13px] leading-relaxed ${quote ? 'border-l-2 border-brand-300 pl-2 italic text-ink-600 dark:border-brand-700 dark:text-ink-300' : 'text-ink-700 dark:text-ink-200'}`}>
        {quote ? <>“{value}”</> : value}
      </dd>
    </div>
  );
}

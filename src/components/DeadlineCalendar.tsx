import React from 'react';
import { Link } from 'react-router-dom';
import type { Opportunity } from '../core/types';
import { classifyDeadline, daysUntil } from '../core/deadline';
import { formatDate, deadlineChipClass } from '../lib/format';
import { Chip } from './ui';

export function DeadlineCalendar({ opportunities }: { opportunities: Opportunity[] }): React.ReactElement {
  const upcoming = opportunities
    .filter((o) => o.deadline.date && classifyDeadline(o.deadline) !== 'expired')
    .sort((a, b) => (a.deadline.date! < b.deadline.date! ? -1 : 1))
    .slice(0, 10);

  return (
    <section className="card p-4" aria-label="Upcoming deadlines">
      <h2 className="section-title mb-3">📅 Deadline Calendar</h2>
      {upcoming.length === 0 ? (
        <p className="text-[13px] text-ink-400">No confirmed upcoming deadlines yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {upcoming.map((o) => {
            const days = daysUntil(o.deadline.date!);
            const bucket = classifyDeadline(o.deadline);
            return (
              <li key={o.id} className="flex items-start gap-2.5">
                <Chip className={`${deadlineChipClass(bucket)} mt-0.5 shrink-0 font-mono`}>
                  {days === 0 ? 'TODAY' : `${days}d`}
                </Chip>
                <div className="min-w-0">
                  <Link to={`/opportunity/${o.id}`} className="block truncate text-[13px] font-semibold hover:text-brand-600 dark:hover:text-brand-300">
                    {o.title}
                  </Link>
                  <span className="text-[11px] text-ink-400">{formatDate(o.deadline.date)}{o.deadline.timezone ? ` · ${o.deadline.timezone}` : ''}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

import React, { useState } from 'react';
import { useAppState } from '../lib/appState';
import { OpportunityCard } from '../components/OpportunityCard';
import { EmptyState } from '../components/ui';

export function SavedPage(): React.ReactElement {
  const { dataset, saved, setStatus } = useAppState();
  const [tab, setTab] = useState<'saved' | 'applied' | 'hidden'>('saved');

  const list = dataset.opportunities.filter((o) => saved[o.id]?.status === tab)
    .sort((a, b) => b.match.score - a.match.score);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Saved & Applied</h1>
      <div className="flex gap-1.5" role="tablist">
        {(['saved', 'applied', 'hidden'] as const).map((t) => (
          <button
            key={t} role="tab" aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize ${
              tab === t ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900' : 'bg-white text-ink-500 border border-ink-100 dark:bg-ink-900 dark:border-ink-800 dark:text-ink-400'
            }`}
          >
            {t} ({dataset.opportunities.filter((o) => saved[o.id]?.status === t).length})
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={tab === 'saved' ? '⭐' : tab === 'applied' ? '📨' : '🙈'}
          title={`Nothing ${tab} yet`}
          message={
            tab === 'saved' ? 'Save opportunities from the dashboard to build your application shortlist.'
              : tab === 'applied' ? 'Mark opportunities as applied to track your submissions here.'
              : 'Opportunities you hide will land here so you can restore them.'
          }
        />
      ) : (
        <div className="space-y-4">
          {list.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} status={saved[o.id]?.status ?? 'none'} onStatus={(s) => setStatus(o.id, s)} />
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { useAppState } from '../lib/appState';
import { Chip, EmptyState } from '../components/ui';
import { relativeTime } from '../lib/format';

export function SourcesPage(): React.ReactElement {
  const { sources, dataset } = useAppState();

  const countBySource = new Map<string, number>();
  for (const o of dataset.opportunities) {
    countBySource.set(o.sourceId, (countBySource.get(o.sourceId) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Source Registry</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {sources.filter((s) => s.active).length} active of {sources.length} sources · edit <code className="rounded bg-ink-100 px-1 py-0.5 text-[12px] dark:bg-ink-800">data/sources.json</code> to add or toggle sources
        </p>
      </div>

      {sources.length === 0 ? (
        <EmptyState icon="🗂️" title="No sources loaded" message="The source registry (data/sources.json) is empty or not yet deployed." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sources.map((s) => (
            <article key={s.id} className={`card p-4 ${!s.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[15px] font-bold">{s.name}</h2>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[12px] text-brand-600 hover:underline dark:text-brand-300">{s.url}</a>
                </div>
                <Chip className={s.active ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'}>
                  {s.active ? 'ACTIVE' : 'INACTIVE'}
                </Chip>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip className="bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{s.sourceType.replace('_', ' ')}</Chip>
                <Chip className="bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">parser: {s.parser}</Chip>
                <Chip className={s.trust === 'official' ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300'}>
                  {s.trust}
                </Chip>
                {s.country && <Chip className="bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{s.country}</Chip>}
                <Chip className={
                  s.robotsStatus === 'allowed' ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200'
                    : s.robotsStatus === 'disallowed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                }>
                  robots: {s.robotsStatus}
                </Chip>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-ink-500 dark:text-ink-400">
                <div><dt className="inline font-semibold">Last checked: </dt><dd className="inline">{relativeTime(s.lastChecked)}</dd></div>
                <div><dt className="inline font-semibold">Last success: </dt><dd className="inline">{relativeTime(s.lastSuccess)}</dd></div>
                <div><dt className="inline font-semibold">Failures: </dt><dd className={`inline ${s.failureCount > 0 ? 'text-red-500' : ''}`}>{s.failureCount}</dd></div>
                <div><dt className="inline font-semibold">Opportunities: </dt><dd className="inline">{countBySource.get(s.id) ?? 0}</dd></div>
              </dl>

              {s.notes && <p className="mt-2 text-[12px] italic text-ink-400 dark:text-ink-500">{s.notes}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

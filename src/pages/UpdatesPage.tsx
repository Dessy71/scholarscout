import React from 'react';
import { useAppState } from '../lib/appState';
import { EmptyState, Chip } from '../components/ui';
import { formatDateTime, nextScheduledUpdate } from '../lib/format';

export function UpdatesPage(): React.ReactElement {
  const { runs } = useAppState();
  const next = nextScheduledUpdate();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Update History</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Automatic updates run at <strong>00:00</strong> and <strong>13:00</strong> Africa/Accra via GitHub Actions ·
          next: <strong>{formatDateTime(next.toISOString())} GMT</strong>
        </p>
      </div>

      {runs.length === 0 ? (
        <EmptyState icon="🕐" title="No update runs yet" message="Run `npm run ingest` locally, trigger the GitHub Actions workflow, or press Update Now." />
      ) : (
        <div className="space-y-3">
          {runs.map((r) => (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip className={
                  r.status === 'completed' ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200'
                    : r.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300'
                }>
                  {r.status}
                </Chip>
                <Chip className="bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{r.trigger.replace('_', ' ')}</Chip>
                <span className="text-[13px] font-semibold">{formatDateTime(r.startedAt)}</span>
                {r.completedAt && (
                  <span className="text-[12px] text-ink-400">
                    · took {Math.max(1, Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000))}s
                  </span>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                {([
                  ['Sources', r.sourcesChecked], ['Pages', r.pagesFetched], ['Found', r.opportunitiesFound],
                  ['New', r.newItems], ['Updated', r.updatedItems], ['Rejected', r.rejectedItems],
                ] as [string, number][]).map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-ink-50 px-2 py-1.5 dark:bg-ink-950">
                    <dt className="text-[10px] uppercase tracking-wide text-ink-400">{label}</dt>
                    <dd className="font-display text-lg font-bold">{v}</dd>
                  </div>
                ))}
              </dl>

              {r.sourceResults.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[12px] font-semibold text-brand-600 dark:text-brand-300">
                    Source details ({r.sourceResults.filter((s) => s.status === 'success').length} ok / {r.sourceResults.filter((s) => s.status === 'failed').length} failed)
                  </summary>
                  <ul className="mt-2 space-y-1 text-[12px]">
                    {r.sourceResults.map((sr) => (
                      <li key={sr.sourceId} className="flex justify-between gap-2">
                        <span className="truncate">{sr.sourceName}</span>
                        <span className={sr.status === 'success' ? 'text-brand-600 dark:text-brand-300' : sr.status === 'failed' ? 'text-red-500' : 'text-ink-400'}>
                          {sr.status === 'success' ? `✓ ${sr.found} found (${sr.fetchedPages}p)` : sr.status === 'failed' ? `✗ ${sr.error}` : sr.status.replace('skipped_', 'skipped: ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {r.errors.length > 0 && (
                <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {r.errors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useRef, useState } from 'react';
import type { Dataset, UpdateRun } from '../core/types';
import { useAppState } from '../lib/appState';

type Stage = 'idle' | 'confirm' | 'running' | 'done' | 'error';

/**
 * UPDATE NOW — runs the shared ingestion pipeline via the serverless
 * /api/update endpoint and merges the fresh dataset into the dashboard
 * immediately. A module-level lock prevents simultaneous manual updates.
 */
let updateInFlight = false;

export function UpdateNowButton(): React.ReactElement {
  const { applyRunResult, refreshData } = useAppState();
  const [stage, setStage] = useState<Stage>('idle');
  const [run, setRun] = useState<UpdateRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const start = useCallback(async () => {
    if (updateInFlight) return;
    updateInFlight = true;
    setStage('running');
    setError(null);
    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        const msg = [body.error, body.detail].filter(Boolean).join(' — ');
        throw new Error(msg || `Update failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { run: UpdateRun; dataset: Dataset; workflowDispatched: boolean };
      setRun(data.run);
      setDispatched(data.workflowDispatched);
      applyRunResult(data.run, data.dataset);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setStage('error');
      // still refresh static data in case a scheduled run landed meanwhile
      void refreshData();
    } finally {
      updateInFlight = false;
    }
  }, [applyRunResult, refreshData]);

  const close = () => { setStage('idle'); setRun(null); setError(null); };

  return (
    <>
      <button
        className="btn-primary relative"
        onClick={() => setStage('confirm')}
        disabled={stage === 'running'}
        data-testid="update-now"
      >
        {stage === 'running' ? (
          <>
            <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-white" aria-hidden />
            Updating…
          </>
        ) : (
          <>⟳ Update Now</>
        )}
      </button>

      {stage !== 'idle' && stage !== 'running' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 animate-fade-in" role="dialog" aria-modal="true" ref={dialogRef}>
          <div className="card w-full max-w-lg p-6 animate-fade-up">
            {stage === 'confirm' && (
              <>
                <h3 className="font-display text-lg font-bold">Run an update now?</h3>
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
                  ScholarScout will check the active sources respectfully (robots.txt honoured, rate-limited)
                  and refresh your feed. You can keep using the dashboard while it runs.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={close}>Cancel</button>
                  <button className="btn-primary" onClick={() => void start()} data-testid="confirm-update">Start Update</button>
                </div>
              </>
            )}

            {stage === 'done' && run && (
              <>
                <h3 className="font-display text-lg font-bold">✅ Update complete</h3>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <Stat label="Sources checked" value={run.sourcesChecked} />
                  <Stat label="Pages fetched" value={run.pagesFetched} />
                  <Stat label="Discovered" value={run.opportunitiesFound} />
                  <Stat label="New" value={run.newItems} accent />
                  <Stat label="Updated" value={run.updatedItems} />
                  <Stat label="Rejected" value={run.rejectedItems} />
                </dl>

                <div className="mt-4 max-h-44 space-y-1 overflow-y-auto rounded-lg bg-ink-50 p-3 text-[12px] dark:bg-ink-950">
                  {run.sourceResults.map((sr) => (
                    <div key={sr.sourceId} className="flex items-center justify-between gap-2">
                      <span className="truncate">{sr.sourceName}</span>
                      <span className={
                        sr.status === 'success' ? 'text-brand-600 dark:text-brand-300'
                          : sr.status === 'failed' ? 'text-red-600 dark:text-red-400'
                          : 'text-ink-400'
                      }>
                        {sr.status === 'success' ? `✓ ${sr.found} found` : sr.status === 'failed' ? `✗ ${sr.error}` : sr.status.replace('skipped_', 'skipped: ')}
                      </span>
                    </div>
                  ))}
                </div>

                {run.errors.length > 0 && (
                  <p className="mt-3 text-[12px] text-gold-700 dark:text-gold-400">
                    {run.errors.length} source error(s) — other sources completed normally.
                  </p>
                )}
                {dispatched && (
                  <p className="mt-2 text-[12px] text-ink-400">
                    A full GitHub Actions crawl was also dispatched; the committed dataset will refresh shortly.
                  </p>
                )}
                <div className="mt-5 flex justify-end">
                  <button className="btn-primary" onClick={close}>Done</button>
                </div>
              </>
            )}

            {stage === 'error' && (
              <>
                <h3 className="font-display text-lg font-bold text-red-600 dark:text-red-400">Update failed</h3>
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{error}</p>
                <p className="mt-2 text-[12px] text-ink-400">
                  Tip: when running the site locally without <code>vercel dev</code>, the /api/update endpoint isn't
                  available — use <code>npm run ingest</code> instead, or rely on the scheduled GitHub Actions runs.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={close}>Close</button>
                  <button className="btn-primary" onClick={() => void start()}>Retry</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }): React.ReactElement {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className={`font-display text-xl font-bold ${accent ? 'text-brand-600 dark:text-brand-300' : ''}`}>{value}</dd>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppState } from '../lib/appState';
import { applyFilters, EMPTY_FILTERS, isNew, type FilterState } from '../lib/filters';
import { classifyDeadline } from '../core/deadline';
import { OpportunityCard } from '../components/OpportunityCard';
import { FiltersPanel } from '../components/FiltersPanel';
import { DeadlineCalendar } from '../components/DeadlineCalendar';
import { EmptyState, ErrorState, SkeletonCard, StatCard } from '../components/ui';

type Tab = 'all' | 'strong' | 'fully_funded' | 'closing_soon' | 'new' | 'check_eligibility';

export function Dashboard(): React.ReactElement {
  const { loading, loadError, dataset, profile, saved, refreshData, setStatus } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS, query: searchParams.get('q') ?? '' });
  const [tab, setTab] = useState<Tab>('all');
  const [showFilters, setShowFilters] = useState(false);

  const urlQuery = searchParams.get('q') ?? '';
  // keep local search in sync with header search
  React.useEffect(() => {
    setFilters((f) => (f.query === urlQuery ? f : { ...f, query: urlQuery }));
  }, [urlQuery]);

  const changedIds = useMemo(
    () => new Set(dataset.changes.slice(0, 100).map((c) => c.opportunityId)),
    [dataset.changes],
  );

  const filtered = useMemo(
    () => applyFilters(dataset.opportunities, filters, profile, saved, changedIds),
    [dataset.opportunities, filters, profile, saved, changedIds],
  );

  const separateUncertain = profile.uncertainEligibility === 'separate_section';

  const view = useMemo(() => {
    let list = filtered;
    switch (tab) {
      case 'strong': list = list.filter((o) => o.match.score >= 70); break;
      case 'fully_funded': list = list.filter((o) => ['fully_funded', 'fully_funded_stipend', 'tuition_stipend'].includes(o.fundingType)); break;
      case 'closing_soon': list = list.filter((o) => ['closing_today', 'closing_3_days', 'closing_7_days'].includes(classifyDeadline(o.deadline))); break;
      case 'new': list = list.filter((o) => isNew(o)); break;
      case 'check_eligibility': list = list.filter((o) => o.ghanaEligibility === 'unknown'); break;
    }
    if (separateUncertain && tab !== 'check_eligibility') {
      list = list.filter((o) => o.ghanaEligibility !== 'unknown');
    }
    return list;
  }, [filtered, tab, separateUncertain]);

  const stats = useMemo(() => {
    const active = dataset.opportunities.filter((o) => classifyDeadline(o.deadline) !== 'expired' && (saved[o.id]?.status ?? 'none') !== 'hidden');
    return {
      strong: active.filter((o) => o.match.score >= 70).length,
      fullyFunded: active.filter((o) => ['fully_funded', 'fully_funded_stipend', 'tuition_stipend'].includes(o.fundingType)).length,
      closingSoon: active.filter((o) => ['closing_today', 'closing_3_days', 'closing_7_days'].includes(classifyDeadline(o.deadline))).length,
      newToday: active.filter((o) => isNew(o)).length,
      saved: Object.values(saved).filter((s) => s.status === 'saved').length,
    };
  }, [dataset.opportunities, saved]);

  if (loadError) {
    return <ErrorState title="Could not load your data" message={loadError} onRetry={() => void refreshData()} />;
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'all', label: 'All Matches' },
    { key: 'strong', label: 'Strong Matches', count: stats.strong },
    { key: 'fully_funded', label: 'Fully Funded', count: stats.fullyFunded },
    { key: 'closing_soon', label: 'Closing Soon', count: stats.closingSoon },
    { key: 'new', label: 'New', count: stats.newToday },
    ...(separateUncertain ? [{ key: 'check_eligibility' as Tab, label: 'Check Eligibility' }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Your best opportunities today
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            {loading ? 'Loading intelligence…' : `${stats.strong} strong match${stats.strong === 1 ? '' : 'es'} · prioritized for a Ghanaian CS graduate with a 2:2`}
          </p>
        </div>
        <button className="btn-secondary lg:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          {showFilters ? 'Hide Filters' : 'Filters'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Strong Matches" value={loading ? '…' : stats.strong} tone="brand" />
        <StatCard label="Fully Funded" value={loading ? '…' : stats.fullyFunded} tone="brand" />
        <StatCard label="Closing Soon" value={loading ? '…' : stats.closingSoon} tone={stats.closingSoon > 0 ? 'red' : 'default'} />
        <StatCard label="New (48h)" value={loading ? '…' : stats.newToday} tone="gold" />
        <StatCard label="Saved" value={loading ? '…' : stats.saved} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Opportunity views">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  tab === t.key
                    ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900'
                    : 'bg-white text-ink-500 hover:text-ink-900 dark:bg-ink-900 dark:text-ink-400 dark:hover:text-ink-100 border border-ink-100 dark:border-ink-800'
                }`}
              >
                {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          {/* Feed */}
          {loading ? (
            <div className="space-y-4">
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : view.length === 0 ? (
            <EmptyState
              icon={dataset.opportunities.length === 0 ? '🛰️' : '🎯'}
              title={dataset.opportunities.length === 0 ? 'No data yet' : 'No opportunities match this view'}
              message={
                dataset.opportunities.length === 0
                  ? 'Run your first update (Update Now above, or `npm run ingest` locally) and the discovery engine will populate your feed from the source registry.'
                  : 'Try loosening a filter, switching tabs, or lowering the minimum match score.'
              }
            />
          ) : (
            <div className="space-y-4" data-testid="feed">
              {view.map((o) => (
                <OpportunityCard
                  key={o.id}
                  opportunity={o}
                  status={saved[o.id]?.status ?? 'none'}
                  isNew={isNew(o)}
                  isUpdated={changedIds.has(o.id)}
                  detailed={profile.detailPreference !== 'quick'}
                  onStatus={(s) => setStatus(o.id, s)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Secondary panel */}
        <aside className={`space-y-5 ${showFilters ? 'block' : 'hidden'} lg:block`}>
          <FiltersPanel filters={filters} onChange={(f) => { setFilters(f); if (f.query !== urlQuery) setSearchParams(f.query ? { q: f.query } : {}); }} opportunities={dataset.opportunities} />
          <DeadlineCalendar opportunities={filtered} />
        </aside>
      </div>
    </div>
  );
}


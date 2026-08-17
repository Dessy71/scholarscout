import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  Dataset, Opportunity, SavedOpportunity, Source, UpdateRun, UserProfile, ApplicationStatus,
} from '../core/types';
import { DEFAULT_PROFILE } from '../core/profileDefaults';
import { computeMatch } from '../core/score';

/**
 * App state:
 *  - dataset/sources/runs are read from repository-backed JSON served as
 *    static assets (/data/*.json) — free reads, updated by GitHub Actions.
 *  - profile + saved/hidden/applied live in localStorage, seeded from the
 *    repository profile.json so preferences survive browser resets and sync
 *    via the repo (the committed profile acts as the durable copy).
 */

const LS_PROFILE = 'scholarscout.profile';
const LS_SAVED = 'scholarscout.saved';
const LS_THEME = 'scholarscout.theme';
const LS_SEEN = 'scholarscout.lastSeenAt';

export interface AppState {
  loading: boolean;
  loadError: string | null;
  dataset: Dataset;
  sources: Source[];
  runs: UpdateRun[];
  profile: UserProfile;
  saved: Record<string, SavedOpportunity>;
  theme: 'light' | 'dark';
  lastSeenAt: string | null;
  setTheme(t: 'light' | 'dark'): void;
  saveProfile(p: UserProfile): void;
  setStatus(oppId: string, status: ApplicationStatus, notes?: string): void;
  applyRunResult(run: UpdateRun, dataset: Dataset): void;
  refreshData(): Promise<void>;
  rescore(): void;
}

const Ctx = createContext<AppState | null>(null);

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

export function AppStateProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<Dataset>({ generatedAt: new Date(0).toISOString(), opportunities: [], changes: [] });
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<UpdateRun[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => loadLocal(LS_PROFILE, DEFAULT_PROFILE));
  const [saved, setSaved] = useState<Record<string, SavedOpportunity>>(() => loadLocal(LS_SAVED, {}));
  const [theme, setThemeState] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const [lastSeenAt] = useState<string | null>(() => loadLocal<string | null>(LS_SEEN, null));

  const refreshData = useCallback(async () => {
    setLoadError(null);
    try {
      const [ds, src, rn, repoProfile] = await Promise.all([
        fetchJson<Dataset>('/data/opportunities.json', { generatedAt: new Date(0).toISOString(), opportunities: [], changes: [] }),
        fetchJson<{ sources: Source[] }>('/data/sources.json', { sources: [] }),
        fetchJson<{ runs: UpdateRun[] }>('/data/runs.json', { runs: [] }),
        fetchJson<UserProfile | null>('/data/profile.json', null),
      ]);
      setDataset(ds);
      setSources(src.sources);
      setRuns(rn.runs);
      // Seed profile from the repo copy on first ever visit only.
      const local = loadLocal<UserProfile | null>(LS_PROFILE, null);
      if (!local && repoProfile) {
        setProfile(repoProfile);
        saveLocal(LS_PROFILE, repoProfile);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshData();
      setLoading(false);
      saveLocal(LS_SEEN, new Date().toISOString());
    })();
  }, [refreshData]);

  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    try { localStorage.setItem(LS_THEME, t); } catch { /* ignore */ }
  }, []);

  const saveProfile = useCallback((p: UserProfile) => {
    const next = { ...p, updatedAt: new Date().toISOString() };
    setProfile(next);
    saveLocal(LS_PROFILE, next);
  }, []);

  const setStatus = useCallback((oppId: string, status: ApplicationStatus, notes = '') => {
    setSaved((prev) => {
      const next = { ...prev };
      if (status === 'none') delete next[oppId];
      else next[oppId] = { opportunityId: oppId, status, savedAt: new Date().toISOString(), notes };
      saveLocal(LS_SAVED, next);
      return next;
    });
  }, []);

  const applyRunResult = useCallback((run: UpdateRun, ds: Dataset) => {
    setRuns((prev) => [run, ...prev]);
    setDataset(ds);
  }, []);

  /** Rescore all opportunities against the current profile (client-side). */
  const rescore = useCallback(() => {
    setDataset((prev) => ({
      ...prev,
      opportunities: prev.opportunities.map((o: Opportunity) => ({
        ...o,
        match: computeMatch({
          ghanaEligibility: o.ghanaEligibility,
          fundingType: o.fundingType,
          academicFit: o.academicFit,
          fields: o.fields,
          environmental: o.environmental,
          country: o.country,
          region: o.region,
          deadlineDate: o.deadline.date,
          type: o.type,
          verificationStatus: o.verificationStatus,
          title: o.title,
          summary: o.summary,
        }, loadLocal(LS_PROFILE, DEFAULT_PROFILE)),
      })),
    }));
  }, []);

  const value = useMemo<AppState>(() => ({
    loading, loadError, dataset, sources, runs, profile, saved, theme, lastSeenAt,
    setTheme, saveProfile, setStatus, applyRunResult, refreshData, rescore,
  }), [loading, loadError, dataset, sources, runs, profile, saved, theme, lastSeenAt, setTheme, saveProfile, setStatus, applyRunResult, refreshData, rescore]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

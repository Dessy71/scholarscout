/**
 * POST /api/update — the serverless side of the Update Now button.
 *
 * Runs the same ingestion pipeline as GitHub Actions, but scoped for a
 * serverless time budget: sources are processed within a wall-clock budget
 * and results are returned directly to the dashboard (which merges them into
 * the in-browser dataset immediately). The durable, committed dataset is
 * produced by the GitHub Actions runs; if GITHUB_TOKEN/GITHUB_REPO are
 * configured this endpoint ALSO dispatches the full workflow so the
 * repository data catches up.
 *
 * Zero mandatory keys: works with no environment variables at all.
 *
 * Seed data loading is defensive: it tries the bundled filesystem first and
 * falls back to fetching the deployment's own static /data/*.json files
 * (which always exist — the build copies them into the static output).
 */
import type { Dataset, Source, UpdateRun, UserProfile } from '../src/core/types';
import type { StorageAdapter } from '../src/store/adapter';
import { EMPTY_DATASET } from '../src/store/adapter';
import { runPipeline } from '../src/server/pipeline';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const config = { maxDuration: 60 };

/** In-memory store: serverless filesystems are ephemeral, so results are
 * returned in the response instead of persisted. */
class MemoryStore implements StorageAdapter {
  private dataset: Dataset = { ...EMPTY_DATASET, opportunities: [], changes: [] };
  private runs: UpdateRun[] = [];
  constructor(private sources: Source[], private profile: UserProfile | null, seed: Dataset | null) {
    if (seed) this.dataset = seed;
  }
  async loadDataset() { return this.dataset; }
  async saveDataset(d: Dataset) { this.dataset = d; }
  async loadSources() { return this.sources; }
  async saveSources(s: Source[]) { this.sources = s; }
  async loadRuns() { return this.runs; }
  async saveRuns(r: UpdateRun[]) { this.runs = r; }
  async loadProfile() { return this.profile; }
  async saveProfile(p: UserProfile) { this.profile = p; }
}

async function readBundled<T>(rel: string, selfOrigin: string | null, fallback: T): Promise<T> {
  // 1) Filesystem candidates (repo layout in dev / includeFiles on Vercel)
  const candidates = [
    path.join(process.cwd(), 'data', rel),
    path.join(process.cwd(), 'public', 'data', rel),
  ];
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf8')) as T; } catch { /* next */ }
  }
  // 2) The deployment's own static files — always present after a build.
  if (selfOrigin) {
    try {
      const res = await fetch(`${selfOrigin}/data/${rel}`, { headers: { accept: 'application/json' } });
      if (res.ok) return (await res.json()) as T;
    } catch { /* fall through */ }
  }
  return fallback;
}

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
  setHeader(k: string, v: string): void;
}

function headerStr(h: string | string[] | undefined): string | null {
  if (Array.isArray(h)) return h[0] ?? null;
  return h ?? null;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method-not-allowed' });
      return;
    }

    const secret = process.env.UPDATE_SECRET;
    if (secret) {
      const provided = headerStr(req.headers['x-update-key']);
      if (provided !== secret) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
    }

    // Reconstruct this deployment's own origin for static-data fallback.
    const host = headerStr(req.headers['x-forwarded-host']) ?? headerStr(req.headers.host);
    const proto = headerStr(req.headers['x-forwarded-proto']) ?? 'https';
    const selfOrigin = host ? `${proto}://${host}` : null;

    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
      sourceIds?: string[];
    };

    const [sourcesWrapper, profile, seedDataset] = await Promise.all([
      readBundled<{ sources: Source[] }>('sources.json', selfOrigin, { sources: [] }),
      readBundled<UserProfile | null>('profile.json', selfOrigin, null),
      readBundled<Dataset | null>('opportunities.json', selfOrigin, null),
    ]);
    const sources = sourcesWrapper.sources;

    if (sources.length === 0) {
      res.status(500).json({
        error: 'no-sources-available',
        detail: 'Could not load data/sources.json from the function bundle or the static deployment. Check that data/ is committed and the build ran scripts/sync-data.mjs.',
      });
      return;
    }

    const store = new MemoryStore(sources, profile, seedDataset);

    const { run, dataset } = await runPipeline(store, {
      trigger: 'manual_ui',
      sourceIds: body.sourceIds,
      maxPagesPerSource: 2,   // serverless time budget
      fetchDetailPages: true,
      timeBudgetMs: 40_000,   // finish gracefully well inside maxDuration=60s
    });

    // Optionally dispatch the full GitHub Actions workflow for a durable run.
    let workflowDispatched = false;
    const ghToken = process.env.GITHUB_TOKEN;
    const ghRepo = process.env.GITHUB_REPO;
    if (ghToken && ghRepo) {
      try {
        const r = await fetch(`https://api.github.com/repos/${ghRepo}/actions/workflows/update-opportunities.yml/dispatches`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${ghToken}`,
            accept: 'application/vnd.github+json',
            'content-type': 'application/json',
            'user-agent': 'ScholarScout',
          },
          body: JSON.stringify({ ref: 'main' }),
        });
        workflowDispatched = r.status === 204;
      } catch { /* best-effort */ }
    }

    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ run, dataset, workflowDispatched });
  } catch (err) {
    // Never fail anonymously — always return a diagnosable message.
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    res.status(500).json({ error: message });
  }
}

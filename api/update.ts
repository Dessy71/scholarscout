/**
 * POST /api/update — the serverless side of the Update Now button.
 *
 * Runs the same ingestion pipeline as GitHub Actions, but scoped for a
 * serverless time budget: sources are processed in a rate-limited batch and
 * results are returned directly to the dashboard (which merges them into the
 * in-browser dataset immediately). The durable, committed dataset is produced
 * by the GitHub Actions runs; if GITHUB_TOKEN/GITHUB_REPO are configured this
 * endpoint ALSO dispatches the full workflow so the repository data catches up.
 *
 * Zero mandatory keys: works with no environment variables at all.
 */
import type { Dataset, Source, UpdateRun, UserProfile } from '../src/core/types';
import type { StorageAdapter } from '../src/store/adapter';
import { EMPTY_DATASET } from '../src/store/adapter';
import { runPipeline } from '../src/server/pipeline';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const config = { maxDuration: 60 };

/** Read-only bootstrap + in-memory writes: serverless filesystems are ephemeral,
 * so results are returned in the response instead of persisted. */
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
  getState() { return { dataset: this.dataset, sources: this.sources, runs: this.runs }; }
}

async function readBundled<T>(rel: string, fallback: T): Promise<T> {
  // Data files are bundled with the deployment (they live in the repo).
  const candidates = [
    path.join(process.cwd(), 'data', rel),
    path.join(process.cwd(), 'public', 'data', rel),
  ];
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf8')) as T; } catch { /* next */ }
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

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  const secret = process.env.UPDATE_SECRET;
  if (secret) {
    const provided = req.headers['x-update-key'];
    if (provided !== secret) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
    sourceIds?: string[];
  };

  const sources = (await readBundled<{ sources: Source[] }>('sources.json', { sources: [] })).sources;
  const profile = await readBundled<UserProfile | null>('profile.json', null);
  const seedDataset = await readBundled<Dataset | null>('opportunities.json', null);

  const store = new MemoryStore(sources, profile, seedDataset);

  try {
    const { run, dataset } = await runPipeline(store, {
      trigger: 'manual_ui',
      sourceIds: body.sourceIds,
      maxPagesPerSource: 3, // serverless time budget
      fetchDetailPages: true,
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
    res.status(500).json({ error: err instanceof Error ? err.message : 'update-failed' });
  }
}

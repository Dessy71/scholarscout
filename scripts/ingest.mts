/**
 * Ingestion entrypoint — used by GitHub Actions and locally via `npm run ingest`.
 *
 *   npm run ingest                 # full run
 *   npm run ingest -- --trigger=scheduled
 *   npm run ingest -- --sources=chevening,daad-epos
 *
 * A lock file prevents concurrent runs (also enforced by the GitHub Actions
 * concurrency group). Stale locks (> 30 min) are broken automatically.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { FileStore } from '../src/store/fileStore';
import { runPipeline } from '../src/server/pipeline';
import type { UpdateRun } from '../src/core/types';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT, 'data');
const LOCK_FILE = path.join(DATA_DIR, '.lock.json');
const LOCK_STALE_MS = 30 * 60 * 1000;

function arg(name: string): string | null {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : null;
}

async function acquireLock(): Promise<boolean> {
  try {
    const raw = await fs.readFile(LOCK_FILE, 'utf8');
    const lock = JSON.parse(raw) as { startedAt: string };
    if (Date.now() - new Date(lock.startedAt).getTime() < LOCK_STALE_MS) return false;
    console.warn('[ingest] breaking stale lock');
  } catch { /* no lock */ }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCK_FILE, JSON.stringify({ startedAt: new Date().toISOString(), pid: process.pid }), 'utf8');
  return true;
}

async function releaseLock(): Promise<void> {
  try { await fs.unlink(LOCK_FILE); } catch { /* already gone */ }
}

async function main(): Promise<void> {
  const trigger = (arg('trigger') ?? 'manual_cli') as UpdateRun['trigger'];
  const sourcesArg = arg('sources');
  const sourceIds = sourcesArg ? sourcesArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  if (!(await acquireLock())) {
    console.error('[ingest] another update is already running (lock present). Exiting.');
    process.exit(2);
  }

  const store = new FileStore(DATA_DIR);
  console.log(`[ingest] starting (trigger=${trigger}${sourceIds ? `, sources=${sourceIds.join(',')}` : ''})`);

  try {
    const { run } = await runPipeline(store, {
      trigger,
      sourceIds,
      maxPagesPerSource: 6,
      onProgress: (e) => console.log(`[ingest] ${e.message}`),
    });

    console.log('\n========== UPDATE SUMMARY ==========');
    console.log(`Status:        ${run.status}`);
    console.log(`Sources:       ${run.sourcesChecked} checked`);
    console.log(`Pages fetched: ${run.pagesFetched}`);
    console.log(`Found:         ${run.opportunitiesFound}`);
    console.log(`New:           ${run.newItems}`);
    console.log(`Updated:       ${run.updatedItems}`);
    console.log(`Rejected:      ${run.rejectedItems}`);
    if (run.errors.length) {
      console.log(`Errors (${run.errors.length}):`);
      for (const e of run.errors) console.log(`  - ${e}`);
    }
    console.log('====================================\n');

    if (run.status === 'failed') {
      console.error('[ingest] all sources failed — marking run as failed');
      process.exitCode = 1;
    }
  } finally {
    await releaseLock();
  }
}

main().catch(async (err) => {
  console.error('[ingest] fatal:', err);
  await releaseLock();
  process.exit(1);
});

/**
 * Copies the repository-backed data files into public/data so the built
 * frontend can fetch them as static assets (zero-cost reads on Vercel).
 * Runs automatically before every build (see "prebuild" in package.json).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'data');
const DEST = path.join(ROOT, 'public', 'data');

const FILES = ['opportunities.json', 'sources.json', 'runs.json', 'profile.json'];
const FALLBACKS = {
  'opportunities.json': { generatedAt: new Date(0).toISOString(), opportunities: [], changes: [] },
  'sources.json': { sources: [] },
  'runs.json': { runs: [] },
  'profile.json': null,
};

await fs.mkdir(DEST, { recursive: true });
for (const file of FILES) {
  try {
    await fs.copyFile(path.join(SRC, file), path.join(DEST, file));
    console.log(`[sync-data] copied ${file}`);
  } catch {
    await fs.writeFile(path.join(DEST, file), JSON.stringify(FALLBACKS[file], null, 2), 'utf8');
    console.log(`[sync-data] wrote fallback ${file}`);
  }
}

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Dataset, Source, UpdateRun, UserProfile } from '../core/types';
import { EMPTY_DATASET, type StorageAdapter } from './adapter';

/**
 * Repository-backed JSON store (Node side).
 * Used by the ingestion script (GitHub Actions / local CLI) and by the
 * serverless update endpoint in read-only mode.
 */
export class FileStore implements StorageAdapter {
  constructor(private readonly dir: string) {}

  private file(name: string): string {
    return path.join(this.dir, name);
  }

  private async readJson<T>(name: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(this.file(name), 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(name: string, value: unknown): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(name), JSON.stringify(value, null, 2) + '\n', 'utf8');
  }

  async loadDataset(): Promise<Dataset> {
    return this.readJson<Dataset>('opportunities.json', { ...EMPTY_DATASET });
  }
  async saveDataset(dataset: Dataset): Promise<void> {
    await this.writeJson('opportunities.json', dataset);
  }

  async loadSources(): Promise<Source[]> {
    const wrapper = await this.readJson<{ sources: Source[] }>('sources.json', { sources: [] });
    return wrapper.sources;
  }
  async saveSources(sources: Source[]): Promise<void> {
    await this.writeJson('sources.json', { sources });
  }

  async loadRuns(): Promise<UpdateRun[]> {
    const wrapper = await this.readJson<{ runs: UpdateRun[] }>('runs.json', { runs: [] });
    return wrapper.runs;
  }
  async saveRuns(runs: UpdateRun[]): Promise<void> {
    // Keep history bounded so the repo stays lean.
    await this.writeJson('runs.json', { runs: runs.slice(0, 100) });
  }

  async loadProfile(): Promise<UserProfile | null> {
    return this.readJson<UserProfile | null>('profile.json', null);
  }
  async saveProfile(profile: UserProfile): Promise<void> {
    await this.writeJson('profile.json', profile);
  }
}

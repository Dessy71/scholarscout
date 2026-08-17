import type { Dataset, Source, UpdateRun, UserProfile } from '../core/types';

/**
 * Storage abstraction (spec §17 / §STORAGE).
 *
 * The current default implementation is repository-backed JSON — genuinely
 * free, transparent and version-controlled. Because all business logic talks
 * to this interface, a hosted database (Supabase/Neon/…) can be introduced
 * later by writing one new adapter without touching the pipeline or UI.
 */
export interface StorageAdapter {
  loadDataset(): Promise<Dataset>;
  saveDataset(dataset: Dataset): Promise<void>;
  loadSources(): Promise<Source[]>;
  saveSources(sources: Source[]): Promise<void>;
  loadRuns(): Promise<UpdateRun[]>;
  saveRuns(runs: UpdateRun[]): Promise<void>;
  loadProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;
}

export const EMPTY_DATASET: Dataset = {
  generatedAt: new Date(0).toISOString(),
  opportunities: [],
  changes: [],
};

import type { Opportunity, SavedOpportunity, UserProfile } from '../core/types';
import { classifyDeadline } from '../core/deadline';
import { passesProfileFilters } from '../core/score';

export interface FilterState {
  query: string;
  country: string | null;
  region: string | null;
  funding: string[];
  level: string[];
  type: string[];
  field: string | null;
  organization: string | null;
  ghana: string[];
  academic: string[];
  deadline: string[];       // deadline buckets
  minScore: number;
  environmental: boolean;
  newOnly: boolean;
  updatedOnly: boolean;
  savedOnly: boolean;
  appliedOnly: boolean;
  showArchive: boolean;     // include expired
  showHidden: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  query: '', country: null, region: null, funding: [], level: [], type: [],
  field: null, organization: null, ghana: [], academic: [], deadline: [],
  minScore: 0, environmental: false, newOnly: false, updatedOnly: false,
  savedOnly: false, appliedOnly: false, showArchive: false, showHidden: false,
};

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.country) n++;
  if (f.region) n++;
  n += f.funding.length + f.level.length + f.type.length + f.ghana.length + f.academic.length + f.deadline.length;
  if (f.field) n++;
  if (f.organization) n++;
  if (f.minScore > 0) n++;
  if (f.environmental) n++;
  if (f.newOnly) n++;
  if (f.updatedOnly) n++;
  if (f.savedOnly) n++;
  if (f.appliedOnly) n++;
  return n;
}

const NEW_WINDOW_MS = 48 * 3600 * 1000;

export function isNew(o: Opportunity, now: Date = new Date()): boolean {
  return now.getTime() - new Date(o.discoveredAt).getTime() < NEW_WINDOW_MS;
}

export function isUpdated(o: Opportunity, changedIds: Set<string>): boolean {
  return changedIds.has(o.id);
}

export function searchMatch(o: Opportunity, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    o.title, o.organization, o.university ?? '', o.country ?? '',
    o.summary ?? '', o.sourceName, ...o.fields,
  ].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((term) => hay.includes(term));
}

export function applyFilters(
  opportunities: Opportunity[],
  filters: FilterState,
  profile: UserProfile,
  saved: Record<string, SavedOpportunity>,
  changedIds: Set<string>,
  now: Date = new Date(),
): Opportunity[] {
  return opportunities.filter((o) => {
    const status = saved[o.id]?.status ?? 'none';
    const bucket = classifyDeadline(o.deadline, now);

    if (!filters.showHidden && status === 'hidden') return false;
    if (!filters.showArchive && bucket === 'expired') return false;
    if (filters.showArchive && bucket !== 'expired') return false;

    // Profile-level feed rules (strictness, funding preference, uncertain eligibility)
    if (!filters.showArchive && !filters.savedOnly && !filters.appliedOnly && !passesProfileFilters(o, profile, now)) return false;

    if (!searchMatch(o, filters.query)) return false;
    if (filters.country && o.country !== filters.country) return false;
    if (filters.region && o.region !== filters.region) return false;
    if (filters.funding.length && !filters.funding.includes(o.fundingType)) return false;
    if (filters.level.length && !filters.level.includes(o.level)) return false;
    if (filters.type.length && !filters.type.includes(o.type)) return false;
    if (filters.field && !o.fields.includes(filters.field)) return false;
    if (filters.organization && o.organization !== filters.organization) return false;
    if (filters.ghana.length && !filters.ghana.includes(o.ghanaEligibility)) return false;
    if (filters.academic.length && !filters.academic.includes(o.academicFit)) return false;
    if (filters.deadline.length && !filters.deadline.includes(bucket)) return false;
    if (o.match.score < filters.minScore) return false;
    if (filters.environmental && !o.environmental) return false;
    if (filters.newOnly && !isNew(o, now)) return false;
    if (filters.updatedOnly && !isUpdated(o, changedIds)) return false;
    if (filters.savedOnly && status !== 'saved') return false;
    if (filters.appliedOnly && status !== 'applied') return false;
    return true;
  }).sort((a, b) => b.match.score - a.match.score);
}

import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS, searchMatch, isNew } from '../src/lib/filters';
import { DEFAULT_PROFILE } from '../src/core/profileDefaults';
import type { Opportunity, SavedOpportunity, UserProfile } from '../src/core/types';

const NOW = new Date('2026-08-17T10:00:00Z');
const profile: UserProfile = { ...DEFAULT_PROFILE, onboardingComplete: true };

let seq = 0;
function opp(partial: Partial<Opportunity>): Opportunity {
  seq++;
  return {
    id: `opp_${seq}`, title: `Opportunity ${seq}`, organization: 'Org', university: null,
    country: 'United Kingdom', city: null, region: 'uk', fields: ['computer_science'],
    level: 'masters', type: 'masters_scholarship', fundingType: 'fully_funded',
    fundingDetails: null, eligibilityText: null, academicRequirement: null,
    academicFit: 'potentially_eligible', nationalityRequirement: null,
    ghanaEligibility: 'ghana_eligible',
    deadline: { date: '2026-12-01', rawText: null, timezone: null },
    startDate: null, duration: null, summary: 'A fully funded masters', applicationUrl: 'https://a.example',
    sourceUrl: 'https://a.example', canonicalUrl: `https://a.example/${seq}`, sourceId: 's', sourceName: 'S',
    discoveredAt: NOW.toISOString(), updatedAt: NOW.toISOString(), lastVerifiedAt: null,
    contentHash: 'h', verificationStatus: 'verified', environmental: false,
    match: { score: 80, tier: 'strong', breakdown: [], reasons: [], concerns: [] },
    ...partial,
  };
}

const noSaved: Record<string, SavedOpportunity> = {};
const noChanges = new Set<string>();

describe('applyFilters', () => {
  it('excludes expired from the main feed but shows them in archive view', () => {
    const expired = opp({ deadline: { date: '2026-01-01', rawText: null, timezone: null } });
    const active = opp({});
    const feed = applyFilters([expired, active], EMPTY_FILTERS, profile, noSaved, noChanges, NOW);
    expect(feed.map((o) => o.id)).toEqual([active.id]);
    const archive = applyFilters([expired, active], { ...EMPTY_FILTERS, showArchive: true }, profile, noSaved, noChanges, NOW);
    expect(archive.map((o) => o.id)).toEqual([expired.id]);
  });

  it('hides hidden opportunities unless showHidden', () => {
    const a = opp({});
    const saved: Record<string, SavedOpportunity> = { [a.id]: { opportunityId: a.id, status: 'hidden', savedAt: NOW.toISOString(), notes: '' } };
    expect(applyFilters([a], EMPTY_FILTERS, profile, saved, noChanges, NOW)).toHaveLength(0);
    expect(applyFilters([a], { ...EMPTY_FILTERS, showHidden: true }, profile, saved, noChanges, NOW)).toHaveLength(1);
  });

  it('combines multiple filters (country + funding + min score)', () => {
    const a = opp({ country: 'Germany', fundingType: 'partial', match: { score: 60, tier: 'good', breakdown: [], reasons: [], concerns: [] } });
    const b = opp({ country: 'Germany', fundingType: 'fully_funded', match: { score: 90, tier: 'excellent', breakdown: [], reasons: [], concerns: [] } });
    const c = opp({ country: 'United Kingdom', fundingType: 'fully_funded', match: { score: 90, tier: 'excellent', breakdown: [], reasons: [], concerns: [] } });
    const res = applyFilters([a, b, c], {
      ...EMPTY_FILTERS, country: 'Germany', funding: ['fully_funded'], minScore: 70,
    }, { ...profile, fundingPreference: 'include_unfunded' }, noSaved, noChanges, NOW);
    expect(res.map((o) => o.id)).toEqual([b.id]);
  });

  it('savedOnly / appliedOnly filters use application status', () => {
    const a = opp({});
    const b = opp({});
    const saved: Record<string, SavedOpportunity> = {
      [a.id]: { opportunityId: a.id, status: 'saved', savedAt: NOW.toISOString(), notes: '' },
      [b.id]: { opportunityId: b.id, status: 'applied', savedAt: NOW.toISOString(), notes: '' },
    };
    expect(applyFilters([a, b], { ...EMPTY_FILTERS, savedOnly: true }, profile, saved, noChanges, NOW).map((o) => o.id)).toEqual([a.id]);
    expect(applyFilters([a, b], { ...EMPTY_FILTERS, appliedOnly: true }, profile, saved, noChanges, NOW).map((o) => o.id)).toEqual([b.id]);
  });

  it('environmental filter works', () => {
    const env = opp({ environmental: true });
    const plain = opp({});
    const res = applyFilters([env, plain], { ...EMPTY_FILTERS, environmental: true }, profile, noSaved, noChanges, NOW);
    expect(res.map((o) => o.id)).toEqual([env.id]);
  });

  it('sorts by match score descending', () => {
    const low = opp({ match: { score: 50, tier: 'fair', breakdown: [], reasons: [], concerns: [] } });
    const high = opp({ match: { score: 95, tier: 'excellent', breakdown: [], reasons: [], concerns: [] } });
    const res = applyFilters([low, high], EMPTY_FILTERS, profile, noSaved, noChanges, NOW);
    expect(res[0].id).toBe(high.id);
  });
});

describe('search', () => {
  it('matches across title, org, country, fields and summary', () => {
    const o = opp({ title: 'Cloud Fellowship', organization: 'DAAD', country: 'Germany', summary: 'DevOps training in Berlin' });
    expect(searchMatch(o, 'daad')).toBe(true);
    expect(searchMatch(o, 'germany cloud')).toBe(true);
    expect(searchMatch(o, 'devops')).toBe(true);
    expect(searchMatch(o, 'harvard')).toBe(false);
    expect(searchMatch(o, '')).toBe(true);
  });
});

describe('isNew', () => {
  it('marks items discovered within 48 hours', () => {
    expect(isNew(opp({ discoveredAt: new Date(NOW.getTime() - 24 * 3600e3).toISOString() }), NOW)).toBe(true);
    expect(isNew(opp({ discoveredAt: new Date(NOW.getTime() - 72 * 3600e3).toISOString() }), NOW)).toBe(false);
  });
});

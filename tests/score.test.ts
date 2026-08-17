import { describe, expect, it } from 'vitest';
import { computeMatch, WEIGHTS, passesProfileFilters } from '../src/core/score';
import { DEFAULT_PROFILE } from '../src/core/profileDefaults';
import type { Opportunity, UserProfile } from '../src/core/types';

const NOW = new Date('2026-08-17T10:00:00Z');
const profile: UserProfile = { ...DEFAULT_PROFILE, onboardingComplete: true };

const baseInput = {
  ghanaEligibility: 'ghana_eligible' as const,
  fundingType: 'fully_funded_stipend' as const,
  academicFit: 'clearly_eligible' as const,
  fields: ['computer_science', 'devops'],
  environmental: false,
  country: 'United Kingdom',
  region: 'uk',
  deadlineDate: '2026-09-10',
  type: 'masters_scholarship' as const,
  verificationStatus: 'verified' as const,
  title: 'Fully funded UK masters in DevOps and cloud',
  summary: 'devops cloud automation',
};

describe('computeMatch', () => {
  it('weights sum to 100', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('near-perfect input scores high with explanations', () => {
    const m = computeMatch(baseInput, profile, NOW);
    expect(m.score).toBeGreaterThanOrEqual(90);
    expect(m.tier).toBe('excellent');
    expect(m.breakdown).toHaveLength(9);
    expect(m.reasons.length).toBeGreaterThan(2);
    expect(m.reasons.join(' ')).toMatch(/Ghanaian/i);
  });

  it('restricted nationality earns zero nationality points and a concern', () => {
    const m = computeMatch({ ...baseInput, ghanaEligibility: 'restricted' }, profile, NOW);
    const nat = m.breakdown.find((b) => b.key === 'nationality')!;
    expect(nat.earned).toBe(0);
    expect(m.concerns.join(' ')).toMatch(/restriction/i);
  });

  it('unknown eligibility is penalized and flagged, never claimed', () => {
    const m = computeMatch({ ...baseInput, ghanaEligibility: 'unknown' }, profile, NOW);
    const nat = m.breakdown.find((b) => b.key === 'nationality')!;
    expect(nat.earned).toBeLessThan(WEIGHTS.nationality / 2);
    expect(m.concerns.join(' ')).toMatch(/not confirmed/i);
  });

  it('likely-ineligible academics tank the academic component', () => {
    const m = computeMatch({ ...baseInput, academicFit: 'likely_ineligible' }, profile, NOW);
    const acad = m.breakdown.find((b) => b.key === 'academic')!;
    expect(acad.earned).toBeLessThanOrEqual(2);
    expect(m.concerns.join(' ')).toMatch(/above a 2:2/i);
  });

  it('funding priority orders scores', () => {
    const s = (ft: typeof baseInput.fundingType) => computeMatch({ ...baseInput, fundingType: ft }, profile, NOW).score;
    expect(s('fully_funded_stipend')).toBeGreaterThan(s('mostly_funded'));
    expect(s('mostly_funded')).toBeGreaterThan(s('tuition_waiver'));
    expect(s('tuition_waiver')).toBeGreaterThan(s('unfunded'));
  });

  it('environmental interest boosts clean-air opportunities', () => {
    const envInput = { ...baseInput, environmental: true, fields: ['clean_air'], title: 'Clean air fellowship', summary: 'air quality' };
    const strong = computeMatch(envInput, { ...profile, environmentalInterest: 'strongly_prioritize' }, NOW);
    const excl = computeMatch(envInput, { ...profile, environmentalInterest: 'exclude', careerInterests: [] }, NOW);
    expect(strong.score).toBeGreaterThan(excl.score);
  });
});

function makeOpp(partial: Partial<Opportunity>): Opportunity {
  return {
    id: 'opp_test', title: 'T', organization: 'O', university: null, country: null,
    city: null, region: null, fields: [], level: 'masters', type: 'masters_scholarship',
    fundingType: 'fully_funded', fundingDetails: null, eligibilityText: null,
    academicRequirement: null, academicFit: 'unknown', nationalityRequirement: null,
    ghanaEligibility: 'unknown', deadline: { date: '2026-12-01', rawText: null, timezone: null },
    startDate: null, duration: null, summary: null, applicationUrl: 'https://x.example',
    sourceUrl: 'https://x.example', canonicalUrl: 'https://x.example', sourceId: 's',
    sourceName: 'S', discoveredAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    lastVerifiedAt: null, contentHash: 'h', verificationStatus: 'verified',
    environmental: false,
    match: { score: 50, tier: 'fair', breakdown: [], reasons: [], concerns: [] },
    ...partial,
  };
}

describe('passesProfileFilters', () => {
  it('expired opportunities never pass', () => {
    expect(passesProfileFilters(makeOpp({ deadline: { date: '2026-01-01', rawText: null, timezone: null } }), profile, NOW)).toBe(false);
  });
  it('strict mode hides likely-ineligible academics', () => {
    const strict = { ...profile, academicStrictness: 'strict' as const };
    expect(passesProfileFilters(makeOpp({ academicFit: 'likely_ineligible' }), strict, NOW)).toBe(false);
    expect(passesProfileFilters(makeOpp({ academicFit: 'likely_ineligible' }), profile, NOW)).toBe(true);
  });
  it('hide-uncertain mode hides unknown Ghana eligibility', () => {
    const hide = { ...profile, uncertainEligibility: 'hide' as const };
    expect(passesProfileFilters(makeOpp({ ghanaEligibility: 'unknown' }), hide, NOW)).toBe(false);
  });
  it('fully-funded-only preference filters partial funding', () => {
    const ff = { ...profile, fundingPreference: 'fully_funded_only' as const };
    expect(passesProfileFilters(makeOpp({ fundingType: 'partial' }), ff, NOW)).toBe(false);
    expect(passesProfileFilters(makeOpp({ fundingType: 'fully_funded' }), ff, NOW)).toBe(true);
  });
  it('restricted nationality hidden unless broad mode', () => {
    expect(passesProfileFilters(makeOpp({ ghanaEligibility: 'restricted' }), profile, NOW)).toBe(false);
    const broad = { ...profile, academicStrictness: 'broad' as const };
    expect(passesProfileFilters(makeOpp({ ghanaEligibility: 'restricted' }), broad, NOW)).toBe(true);
  });
});

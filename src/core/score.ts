import type {
  AcademicFit, DeadlineBucket, FundingType, GhanaEligibility, MatchResult,
  Opportunity, OpportunityType, ScoreBreakdownEntry, UserProfile, VerificationStatus,
} from './types';
import { FUNDING_PRIORITY } from './classify/funding';
import { classifyDeadline } from './deadline';

/**
 * Transparent weighted match score (0–100).
 *
 * Weights (spec):
 *   Nationality eligibility  20
 *   Funding                  20
 *   Academic compatibility   15
 *   Field relevance          15
 *   Career/interest fit      10
 *   Geographic preference     5
 *   Deadline urgency          5
 *   Opportunity-type pref     5
 *   Source/verification       5
 */

export const WEIGHTS = {
  nationality: 20,
  funding: 20,
  academic: 15,
  field: 15,
  career: 10,
  geography: 5,
  deadline: 5,
  type: 5,
  verification: 5,
} as const;

const NATIONALITY_FACTORS: Record<GhanaEligibility, { f: number; reason: string }> = {
  ghana_eligible: { f: 1, reason: 'Ghanaian applicants explicitly eligible' },
  africa_eligible: { f: 0.9, reason: 'African applicants (including Ghana) eligible' },
  international: { f: 0.8, reason: 'Open to international applicants' },
  unknown: { f: 0.3, reason: 'Ghanaian eligibility not established by the source' },
  restricted: { f: 0, reason: 'Nationality restriction appears to exclude Ghana' },
};

const ACADEMIC_FACTORS: Record<AcademicFit, { f: number; reason: string }> = {
  clearly_eligible: { f: 1, reason: '2:2 / Second Class Lower explicitly accepted' },
  potentially_eligible: { f: 0.75, reason: 'Degree required, no threshold excluding a 2:2' },
  unknown: { f: 0.5, reason: 'No academic threshold stated by the source' },
  unclear: { f: 0.4, reason: 'Academic requirement stated but cannot be safely interpreted' },
  likely_ineligible: { f: 0.1, reason: 'Stated requirement is above a 2:2' },
};

const VERIFICATION_FACTORS: Record<VerificationStatus, number> = {
  verified: 1,
  needs_review: 0.5,
  source_unavailable: 0.25,
};

const DEADLINE_FACTORS: Record<DeadlineBucket, number> = {
  closing_30_days: 1,
  closing_7_days: 1,
  closing_later: 0.85,
  closing_3_days: 0.7,   // very tight — still valuable but risky
  closing_today: 0.5,
  unknown: 0.4,
  expired: 0,
};

/** Region inference for geographic preference matching. */
const REGION_OF_COUNTRY: Record<string, string> = {
  'united kingdom': 'uk', uk: 'uk', england: 'uk', scotland: 'uk', wales: 'uk',
  germany: 'europe', france: 'europe', netherlands: 'europe', sweden: 'europe',
  belgium: 'europe', italy: 'europe', spain: 'europe', denmark: 'europe',
  finland: 'europe', norway: 'europe', austria: 'europe', switzerland: 'europe',
  ireland: 'europe', poland: 'europe', portugal: 'europe', hungary: 'europe',
  canada: 'canada', 'united states': 'usa', usa: 'usa', 'united states of america': 'usa',
  australia: 'australia_nz', 'new zealand': 'australia_nz',
  ghana: 'africa', nigeria: 'africa', kenya: 'africa', 'south africa': 'africa',
  rwanda: 'africa', egypt: 'africa', ethiopia: 'africa', senegal: 'africa',
  japan: 'japan', 'south korea': 'south_korea', korea: 'south_korea', china: 'china',
};

export function regionForCountry(country: string | null): string | null {
  if (!country) return null;
  return REGION_OF_COUNTRY[country.toLowerCase().trim()] ?? null;
}

const SHORT_TYPES: OpportunityType[] = ['summer_school', 'summer_camp', 'bootcamp', 'conference', 'fellowship'];

export interface ScoreInput {
  ghanaEligibility: GhanaEligibility;
  fundingType: FundingType;
  academicFit: AcademicFit;
  fields: string[];
  environmental: boolean;
  adjacentOnly?: boolean;
  openToAllFields?: boolean;
  country: string | null;
  region: string | null;
  deadlineDate: string | null;
  type: OpportunityType;
  verificationStatus: VerificationStatus;
  title: string;
  summary?: string | null;
}

export function computeMatch(input: ScoreInput, profile: UserProfile, now: Date = new Date()): MatchResult {
  const breakdown: ScoreBreakdownEntry[] = [];
  const reasons: string[] = [];
  const concerns: string[] = [];

  // ── Nationality (20) ──
  const nat = NATIONALITY_FACTORS[input.ghanaEligibility];
  breakdown.push({ key: 'nationality', label: 'Nationality eligibility', weight: WEIGHTS.nationality, earned: round1(WEIGHTS.nationality * nat.f), reason: nat.reason });
  if (nat.f >= 0.8) reasons.push(nat.reason);
  if (input.ghanaEligibility === 'unknown') concerns.push('Ghanaian eligibility not confirmed — verify on the official page');
  if (input.ghanaEligibility === 'restricted') concerns.push('Nationality restriction may exclude Ghanaian applicants');

  // ── Funding (20) ──
  const fundingFactor = FUNDING_PRIORITY[input.fundingType] / 8;
  const fundingLabelMap: Record<FundingType, string> = {
    fully_funded_stipend: 'Fully funded with stipend',
    fully_funded: 'Fully funded',
    tuition_stipend: 'Tuition plus stipend',
    mostly_funded: 'Mostly funded',
    partial: 'Partially funded',
    tuition_waiver: 'Tuition waiver',
    travel_funded: 'Travel/conference funding',
    unfunded: 'Unfunded',
    unknown: 'Funding not verified',
  };
  breakdown.push({ key: 'funding', label: 'Funding strength', weight: WEIGHTS.funding, earned: round1(WEIGHTS.funding * fundingFactor), reason: fundingLabelMap[input.fundingType] });
  if (fundingFactor >= 0.75) reasons.push(fundingLabelMap[input.fundingType]);
  if (input.fundingType === 'unknown') concerns.push('Funding details could not be verified from the source');
  if (input.fundingType === 'unfunded') concerns.push('No funding attached to this opportunity');

  // ── Academic (15) ──
  const acad = ACADEMIC_FACTORS[input.academicFit];
  breakdown.push({ key: 'academic', label: 'Academic compatibility', weight: WEIGHTS.academic, earned: round1(WEIGHTS.academic * acad.f), reason: acad.reason });
  if (input.academicFit === 'clearly_eligible') reasons.push('2:2 / Second Class Lower accepted');
  if (input.academicFit === 'likely_ineligible') concerns.push('Stated academic requirement is above a 2:2');
  if (input.academicFit === 'unknown') concerns.push('Academic requirement not stated — check the programme page');

  // ── Field relevance (15) ──
  const userFields = new Set(profile.fields);
  const overlap = input.fields.filter((f) => userFields.has(f));
  let fieldFactor = 0.2;
  let fieldReason = 'No clear field match detected';
  if (overlap.length >= 2) { fieldFactor = 1; fieldReason = `Strong field match (${overlap.length} of your fields)`; }
  else if (overlap.length === 1) { fieldFactor = 0.85; fieldReason = 'Matches one of your priority fields'; }
  else if (input.openToAllFields) { fieldFactor = 0.7; fieldReason = 'Open to all fields of study (your field qualifies)'; }
  else if (input.adjacentOnly) { fieldFactor = 0.5; fieldReason = 'Adjacent discipline with a technology component'; }
  else if (input.fields.length > 0) { fieldFactor = 0.4; fieldReason = 'Related technical field'; }
  breakdown.push({ key: 'field', label: 'Field relevance', weight: WEIGHTS.field, earned: round1(WEIGHTS.field * fieldFactor), reason: fieldReason });
  if (fieldFactor >= 0.7) reasons.push(fieldReason);
  if (fieldFactor <= 0.4 && !input.openToAllFields) concerns.push('Field relevance to your profile is limited');

  // ── Career / interest fit (10) ──
  const text = `${input.title} ${input.summary ?? ''}`.toLowerCase();
  let careerHits = 0;
  for (const interest of profile.careerInterests) {
    if (text.includes(interest.toLowerCase())) careerHits++;
  }
  let envBoost = 0;
  if (input.environmental) {
    if (profile.environmentalInterest === 'strongly_prioritize') envBoost = 0.5;
    else if (profile.environmentalInterest === 'include') envBoost = 0.3;
    else if (profile.environmentalInterest === 'tech_only') envBoost = input.fields.length > 0 ? 0.3 : 0;
  }
  const careerFactor = Math.min(1, careerHits * 0.35 + envBoost + (overlap.length > 0 ? 0.3 : 0));
  const careerReason = careerHits > 0
    ? 'Aligned with your career interests'
    : input.environmental && envBoost > 0
      ? 'Matches your environmental/clean-air interest'
      : overlap.length > 0 ? 'Related to your technical direction' : 'Limited career-interest signal';
  breakdown.push({ key: 'career', label: 'Career & interest fit', weight: WEIGHTS.career, earned: round1(WEIGHTS.career * careerFactor), reason: careerReason });
  if (careerFactor >= 0.5) reasons.push(careerReason);
  if (input.environmental && profile.environmentalInterest === 'exclude') concerns.push('Environmental focus, which you chose to deprioritize');

  // ── Geography (5) ──
  const region = input.region ?? regionForCountry(input.country);
  let geoFactor = 0.5;
  let geoReason = 'No stated location preference match';
  if (!input.country && !region) { geoFactor = 0.5; geoReason = 'Location not specified'; }
  else if (profile.destinations.includes('no_preference')) { geoFactor = 1; geoReason = 'You have no strong destination preference'; }
  else if (region && profile.destinations.includes(region)) { geoFactor = 1; geoReason = `${prettyRegion(region)} is one of your preferred destinations`; }
  breakdown.push({ key: 'geography', label: 'Geographic preference', weight: WEIGHTS.geography, earned: round1(WEIGHTS.geography * geoFactor), reason: geoReason });
  if (geoFactor === 1 && region) reasons.push(geoReason);

  // ── Deadline (5) ──
  const bucket = classifyDeadline({ date: input.deadlineDate, rawText: null, timezone: null }, now);
  const dlFactor = DEADLINE_FACTORS[bucket];
  const dlReason: Record<DeadlineBucket, string> = {
    closing_today: 'Closes today — extremely tight',
    closing_3_days: 'Closes within 3 days — tight timeline',
    closing_7_days: 'Healthy application window (≤ 7 days)',
    closing_30_days: 'Healthy application window (≤ 30 days)',
    closing_later: 'Deadline is comfortably in the future',
    expired: 'Deadline has passed',
    unknown: 'Deadline not confirmed',
  };
  breakdown.push({ key: 'deadline', label: 'Deadline urgency', weight: WEIGHTS.deadline, earned: round1(WEIGHTS.deadline * dlFactor), reason: dlReason[bucket] });
  if (bucket === 'closing_today' || bucket === 'closing_3_days') concerns.push(dlReason[bucket]);
  if (bucket === 'unknown') concerns.push('Deadline could not be verified');

  // ── Opportunity type (5) ──
  let typeFactor = 0.4;
  let typeReason = 'Not among your target opportunity types';
  if (profile.targetTypes.includes(input.type)) { typeFactor = 1; typeReason = 'Matches your target opportunity types'; }
  else if (SHORT_TYPES.includes(input.type) && profile.shortProgrammes.length > 0) { typeFactor = 0.8; typeReason = 'Short programme you opted into'; }
  breakdown.push({ key: 'type', label: 'Opportunity-type preference', weight: WEIGHTS.type, earned: round1(WEIGHTS.type * typeFactor), reason: typeReason });
  if (typeFactor >= 0.8) reasons.push(typeReason);

  // ── Verification (5) ──
  const verFactor = VERIFICATION_FACTORS[input.verificationStatus];
  const verReason = input.verificationStatus === 'verified'
    ? 'Verified directly from the official source'
    : input.verificationStatus === 'needs_review'
      ? 'Some details need manual review'
      : 'Source could not currently be fetched';
  breakdown.push({ key: 'verification', label: 'Source confidence', weight: WEIGHTS.verification, earned: round1(WEIGHTS.verification * verFactor), reason: verReason });
  if (input.verificationStatus !== 'verified') concerns.push(verReason);

  const score = Math.round(breakdown.reduce((acc, b) => acc + b.earned, 0));
  const tier = score >= 85 ? 'excellent' : score >= 70 ? 'strong' : score >= 55 ? 'good' : score >= 40 ? 'fair' : 'weak';
  return { score, tier, breakdown, reasons, concerns };
}

function round1(n: number): number { return Math.round(n * 10) / 10; }

function prettyRegion(key: string): string {
  const map: Record<string, string> = {
    uk: 'the UK', europe: 'Europe', canada: 'Canada', usa: 'the USA',
    australia_nz: 'Australia/NZ', africa: 'Africa', japan: 'Japan',
    south_korea: 'South Korea', china: 'China',
  };
  return map[key] ?? key;
}

export const TIER_LABELS: Record<MatchResult['tier'], string> = {
  excellent: 'Excellent Match',
  strong: 'Strong Match',
  good: 'Good Match',
  fair: 'Fair Match',
  weak: 'Weak Match',
};

/** Determine whether an opportunity should appear in the main feed for this profile. */
export function passesProfileFilters(opp: Opportunity, profile: UserProfile, now: Date = new Date()): boolean {
  const bucket = classifyDeadline(opp.deadline, now);
  if (bucket === 'expired') return false;

  if (profile.academicStrictness === 'strict' && opp.academicFit === 'likely_ineligible') return false;
  if (profile.uncertainEligibility === 'hide' && opp.ghanaEligibility === 'unknown') return false;
  if (opp.ghanaEligibility === 'restricted' && profile.academicStrictness !== 'broad') return false;

  if (profile.fundingPreference === 'fully_funded_only') {
    if (!['fully_funded', 'fully_funded_stipend', 'tuition_stipend'].includes(opp.fundingType)) return false;
  } else if (profile.fundingPreference === 'fully_plus_mostly') {
    if (['unfunded'].includes(opp.fundingType)) return false;
  } else if (profile.fundingPreference === 'any_scholarship') {
    if (opp.fundingType === 'unfunded') return false;
  }

  if (profile.deadlinePreference === 'within_30' && opp.deadline.date) {
    if (!['closing_today', 'closing_3_days', 'closing_7_days', 'closing_30_days'].includes(bucket)) return false;
  }
  if (profile.deadlinePreference === 'within_90' && opp.deadline.date) {
    const days = (new Date(opp.deadline.date).getTime() - now.getTime()) / 86_400_000;
    if (days > 90) return false;
  }
  return true;
}

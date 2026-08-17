/* ─────────────────────────────────────────────────────────────────────────────
 * ScholarScout — Shared domain types
 * These types are isomorphic: used by the ingestion pipeline (Node), the
 * serverless API routes and the React frontend.
 * ──────────────────────────────────────────────────────────────────────────── */

// ── Enumerations ─────────────────────────────────────────────────────────────

export type OpportunityType =
  | 'masters_scholarship'
  | 'postgraduate_diploma'
  | 'graduate_certificate'
  | 'fellowship'
  | 'research_programme'
  | 'summer_school'
  | 'summer_camp'
  | 'bootcamp'
  | 'funded_training'
  | 'conference'
  | 'climate_programme'
  | 'clean_air_programme'
  | 'tech4dev_programme'
  | 'other';

export type StudyLevel =
  | 'masters'
  | 'postgraduate_diploma'
  | 'graduate_certificate'
  | 'phd'
  | 'non_degree'
  | 'any'
  | 'unknown';

export type FundingType =
  | 'fully_funded'
  | 'fully_funded_stipend'
  | 'tuition_stipend'
  | 'mostly_funded'
  | 'partial'
  | 'tuition_waiver'
  | 'travel_funded'
  | 'unfunded'
  | 'unknown';

export type GhanaEligibility =
  | 'ghana_eligible'      // Ghana explicitly named / Ghana-specific programme
  | 'africa_eligible'     // African applicants (incl. Ghana) eligible
  | 'international'       // globally open / all nationalities
  | 'restricted'          // nationality restriction that excludes Ghana
  | 'unknown';            // source does not establish eligibility

export type AcademicFit =
  | 'clearly_eligible'
  | 'potentially_eligible'
  | 'unclear'             // a requirement exists but cannot be interpreted safely
  | 'likely_ineligible'
  | 'unknown';            // no academic threshold stated by the source

export type VerificationStatus =
  | 'verified'            // extracted directly from the authoritative source
  | 'needs_review'        // important fields could not be confidently established
  | 'source_unavailable'; // source could not currently be fetched

export type DeadlineBucket =
  | 'closing_today'
  | 'closing_3_days'
  | 'closing_7_days'
  | 'closing_30_days'
  | 'closing_later'
  | 'expired'
  | 'unknown';

export type ApplicationStatus = 'none' | 'saved' | 'hidden' | 'applied';

export type ParserStrategy = 'rss' | 'atom' | 'sitemap' | 'html_list' | 'html_page' | 'jsonld';

export type SourceType =
  | 'government'
  | 'university'
  | 'fellowship_org'
  | 'climate_org'
  | 'tech_org'
  | 'research_institution'
  | 'conference'
  | 'aggregator';

// ── Opportunity ──────────────────────────────────────────────────────────────

export interface DeadlineInfo {
  /** ISO 8601 date (YYYY-MM-DD) in the source's own timezone context. */
  date: string | null;
  /** Raw text exactly as written by the source, e.g. "4 November 2025, 12:00 GMT". */
  rawText: string | null;
  /** IANA timezone if the source stated one, else null. Never guessed. */
  timezone: string | null;
}

export interface ScoreBreakdownEntry {
  key: string;
  label: string;
  weight: number;        // percentage weight of this component
  earned: number;        // points earned (0..weight)
  reason: string;        // human explanation
}

export interface MatchResult {
  score: number;                       // 0–100
  tier: 'excellent' | 'strong' | 'good' | 'fair' | 'weak';
  breakdown: ScoreBreakdownEntry[];
  reasons: string[];                   // "why it matches me"
  concerns: string[];                  // "potential concern"
}

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  university: string | null;
  country: string | null;
  city: string | null;
  region: string | null;               // e.g. "Europe", "Africa"
  fields: string[];                    // matched academic/technical fields
  level: StudyLevel;
  type: OpportunityType;
  fundingType: FundingType;
  fundingDetails: string | null;       // exact wording from source
  eligibilityText: string | null;      // exact wording from source
  academicRequirement: string | null;  // exact wording from source (never translated)
  academicFit: AcademicFit;
  nationalityRequirement: string | null;
  ghanaEligibility: GhanaEligibility;
  deadline: DeadlineInfo;
  startDate: string | null;
  duration: string | null;
  summary: string | null;
  applicationUrl: string;
  sourceUrl: string;
  canonicalUrl: string;
  sourceId: string;
  sourceName: string;
  discoveredAt: string;                // ISO timestamp
  updatedAt: string;                   // ISO timestamp
  lastVerifiedAt: string | null;
  contentHash: string;
  verificationStatus: VerificationStatus;
  environmental: boolean;              // climate/clean-air/sustainability relevance
  match: MatchResult;
}

// ── Source registry ──────────────────────────────────────────────────────────

export interface SourceSeedMetadata {
  /** For html_page sources describing a single flagship programme. */
  title: string;
  organization: string;
  university?: string | null;
  country?: string | null;
  region?: string | null;
  type: OpportunityType;
  level: StudyLevel;
  applicationUrl?: string;
  summary?: string;
  fields?: string[];
}

export interface HtmlListConfig {
  itemSelector: string;
  titleSelector?: string;    // defaults to the item itself / first anchor
  linkSelector?: string;     // defaults to first anchor
  dateSelector?: string;
  summarySelector?: string;
  /** Only keep list items whose text matches one of these keywords. */
  includeKeywords?: string[];
}

export interface Source {
  id: string;
  name: string;
  url: string;
  country: string | null;
  region: string | null;
  sourceType: SourceType;
  active: boolean;
  parser: ParserStrategy;
  /** Configuration for html_list parsing. */
  listConfig?: HtmlListConfig;
  /** Metadata for html_page flagship-programme sources. */
  seed?: SourceSeedMetadata;
  /** Filter for sitemap/rss URLs; item kept when URL/title matches any keyword. */
  keywords?: string[];
  trust: 'official' | 'reputable';
  notes: string | null;
  // ── operational state, written by the pipeline ──
  lastChecked: string | null;
  lastSuccess: string | null;
  failureCount: number;
  robotsStatus: 'allowed' | 'disallowed' | 'unknown';
}

// ── User profile ─────────────────────────────────────────────────────────────

export type AcademicStrictness = 'strict' | 'balanced' | 'broad';
export type UncertainEligibilityMode = 'hide' | 'show_with_warning' | 'separate_section';
export type SourceTrustLevel = 'official_only' | 'official_plus_reputable' | 'broad_verified';
export type DeadlinePreference = 'any' | 'within_30' | 'within_90' | 'earliest_first';
export type DetailPreference = 'quick' | 'detailed' | 'both';

export interface UserProfile {
  onboardingComplete: boolean;
  nationality: string;
  degree: string;
  institution: string;
  cwa: number;                          // e.g. 52
  classification: string;               // "Second Class Lower / 2:2"
  targetTypes: OpportunityType[];
  fields: string[];
  fundingPreference: 'fully_funded_only' | 'fully_plus_mostly' | 'any_scholarship' | 'include_unfunded';
  academicStrictness: AcademicStrictness;
  destinations: string[];               // region/country keys
  careerPriorities: string[];           // what matters most
  environmentalInterest: 'strongly_prioritize' | 'include' | 'tech_only' | 'exclude';
  shortProgrammes: string[];            // summer_school | bootcamp | fellowship | conference
  sourceTrust: SourceTrustLevel;
  deadlinePreference: DeadlinePreference;
  uncertainEligibility: UncertainEligibilityMode;
  detailPreference: DetailPreference;
  careerInterests: string[];            // free-text-ish interest tags
  updatedAt: string;
}

// ── Saved / applied state ────────────────────────────────────────────────────

export interface SavedOpportunity {
  opportunityId: string;
  status: ApplicationStatus;
  savedAt: string;
  notes: string;
}

// ── Update runs ──────────────────────────────────────────────────────────────

export interface SourceRunResult {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'failed' | 'skipped_robots' | 'skipped_inactive';
  fetchedPages: number;
  found: number;
  error: string | null;
  durationMs: number;
}

export interface UpdateRun {
  id: string;
  trigger: 'scheduled' | 'manual_ui' | 'manual_cli' | 'workflow_dispatch';
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  sourcesChecked: number;
  pagesFetched: number;
  opportunitiesFound: number;
  newItems: number;
  updatedItems: number;
  rejectedItems: number;
  errors: string[];
  sourceResults: SourceRunResult[];
}

// ── Change history ───────────────────────────────────────────────────────────

export interface OpportunityChange {
  opportunityId: string;
  changedAt: string;
  runId: string;
  changedFields: { field: string; from: string | null; to: string | null }[];
}

// ── Persisted dataset shape (repository-backed JSON) ─────────────────────────

export interface Dataset {
  generatedAt: string;
  opportunities: Opportunity[];
  changes: OpportunityChange[];
}

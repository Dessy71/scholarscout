import type { UserProfile } from './types';

/**
 * Sensible onboarding defaults derived from the product specification profile.
 * These are DEFAULTS presented in the onboarding wizard — every value is
 * editable there and later in Settings. Nothing is silently locked in.
 */
export const DEFAULT_PROFILE: UserProfile = {
  onboardingComplete: false,
  nationality: 'Ghana',
  degree: 'BSc Computer Science',
  institution: 'KNUST',
  cwa: 52,
  classification: 'Second Class Lower (≈ UK 2:2)',
  targetTypes: [
    'masters_scholarship', 'postgraduate_diploma', 'fellowship',
    'research_programme', 'summer_school', 'bootcamp', 'funded_training',
    'conference', 'climate_programme', 'clean_air_programme', 'tech4dev_programme',
  ],
  fields: [
    'computer_science', 'information_technology', 'software_engineering',
    'cloud', 'devops', 'ai', 'ml', 'data_science', 'cybersecurity',
    'networks', 'distributed_systems', 'information_systems',
    'systems_engineering', 'software_architecture', 'automation',
    'tech4dev', 'env_tech', 'climate_tech', 'clean_air', 'sustainability',
  ],
  fundingPreference: 'fully_plus_mostly',
  academicStrictness: 'balanced',
  destinations: ['uk', 'europe', 'canada', 'usa', 'australia_nz', 'africa', 'japan', 'south_korea', 'china'],
  careerPriorities: ['funding', 'programme_relevance', 'easy_eligibility'],
  environmentalInterest: 'strongly_prioritize',
  shortProgrammes: ['summer_school', 'bootcamp', 'fellowship', 'conference'],
  sourceTrust: 'official_plus_reputable',
  deadlinePreference: 'any',
  uncertainEligibility: 'show_with_warning',
  detailPreference: 'both',
  careerInterests: ['devops', 'cloud', 'solutions engineering', 'ai automation', 'clean air', 'air quality', 'climate', 'sustainability'],
  updatedAt: new Date(0).toISOString(),
};

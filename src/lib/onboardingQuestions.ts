import type { UserProfile } from '../core/types';

/**
 * The onboarding wizard definition — a professional matching assessment.
 * Every question maps onto UserProfile fields; defaults come from the current
 * profile object (seeded with the specification defaults), and everything is
 * editable again later in Settings.
 */

export interface Option {
  value: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  eyebrow: string;
  title: string;
  help?: string;
  multi: boolean;
  options: Option[];
  getValue: (p: UserProfile) => string[] | string;
  setValue: (p: UserProfile, v: string[] & string[] | string[]) => UserProfile;
}

const set = (p: UserProfile, patch: Partial<UserProfile>): UserProfile => ({ ...p, ...patch });

export const QUESTIONS: Question[] = [
  {
    id: 'types',
    eyebrow: 'Question 1 · Targets',
    title: 'What are you primarily looking for?',
    help: 'Select every opportunity type the discovery engine should hunt for.',
    multi: true,
    options: [
      { value: 'masters_scholarship', label: "Master's scholarships", description: 'Fully funded MSc/MA programmes — your primary target' },
      { value: 'postgraduate_diploma', label: 'Postgraduate diplomas', description: 'Shorter credential programmes' },
      { value: 'graduate_certificate', label: 'Graduate certificates' },
      { value: 'fellowship', label: 'Fellowships', description: 'Professional and research fellowships' },
      { value: 'research_programme', label: 'Research programmes' },
      { value: 'summer_school', label: 'Summer schools' },
      { value: 'bootcamp', label: 'Technology boot camps' },
      { value: 'funded_training', label: 'Funded training' },
      { value: 'conference', label: 'Conferences', description: 'Funded conference attendance' },
      { value: 'climate_programme', label: 'Climate/environment programmes' },
      { value: 'clean_air_programme', label: 'Clean-air programmes', description: 'Like programmes you have participated in before' },
      { value: 'tech4dev_programme', label: 'Technology-for-development' },
    ],
    getValue: (p) => p.targetTypes,
    setValue: (p, v) => set(p, { targetTypes: v as UserProfile['targetTypes'] }),
  },
  {
    id: 'fields',
    eyebrow: 'Question 2 · Academic fields',
    title: 'Which study areas should be prioritized?',
    multi: true,
    options: [
      { value: 'computer_science', label: 'Computer Science' },
      { value: 'information_technology', label: 'Information Technology' },
      { value: 'software_engineering', label: 'Software Engineering' },
      { value: 'cloud', label: 'Cloud Computing' },
      { value: 'devops', label: 'DevOps / SRE' },
      { value: 'ai', label: 'Artificial Intelligence' },
      { value: 'ml', label: 'Machine Learning' },
      { value: 'data_science', label: 'Data Science' },
      { value: 'cybersecurity', label: 'Cybersecurity' },
      { value: 'networks', label: 'Computer Networks' },
      { value: 'distributed_systems', label: 'Distributed Systems' },
      { value: 'information_systems', label: 'Information Systems' },
      { value: 'systems_engineering', label: 'Systems Engineering' },
      { value: 'software_architecture', label: 'Software Architecture' },
      { value: 'automation', label: 'Automation' },
      { value: 'tech4dev', label: 'Technology for Development' },
      { value: 'env_tech', label: 'Environmental Technology' },
      { value: 'climate_tech', label: 'Climate Technology' },
      { value: 'clean_air', label: 'Clean Air Technology' },
      { value: 'sustainability', label: 'Sustainability Technology' },
    ],
    getValue: (p) => p.fields,
    setValue: (p, v) => set(p, { fields: v }),
  },
  {
    id: 'funding',
    eyebrow: 'Question 3 · Funding',
    title: 'What is your funding preference?',
    multi: false,
    options: [
      { value: 'fully_funded_only', label: 'Fully funded only', description: 'Tuition + living costs covered — strictest filter' },
      { value: 'fully_plus_mostly', label: 'Fully funded + mostly funded', description: 'Recommended — keeps strong near-full awards visible' },
      { value: 'any_scholarship', label: 'Any scholarship', description: 'Includes partial funding and waivers' },
      { value: 'include_unfunded', label: 'Include unfunded if exceptional', description: 'Broadest — shows everything relevant' },
    ],
    getValue: (p) => p.fundingPreference,
    setValue: (p, v) => set(p, { fundingPreference: v[0] as UserProfile['fundingPreference'] }),
  },
  {
    id: 'strictness',
    eyebrow: 'Question 4 · Academic eligibility',
    title: 'How strictly should academic requirements be applied?',
    help: 'Your profile: 52% CWA · Second Class Lower · ≈ UK 2:2. ScholarScout never converts this to a foreign GPA — it reads each source\u2019s exact requirement.',
    multi: false,
    options: [
      { value: 'strict', label: 'Strict', description: 'Hide programmes whose stated requirement is above a 2:2' },
      { value: 'balanced', label: 'Balanced', description: 'Show borderline programmes with clear warnings (recommended)' },
      { value: 'broad', label: 'Broad', description: 'Show anything potentially possible, ranked lower' },
    ],
    getValue: (p) => p.academicStrictness,
    setValue: (p, v) => set(p, { academicStrictness: v[0] as UserProfile['academicStrictness'] }),
  },
  {
    id: 'destinations',
    eyebrow: 'Question 5 · Destinations',
    title: 'Where would you like to study or participate?',
    multi: true,
    options: [
      { value: 'uk', label: 'United Kingdom' },
      { value: 'europe', label: 'Europe (EU/EEA)' },
      { value: 'canada', label: 'Canada' },
      { value: 'usa', label: 'United States' },
      { value: 'australia_nz', label: 'Australia / New Zealand' },
      { value: 'africa', label: 'Africa' },
      { value: 'japan', label: 'Japan' },
      { value: 'south_korea', label: 'South Korea' },
      { value: 'china', label: 'China' },
      { value: 'no_preference', label: 'No strong preference' },
    ],
    getValue: (p) => p.destinations,
    setValue: (p, v) => set(p, { destinations: v }),
  },
  {
    id: 'priorities',
    eyebrow: 'Question 6 · Priorities',
    title: 'What matters most to you?',
    help: 'Pick up to three — these influence how ties are broken.',
    multi: true,
    options: [
      { value: 'funding', label: 'Funding strength' },
      { value: 'reputation', label: 'University reputation' },
      { value: 'career_outcomes', label: 'Career outcomes' },
      { value: 'easy_eligibility', label: 'Realistic eligibility' },
      { value: 'location', label: 'Location' },
      { value: 'programme_relevance', label: 'Programme relevance' },
      { value: 'deadline_urgency', label: 'Deadline urgency' },
    ],
    getValue: (p) => p.careerPriorities,
    setValue: (p, v) => set(p, { careerPriorities: v }),
  },
  {
    id: 'environment',
    eyebrow: 'Question 7 · Environment & climate',
    title: 'Would you consider environmental / climate / clean-air programmes?',
    multi: false,
    options: [
      { value: 'strongly_prioritize', label: 'Strongly prioritize', description: 'Boost climate & clean-air opportunities (matches your background)' },
      { value: 'include', label: 'Include normally' },
      { value: 'tech_only', label: 'Only if technology-related' },
      { value: 'exclude', label: 'Not interested' },
    ],
    getValue: (p) => p.environmentalInterest,
    setValue: (p, v) => set(p, { environmentalInterest: v[0] as UserProfile['environmentalInterest'] }),
  },
  {
    id: 'short',
    eyebrow: 'Question 8 · Short programmes',
    title: 'Which short programmes would you attend?',
    multi: true,
    options: [
      { value: 'summer_school', label: 'Summer schools' },
      { value: 'bootcamp', label: 'Boot camps' },
      { value: 'fellowship', label: 'Fellowships' },
      { value: 'conference', label: 'Conferences' },
    ],
    getValue: (p) => p.shortProgrammes,
    setValue: (p, v) => set(p, { shortProgrammes: v }),
  },
  {
    id: 'trust',
    eyebrow: 'Question 9 · Source trust',
    title: 'How far should the discovery engine search?',
    multi: false,
    options: [
      { value: 'official_only', label: 'Only official sources', description: 'Government portals, universities, official organizations' },
      { value: 'official_plus_reputable', label: 'Official + reputable organizations', description: 'Recommended — adds well-known opportunity publishers, still verified' },
      { value: 'broad_verified', label: 'Broad discovery with verification', description: 'Widest net; everything still links to official pages' },
    ],
    getValue: (p) => p.sourceTrust,
    setValue: (p, v) => set(p, { sourceTrust: v[0] as UserProfile['sourceTrust'] }),
  },
  {
    id: 'deadline',
    eyebrow: 'Question 10 · Deadlines',
    title: 'What is your deadline preference?',
    multi: false,
    options: [
      { value: 'any', label: 'Show everything', description: 'Any deadline, sorted by match quality' },
      { value: 'within_30', label: 'Within 30 days' },
      { value: 'within_90', label: 'Within 90 days' },
      { value: 'earliest_first', label: 'Prioritize earliest deadlines' },
    ],
    getValue: (p) => p.deadlinePreference,
    setValue: (p, v) => set(p, { deadlinePreference: v[0] as UserProfile['deadlinePreference'] }),
  },
  {
    id: 'uncertain',
    eyebrow: 'Question 11 · Uncertain eligibility',
    title: 'When Ghanaian eligibility cannot be confirmed, ScholarScout should…',
    multi: false,
    options: [
      { value: 'hide', label: 'Hide those opportunities', description: 'Strictest — only confirmed eligibility' },
      { value: 'show_with_warning', label: 'Show them with a clear warning', description: 'Recommended — nothing slips by, nothing is overstated' },
      { value: 'separate_section', label: 'Move them to a "Check Eligibility" section' },
    ],
    getValue: (p) => p.uncertainEligibility,
    setValue: (p, v) => set(p, { uncertainEligibility: v[0] as UserProfile['uncertainEligibility'] }),
  },
  {
    id: 'detail',
    eyebrow: 'Question 12 · Detail level',
    title: 'How much detail do you want in your feed?',
    multi: false,
    options: [
      { value: 'quick', label: 'Quick cards', description: 'Compact — badges and score only' },
      { value: 'detailed', label: 'Detailed cards', description: 'Summaries, match reasons and concerns inline' },
      { value: 'both', label: 'Both', description: 'Detailed feed + full detail pages (recommended)' },
    ],
    getValue: (p) => p.detailPreference,
    setValue: (p, v) => set(p, { detailPreference: v[0] as UserProfile['detailPreference'] }),
  },
];

import type { OpportunityType, StudyLevel } from '../types';

interface TypeRule { re: RegExp; type: OpportunityType }

const RULES: TypeRule[] = [
  { re: /\b(summer school)\b/i, type: 'summer_school' },
  { re: /\b(summer camp)\b/i, type: 'summer_camp' },
  { re: /\b(boot ?camp)\b/i, type: 'bootcamp' },
  { re: /\b(fellowship|fellows? program)\b/i, type: 'fellowship' },
  { re: /\b(conference|symposium|summit|congress)\b/i, type: 'conference' },
  { re: /\b(clean air|air quality|air pollution)\b/i, type: 'clean_air_programme' },
  { re: /\b(climate|environment(?:al)?|sustainab)\b.{0,60}\b(programme|program|challenge|accelerator|initiative|lab)\b/i, type: 'climate_programme' },
  { re: /\b(ict4d|tech(?:nology)? for (?:development|good))\b/i, type: 'tech4dev_programme' },
  { re: /\b(research (?:programme|program|internship|position|opportunit))\b/i, type: 'research_programme' },
  { re: /\b(postgraduate diploma|pgdip)\b/i, type: 'postgraduate_diploma' },
  { re: /\b(graduate certificate)\b/i, type: 'graduate_certificate' },
  { re: /\b(training (?:programme|program|course)|intensive (?:course|training)|funded training)\b/i, type: 'funded_training' },
  { re: /\b(master'?s?|msc|ma\b|mphil|graduate scholarship|postgraduate scholarship)\b/i, type: 'masters_scholarship' },
  { re: /\b(scholarship)\b/i, type: 'masters_scholarship' },
];

export function classifyOpportunityType(text: string | null | undefined): OpportunityType {
  if (!text) return 'other';
  for (const rule of RULES) if (rule.re.test(text)) return rule.type;
  return 'other';
}

export function classifyStudyLevel(text: string | null | undefined): StudyLevel {
  if (!text) return 'unknown';
  if (/\b(postgraduate diploma|pgdip)\b/i.test(text)) return 'postgraduate_diploma';
  if (/\b(graduate certificate)\b/i.test(text)) return 'graduate_certificate';
  if (/\b(master'?s?|msc|m\.sc|ma degree|mphil|graduate (?:degree|study|studies))\b/i.test(text)) return 'masters';
  if (/\b(phd|ph\.d|doctora)\b/i.test(text)) return 'phd';
  if (/\b(summer school|boot ?camp|short course|training|conference|workshop)\b/i.test(text)) return 'non_degree';
  if (/\b(any (?:degree )?level|all levels|undergraduate and postgraduate)\b/i.test(text)) return 'any';
  return 'unknown';
}

export const TYPE_LABELS: Record<OpportunityType, string> = {
  masters_scholarship: "Master's Scholarship",
  postgraduate_diploma: 'Postgraduate Diploma',
  graduate_certificate: 'Graduate Certificate',
  fellowship: 'Fellowship',
  research_programme: 'Research Programme',
  summer_school: 'Summer School',
  summer_camp: 'Summer Camp',
  bootcamp: 'Boot Camp',
  funded_training: 'Funded Training',
  conference: 'Conference',
  climate_programme: 'Climate Programme',
  clean_air_programme: 'Clean Air Programme',
  tech4dev_programme: 'Tech for Development',
  other: 'Opportunity',
};

export const LEVEL_LABELS: Record<StudyLevel, string> = {
  masters: "Master's",
  postgraduate_diploma: 'PG Diploma',
  graduate_certificate: 'Grad Certificate',
  phd: 'PhD',
  non_degree: 'Non-degree',
  any: 'Any Level',
  unknown: 'Level Unknown',
};

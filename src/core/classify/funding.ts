import type { FundingType } from '../types';

/** Rule-based funding classification from source text. */

interface FundingRule { re: RegExp; type: FundingType }

const RULES: FundingRule[] = [
  { re: /\bfully[- ]funded\b.{0,160}\b(stipend|living (?:allowance|costs?|expenses)|monthly allowance)\b/is, type: 'fully_funded_stipend' },
  { re: /\b(full tuition|tuition fees?)\b.{0,160}\b(stipend|living (?:allowance|costs?)|monthly (?:allowance|stipend))\b/is, type: 'tuition_stipend' },
  { re: /\bfully[- ]funded\b/i, type: 'fully_funded' },
  { re: /\b(covers? (?:all|full) (?:costs?|expenses)|all expenses paid|full (?:scholarship|funding|award)|100% (?:scholarship|funding|of tuition))\b/i, type: 'fully_funded' },
  { re: /\b(tuition fees?,? (?:flights?|airfare|travel),? (?:and )?(?:a )?(?:living|monthly) (?:allowance|stipend))\b/i, type: 'fully_funded_stipend' },
  { re: /\b(mostly funded|substantial(?:ly)? fund|majority of (?:the )?costs?)\b/i, type: 'mostly_funded' },
  { re: /\b(tuition[- ](?:fee[- ])?waiver|fee waiver|waives? (?:the )?tuition|tuition[- ]free|no tuition fees?)\b/i, type: 'tuition_waiver' },
  { re: /\b(travel (?:grants?|funding|support|bursar(?:y|ies)?)|conference funding|funded (?:travel|attendance)|covers? travel)\b/i, type: 'travel_funded' },
  { re: /\b(partial(?:ly)?[- ]fund|partial scholarship|part[- ]funded|50% (?:scholarship|of tuition)|contribution towards?)\b/i, type: 'partial' },
  { re: /\b(unfunded|no funding|self[- ]funded|at your own (?:cost|expense)|participants? (?:must )?cover)\b/i, type: 'unfunded' },
];

export function classifyFunding(text: string | null | undefined): { type: FundingType; evidence: string | null } {
  if (!text || !text.trim()) return { type: 'unknown', evidence: null };
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (m) {
      const evidence = m[0].trim().replace(/\s+/g, ' ').slice(0, 240);
      return { type: rule.type, evidence };
    }
  }
  return { type: 'unknown', evidence: null };
}

export const FUNDING_LABELS: Record<FundingType, string> = {
  fully_funded: 'FULLY FUNDED',
  fully_funded_stipend: 'FULLY FUNDED + STIPEND',
  tuition_stipend: 'TUITION + STIPEND',
  mostly_funded: 'MOSTLY FUNDED',
  partial: 'PARTIALLY FUNDED',
  tuition_waiver: 'TUITION WAIVER',
  travel_funded: 'TRAVEL FUNDED',
  unfunded: 'UNFUNDED',
  unknown: 'FUNDING UNKNOWN',
};

/** Funding priority order — higher is better. */
export const FUNDING_PRIORITY: Record<FundingType, number> = {
  fully_funded_stipend: 8,
  fully_funded: 7,
  tuition_stipend: 6,
  mostly_funded: 5,
  partial: 4,
  tuition_waiver: 3,
  travel_funded: 2,
  unfunded: 0,
  unknown: 1,
};

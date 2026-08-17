import type { GhanaEligibility } from '../types';

/**
 * Rule-based Ghanaian-eligibility classification.
 * The rules are conservative: we only claim eligibility when the source text
 * establishes it. Anything else stays "unknown".
 */

const GHANA_RE = /\bghana(?:ian)?s?\b/i;
const AFRICA_RE = /\b(african (?:nationals?|citizens?|applicants?|students?|countries)|sub-?saharan africa|africa(?:n)? (?:union|continent)|citizens? of (?:an )?african (?:countries|states?|nations?)|from africa)\b/i;
const INTERNATIONAL_RE = /\b(all nationalities|any nationality|international (?:students?|applicants?|candidates?)|students? (?:from|of) (?:all|any) (?:countries|nationalit)|open to (?:students?|applicants?|candidates?) (?:worldwide|globally|from (?:all|any) countr)|worldwide|globally open|developing countries|low[- ]and middle[- ]income countries|commonwealth (?:countries|citizens)|odA[- ]eligible)\b/i;

/** Phrases that positively restrict to a nationality set that excludes Ghana. */
const RESTRICTED_PATTERNS: { re: RegExp; note: string }[] = [
  { re: /\b(?:only|restricted to|exclusively for|limited to)\s+(?:citizens?|nationals?|residents?)\s+of\s+(?!.*\b(ghana|africa|commonwealth|developing)\b)/i, note: 'restricted-nationals' },
  { re: /\bmust be (?:a )?(?:us|u\.s\.|american|uk|british|eu|european union|canadian|australian) citizens?\b/i, note: 'restricted-citizen' },
  { re: /\bopen only to (?:us|u\.s\.|uk|eu|domestic) (?:students?|applicants?|citizens?)\b/i, note: 'domestic-only' },
  { re: /\bdomestic (?:students?|applicants?) only\b/i, note: 'domestic-only' },
];

/** Country lists sometimes enumerate eligible states; check for Ghana in them. */
const COUNTRY_LIST_CUE = /\beligible countries\b|\bthe following countries\b|\bcitizens? of[:\s]/i;

export interface NationalityClassification {
  eligibility: GhanaEligibility;
  evidence: string | null;
}

function sentenceContaining(text: string, re: RegExp): string | null {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  for (const s of sentences) {
    if (re.test(s)) return s.trim().replace(/\s+/g, ' ').slice(0, 300);
  }
  return null;
}

export function classifyNationality(text: string | null | undefined): NationalityClassification {
  if (!text || !text.trim()) return { eligibility: 'unknown', evidence: null };

  // 1) Explicit restriction that excludes Ghana beats everything except an
  //    explicit Ghana mention.
  const ghanaEvidence = sentenceContaining(text, GHANA_RE);
  if (ghanaEvidence) return { eligibility: 'ghana_eligible', evidence: ghanaEvidence };

  for (const { re } of RESTRICTED_PATTERNS) {
    const ev = sentenceContaining(text, re);
    if (ev) return { eligibility: 'restricted', evidence: ev };
  }

  // 2) Explicit country list without Ghana: if the text enumerates eligible
  //    countries and never mentions Ghana or Africa, treat as restricted.
  if (COUNTRY_LIST_CUE.test(text) && !AFRICA_RE.test(text) && !INTERNATIONAL_RE.test(text)) {
    const ev = sentenceContaining(text, COUNTRY_LIST_CUE);
    return { eligibility: 'restricted', evidence: ev };
  }

  const africaEvidence = sentenceContaining(text, AFRICA_RE);
  if (africaEvidence) return { eligibility: 'africa_eligible', evidence: africaEvidence };

  const intlEvidence = sentenceContaining(text, INTERNATIONAL_RE);
  if (intlEvidence) return { eligibility: 'international', evidence: intlEvidence };

  return { eligibility: 'unknown', evidence: null };
}

export const GHANA_ELIGIBILITY_LABELS: Record<GhanaEligibility, string> = {
  ghana_eligible: 'Ghana Eligible',
  africa_eligible: 'African Applicants Eligible',
  international: 'Open Internationally',
  restricted: 'Restricted Nationality',
  unknown: 'Eligibility Not Established',
};

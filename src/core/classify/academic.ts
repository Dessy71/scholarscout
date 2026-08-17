import type { AcademicFit } from '../types';

/**
 * Academic-requirement classification for a Ghanaian applicant with
 * 52% CWA / Second Class Lower / ≈ UK 2:2.
 *
 * PRINCIPLES (from the spec):
 *  - Extract the exact requirement wording; never translate 52% into a GPA.
 *  - Never invent equivalencies. Interpretation is shown separately.
 *  - "No stated threshold" → UNKNOWN, not eligible.
 */

export interface AcademicClassification {
  fit: AcademicFit;
  /** Exact requirement sentence from the source, or null. */
  requirementText: string | null;
  /** Our separate, clearly-labelled interpretation. */
  interpretation: string | null;
}

interface Rule {
  re: RegExp;
  fit: AcademicFit;
  interpretation: string;
}

/** Ordered rules — first match wins. Most specific / most exclusionary first. */
const RULES: Rule[] = [
  // Explicit first-class / distinction requirements → likely ineligible for a 2:2
  {
    re: /\b(first[- ]class(?:\s+honours)?(?:\s+degree)?(?:\s+(?:required|only|is required))?|minimum (?:of )?(?:a )?first[- ]class)\b/i,
    fit: 'likely_ineligible',
    interpretation: 'Requires a First Class degree — above a Second Class Lower (2:2). Likely a poor academic match.',
  },
  {
    re: /\bminimum (?:of )?(7[0-9]|[89][0-9])\s?%/i,
    fit: 'likely_ineligible',
    interpretation: 'Requires a minimum percentage well above 52%. Likely a poor academic match.',
  },
  {
    re: /\bgpa (?:of )?(?:at least )?(3\.[5-9]|4\.0)\b.{0,20}(?:\/|out of)?\s*4/i,
    fit: 'likely_ineligible',
    interpretation: 'Requires a high GPA on a 4.0 scale. A Ghanaian 2:2 is unlikely to be assessed as equivalent, but only the university can confirm.',
  },
  // 2:1 / upper second requirements → likely ineligible but sometimes flexible
  {
    re: /\b(2[.:]1|two[- ]one|upper[- ]second[- ]class|second[- ]class (?:honours[, ]*)?(?:upper|\(upper\)|upper division))\b/i,
    fit: 'likely_ineligible',
    interpretation: 'Requires a UK 2:1 / Second Class Upper. A 52% CWA (2:2) is below this threshold. Some universities consider work experience — check directly.',
  },
  // Explicit 2:2 acceptance → clearly eligible territory
  {
    re: /\b(2[.:]2|two[- ]two|lower[- ]second[- ]class|second[- ]class (?:honours[, ]*)?(?:lower|\(lower\)|lower division))\b/i,
    fit: 'clearly_eligible',
    interpretation: 'A UK 2:2 / Second Class Lower is explicitly accepted. Your Second Class Lower (52% CWA) matches this band, subject to the university\u2019s Ghana equivalency table.',
  },
  {
    re: /\bminimum (?:of )?(?:a )?(?:50|51|52)\s?%/i,
    fit: 'clearly_eligible',
    interpretation: 'The stated minimum percentage is at or below 52%.',
  },
  // Generic honours degree / any degree wording → potentially eligible
  {
    re: /\b(second[- ]class (?:honours|degree)|honours degree|good (?:first |undergraduate )?degree|bachelor[’']?s? degree (?:or equivalent|in a relevant)|an? (?:undergraduate|first) degree)\b/i,
    fit: 'potentially_eligible',
    interpretation: 'A degree is required but no specific class threshold that excludes a 2:2 was stated. Verify the programme\u2019s Ghana-specific entry requirements.',
  },
  {
    re: /\bgpa (?:of )?(?:at least )?([0-2]\.\d|3\.0|3\.2|3\.25|3\.3)\b/i,
    fit: 'unclear',
    interpretation: 'A GPA threshold is stated on a foreign scale. Do not assume an equivalency for a 52% CWA — confirm with the institution\u2019s own conversion table.',
  },
];

function findSentence(text: string, re: RegExp): string | null {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  for (const s of sentences) if (re.test(s)) return s.trim().replace(/\s+/g, ' ').slice(0, 300);
  return null;
}

export function classifyAcademic(text: string | null | undefined): AcademicClassification {
  if (!text || !text.trim()) {
    return { fit: 'unknown', requirementText: null, interpretation: 'The source does not state an academic threshold. Academic requirement unknown.' };
  }
  for (const rule of RULES) {
    if (rule.re.test(text)) {
      return {
        fit: rule.fit,
        requirementText: findSentence(text, rule.re) ?? null,
        interpretation: rule.interpretation,
      };
    }
  }
  return { fit: 'unknown', requirementText: null, interpretation: 'The source does not state an academic threshold. Academic requirement unknown.' };
}

export const ACADEMIC_FIT_LABELS: Record<AcademicFit, string> = {
  clearly_eligible: 'Clearly Eligible',
  potentially_eligible: 'Potentially Eligible',
  unclear: 'Unclear',
  likely_ineligible: 'Likely Ineligible',
  unknown: 'Requirement Unknown',
};

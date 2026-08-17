/**
 * Optional enrichment hook (spec §NO FAKE AI).
 *
 * The core pipeline is fully rule-based and needs no AI provider. If you ever
 * want AI-assisted summarization or eligibility interpretation, implement
 * `aiEnrich` here against your provider of choice and set AI_PROVIDER /
 * AI_API_KEY in the environment. When unset, this module is a no-op.
 */
import type { Opportunity } from '../core/types';

export interface Enricher {
  name: string;
  enrich(opportunity: Opportunity, pageText: string | null): Promise<Partial<Opportunity>>;
}

export function getEnricher(): Enricher | null {
  const provider = process.env.AI_PROVIDER;
  if (!provider) return null;
  // Plug an implementation in here, e.g.:
  //   if (provider === 'openai-compatible') return new OpenAICompatibleEnricher(...)
  console.warn(`[enrich] AI_PROVIDER="${provider}" set but no enricher implemented; continuing rule-based.`);
  return null;
}

import type {
  Dataset, Opportunity, OpportunityChange, Source,
  UpdateRun, UserProfile, VerificationStatus,
} from '../core/types';
import type { StorageAdapter } from '../store/adapter';
import { canonicalizeUrl, isHttpUrl } from '../core/url';
import { contentHash, opportunityId } from '../core/hash';
import { classifyNationality } from '../core/classify/nationality';
import { classifyAcademic } from '../core/classify/academic';
import { classifyFunding } from '../core/classify/funding';
import { matchFields } from '../core/classify/fields';
import { classifyOpportunityType, classifyStudyLevel } from '../core/classify/opportunityType';
import { extractDeadlineFromText, classifyDeadline } from '../core/deadline';
import { computeMatch, regionForCountry } from '../core/score';
import { DEFAULT_PROFILE } from '../core/profileDefaults';
import { respectfulFetch, checkRobots } from './fetcher';
import { parseFeed, parseSitemap, parseHtmlList, extractPage, type RawItem } from './parsers';
import { getEnricher } from './enrich';

export interface PipelineOptions {
  trigger: UpdateRun['trigger'];
  /** Max detail pages fetched per source (rate-limit friendly). */
  maxPagesPerSource?: number;
  /** Only process these source ids (for batched serverless runs). */
  sourceIds?: string[];
  onProgress?: (event: ProgressEvent) => void;
  now?: Date;
  /** Skip network fetching of item detail pages (fast mode). */
  fetchDetailPages?: boolean;
  /**
   * Wall-clock budget in ms. Once exceeded, remaining sources are marked
   * skipped_time and the run completes gracefully (serverless safety).
   */
  timeBudgetMs?: number;
}

export interface ProgressEvent {
  type: 'source_start' | 'source_done' | 'item' | 'run_done';
  sourceId?: string;
  sourceName?: string;
  message: string;
}

const MAX_FAILURES_BEFORE_WARN = 5;

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

/** Fields whose changes are user-meaningful and worth surfacing as UPDATED. */
const TRACKED_FIELDS: (keyof Opportunity)[] = [
  'title', 'fundingType', 'fundingDetails', 'academicRequirement',
  'eligibilityText', 'summary', 'applicationUrl',
];

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Secondary duplicate key: normalized title + organization + deadline. */
function secondaryKey(o: Pick<Opportunity, 'title' | 'organization' | 'deadline'>): string {
  return `${normalizeTitle(o.title)}::${o.organization.toLowerCase().trim()}::${o.deadline.date ?? 'null'}`;
}

interface BuiltOpportunity {
  opportunity: Opportunity;
  pageText: string | null;
}

/** Turn a raw discovered item into a fully classified Opportunity. */
export function buildOpportunity(
  raw: RawItem,
  source: Source,
  profile: UserProfile,
  options: { pageText?: string | null; verification: VerificationStatus; now?: Date },
): BuiltOpportunity {
  const now = options.now ?? new Date();
  const canonical = canonicalizeUrl(raw.url);
  const analysisText = [raw.title, raw.summary ?? '', options.pageText ?? ''].join('\n');

  const nationality = classifyNationality(analysisText);
  const academic = classifyAcademic(analysisText);
  const funding = classifyFunding(analysisText);
  const fieldMatch = matchFields(analysisText);
  const type = source.seed?.type ?? classifyOpportunityType(analysisText);
  const level = source.seed?.level ?? classifyStudyLevel(analysisText);
  const deadline = extractDeadlineFromText(options.pageText ?? raw.summary ?? '');

  // Ghana-specific sources establish Ghana eligibility by definition.
  let ghanaEligibility = nationality.eligibility;
  if (source.country === 'Ghana' && ghanaEligibility === 'unknown') {
    ghanaEligibility = 'ghana_eligible';
  }

  const country = source.seed?.country ?? source.country ?? null;
  const region = source.seed?.region ?? source.region ?? regionForCountry(country);

  // Verification: needs_review when the important trio (deadline, funding,
  // nationality) is mostly unestablished despite a successful fetch.
  let verification = options.verification;
  if (verification === 'verified') {
    const unknowns = [
      deadline.date === null,
      funding.type === 'unknown',
      ghanaEligibility === 'unknown',
    ].filter(Boolean).length;
    if (unknowns >= 2) verification = 'needs_review';
  }

  const summary =
    (source.seed?.summary && source.parser === 'html_page' ? source.seed.summary : null) ??
    raw.summary ??
    (options.pageText ? options.pageText.replace(/\s+/g, ' ').slice(0, 320) : null);

  const hashInput = [
    raw.title, summary ?? '', funding.evidence ?? '', academic.requirementText ?? '',
    nationality.evidence ?? '', deadline.date ?? '', deadline.rawText ?? '',
  ].join('|');

  const match = computeMatch({
    ghanaEligibility,
    fundingType: funding.type,
    academicFit: academic.fit,
    fields: fieldMatch.matchedFields,
    environmental: fieldMatch.environmental,
    adjacentOnly: fieldMatch.adjacentOnly,
    openToAllFields: fieldMatch.openToAllFields,
    country,
    region,
    deadlineDate: deadline.date,
    type,
    verificationStatus: verification,
    title: raw.title,
    summary,
  }, profile, now);

  const opportunity: Opportunity = {
    id: opportunityId(canonical),
    title: source.seed?.title && source.parser === 'html_page' ? source.seed.title : raw.title,
    organization: source.seed?.organization ?? source.name,
    university: source.seed?.university ?? null,
    country,
    city: null,
    region,
    fields: fieldMatch.matchedFields,
    level,
    type,
    fundingType: funding.type,
    fundingDetails: funding.evidence,
    eligibilityText: nationality.evidence,
    academicRequirement: academic.requirementText,
    academicFit: academic.fit,
    nationalityRequirement: nationality.evidence,
    ghanaEligibility,
    deadline,
    startDate: null,
    duration: null,
    summary,
    applicationUrl: source.seed?.applicationUrl && source.parser === 'html_page' ? source.seed.applicationUrl : raw.url,
    sourceUrl: raw.url,
    canonicalUrl: canonical,
    sourceId: source.id,
    sourceName: source.name,
    discoveredAt: nowIso(now),
    updatedAt: nowIso(now),
    lastVerifiedAt: verification !== 'source_unavailable' ? nowIso(now) : null,
    contentHash: contentHash(hashInput),
    verificationStatus: verification,
    environmental: fieldMatch.environmental,
    match,
  };

  return { opportunity, pageText: options.pageText ?? null };
}

/** Should this raw item be kept at all? Cheap relevance pre-filter. */
export function isRelevantItem(raw: RawItem, source: Source): boolean {
  if (!isHttpUrl(raw.url)) return false;
  if (source.parser === 'html_page') return true;
  const text = `${raw.title} ${raw.summary ?? ''}`.toLowerCase();
  const RELEVANT = /(scholarship|fellowship|funded|funding|grant|bursary|master|postgraduate|graduate|summer school|boot ?camp|training|conference|internship|programme|program|climate|clean air|air quality|sustainab|tech)/i;
  if (!RELEVANT.test(text)) return false;
  // Aggregators: require the source's own keyword list too.
  if (source.sourceType === 'aggregator' && source.keywords?.length) {
    return source.keywords.some((k) => text.includes(k.toLowerCase()));
  }
  return true;
}

async function collectRawItems(source: Source, opts: PipelineOptions): Promise<{ items: RawItem[]; pages: number; error: string | null }> {
  const maxPages = opts.maxPagesPerSource ?? 5;
  let pages = 0;

  const res = await respectfulFetch(source.url);
  pages++;
  if (!res.ok || res.notModified) {
    return { items: [], pages, error: res.error ?? (res.notModified ? null : 'fetch-failed') };
  }

  switch (source.parser) {
    case 'rss':
    case 'atom': {
      return { items: parseFeed(res.body), pages, error: null };
    }
    case 'sitemap': {
      const urls = parseSitemap(res.body, source.keywords);
      const items: RawItem[] = [];
      for (const url of urls.slice(0, maxPages)) {
        const page = await respectfulFetch(url);
        pages++;
        if (!page.ok) continue;
        const ex = extractPage(page.body);
        if (!ex.title) continue;
        items.push({ title: ex.title, url, summary: ex.description, publishedAt: null, pageText: ex.bodyText });
      }
      return { items, pages, error: null };
    }
    case 'html_list': {
      const items = parseHtmlList(res.body, source, res.finalUrl);
      if (opts.fetchDetailPages !== false) {
        for (const item of items.slice(0, maxPages)) {
          const page = await respectfulFetch(item.url);
          pages++;
          if (page.ok && !page.notModified) {
            const ex = extractPage(page.body);
            item.pageText = ex.bodyText;
            if (!item.summary && ex.description) item.summary = ex.description;
          }
        }
      }
      return { items, pages, error: null };
    }
    case 'jsonld':
    case 'html_page': {
      const ex = extractPage(res.body);
      const title = source.seed?.title ?? ex.title ?? source.name;
      return {
        items: [{
          title,
          url: source.url,
          summary: ex.description,
          publishedAt: null,
          pageText: ex.bodyText,
        }],
        pages,
        error: null,
      };
    }
    default:
      return { items: [], pages, error: `unknown-parser-${source.parser}` };
  }
}

export interface PipelineResult {
  run: UpdateRun;
  dataset: Dataset;
}

/**
 * The full ingestion pipeline (spec §22):
 * load registry → fetch respectfully → parse → normalize → classify →
 * dedupe → score → persist → stats.
 *
 * One failed source never stops the run.
 */
export async function runPipeline(store: StorageAdapter, opts: PipelineOptions): Promise<PipelineResult> {
  const now = opts.now ?? new Date();
  const profile = (await store.loadProfile()) ?? DEFAULT_PROFILE;
  const sources = await store.loadSources();
  const dataset = await store.loadDataset();
  const enricher = getEnricher();

  const run: UpdateRun = {
    id: `run_${now.getTime()}`,
    trigger: opts.trigger,
    startedAt: nowIso(now),
    completedAt: null,
    status: 'running',
    sourcesChecked: 0,
    pagesFetched: 0,
    opportunitiesFound: 0,
    newItems: 0,
    updatedItems: 0,
    rejectedItems: 0,
    errors: [],
    sourceResults: [],
  };

  const byCanonical = new Map(dataset.opportunities.map((o) => [o.canonicalUrl, o] as const));
  const bySecondary = new Map(dataset.opportunities.map((o) => [secondaryKey(o), o] as const));
  const changes: OpportunityChange[] = [...dataset.changes];

  const selected = sources.filter((s) => !opts.sourceIds || opts.sourceIds.includes(s.id));
  const pipelineStart = Date.now();

  for (const source of selected) {
    const startedAt = Date.now();
    if (opts.timeBudgetMs && Date.now() - pipelineStart > opts.timeBudgetMs) {
      run.sourceResults.push({ sourceId: source.id, sourceName: source.name, status: 'skipped_time', fetchedPages: 0, found: 0, error: 'time budget exhausted — will be covered by the next scheduled run', durationMs: 0 });
      continue;
    }
    if (!source.active) {
      run.sourceResults.push({ sourceId: source.id, sourceName: source.name, status: 'skipped_inactive', fetchedPages: 0, found: 0, error: null, durationMs: 0 });
      continue;
    }
    opts.onProgress?.({ type: 'source_start', sourceId: source.id, sourceName: source.name, message: `Checking ${source.name}…` });
    run.sourcesChecked++;
    source.lastChecked = nowIso();

    try {
      const robots = await checkRobots(source.url);
      source.robotsStatus = robots;
      if (robots === 'disallowed') {
        run.sourceResults.push({ sourceId: source.id, sourceName: source.name, status: 'skipped_robots', fetchedPages: 0, found: 0, error: 'robots.txt disallows fetching', durationMs: Date.now() - startedAt });
        run.errors.push(`${source.name}: robots.txt disallows fetching`);
        continue;
      }

      const { items, pages, error } = await collectRawItems(source, opts);
      run.pagesFetched += pages;

      if (error) {
        source.failureCount++;
        run.errors.push(`${source.name}: ${error}`);
        run.sourceResults.push({ sourceId: source.id, sourceName: source.name, status: 'failed', fetchedPages: pages, found: 0, error, durationMs: Date.now() - startedAt });
        // Mark that source's existing items as source_unavailable (do not delete)
        for (const o of dataset.opportunities) {
          if (o.sourceId === source.id) o.verificationStatus = 'source_unavailable';
        }
        if (source.failureCount >= MAX_FAILURES_BEFORE_WARN) {
          run.errors.push(`${source.name}: ${source.failureCount} consecutive failures — consider reviewing this source`);
        }
        continue;
      }

      source.failureCount = 0;
      source.lastSuccess = nowIso();
      let found = 0;

      for (const raw of items) {
        if (!isRelevantItem(raw, source)) { run.rejectedItems++; continue; }
        found++;
        run.opportunitiesFound++;

        const { opportunity } = buildOpportunity(raw, source, profile, {
          pageText: raw.pageText,
          verification: source.trust === 'official' ? 'verified' : 'needs_review',
          now,
        });

        if (enricher) {
          try {
            const extra = await enricher.enrich(opportunity, raw.pageText);
            Object.assign(opportunity, extra);
          } catch { /* enrichment is best-effort */ }
        }

        // ── Deduplication ──
        const existing = byCanonical.get(opportunity.canonicalUrl) ?? bySecondary.get(secondaryKey(opportunity));
        if (existing) {
          if (existing.contentHash !== opportunity.contentHash) {
            // Changed — detect what changed
            const changed: OpportunityChange['changedFields'] = [];
            for (const field of TRACKED_FIELDS) {
              const from = existing[field] == null ? null : String(existing[field]);
              const to = opportunity[field] == null ? null : String(opportunity[field]);
              if (from !== to) changed.push({ field, from, to });
            }
            if (existing.deadline.date !== opportunity.deadline.date) {
              changed.push({ field: 'deadline', from: existing.deadline.date, to: opportunity.deadline.date });
            }
            if (changed.length > 0) {
              changes.unshift({ opportunityId: existing.id, changedAt: nowIso(), runId: run.id, changedFields: changed });
              run.updatedItems++;
            }
            const discoveredAt = existing.discoveredAt;
            Object.assign(existing, opportunity, { id: existing.id, discoveredAt });
          } else {
            // Unchanged — refresh verification timestamps only
            existing.lastVerifiedAt = nowIso();
            existing.verificationStatus = opportunity.verificationStatus;
            existing.match = opportunity.match; // rescore (deadline urgency shifts)
          }
        } else {
          dataset.opportunities.push(opportunity);
          byCanonical.set(opportunity.canonicalUrl, opportunity);
          bySecondary.set(secondaryKey(opportunity), opportunity);
          run.newItems++;
          opts.onProgress?.({ type: 'item', sourceId: source.id, message: `New: ${opportunity.title}` });
        }
      }

      run.sourceResults.push({ sourceId: source.id, sourceName: source.name, status: 'success', fetchedPages: pages, found, error: null, durationMs: Date.now() - startedAt });
      opts.onProgress?.({ type: 'source_done', sourceId: source.id, sourceName: source.name, message: `${source.name}: ${found} item(s)` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown-error';
      source.failureCount++;
      run.errors.push(`${source.name}: ${msg}`);
      run.sourceResults.push({ sourceId: source.id, sourceName: source.name, status: 'failed', fetchedPages: 0, found: 0, error: msg, durationMs: Date.now() - startedAt });
    }
  }

  // Rescore everything against "now" so deadline urgency stays fresh.
  for (const o of dataset.opportunities) {
    const bucket = classifyDeadline(o.deadline, now);
    if (bucket === 'expired') continue; // archived implicitly by UI filter
  }

  run.completedAt = nowIso();
  run.status = run.sourcesChecked > 0 && run.sourceResults.every((r) => r.status === 'failed') ? 'failed' : 'completed';

  dataset.generatedAt = nowIso();
  dataset.changes = changes.slice(0, 500);

  await store.saveDataset(dataset);
  await store.saveSources(sources);
  const runs = await store.loadRuns();
  await store.saveRuns([run, ...runs]);

  opts.onProgress?.({ type: 'run_done', message: `Done: ${run.newItems} new, ${run.updatedItems} updated, ${run.rejectedItems} rejected` });
  return { run, dataset };
}

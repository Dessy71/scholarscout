import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Dataset, Source, UpdateRun, UserProfile } from '../src/core/types';
import type { StorageAdapter } from '../src/store/adapter';
import { EMPTY_DATASET } from '../src/store/adapter';
import { DEFAULT_PROFILE } from '../src/core/profileDefaults';
import { runPipeline, buildOpportunity, isRelevantItem } from '../src/server/pipeline';
import { resetFetcherState } from '../src/server/fetcher';
import { extractPage } from '../src/server/parsers';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

class MemStore implements StorageAdapter {
  dataset: Dataset = JSON.parse(JSON.stringify({ ...EMPTY_DATASET }));
  runs: UpdateRun[] = [];
  profile: UserProfile = { ...DEFAULT_PROFILE, onboardingComplete: true };
  constructor(public sources: Source[]) {}
  async loadDataset() { return this.dataset; }
  async saveDataset(d: Dataset) { this.dataset = d; }
  async loadSources() { return this.sources; }
  async saveSources(s: Source[]) { this.sources = s; }
  async loadRuns() { return this.runs; }
  async saveRuns(r: UpdateRun[]) { this.runs = r; }
  async loadProfile() { return this.profile; }
  async saveProfile(p: UserProfile) { this.profile = p; }
}

function makeSource(partial: Partial<Source>): Source {
  return {
    id: 'src', name: 'Test Source', url: 'https://feeds.example.org/feed.xml',
    country: null, region: null, sourceType: 'aggregator', active: true,
    parser: 'rss', trust: 'reputable', notes: null,
    keywords: ['scholarship', 'fellowship', 'bootcamp', 'clean air', 'fully funded'],
    lastChecked: null, lastSuccess: null, failureCount: 0, robotsStatus: 'unknown',
    ...partial,
  };
}

/** Mock global fetch: robots.txt allowed everywhere, fixtures for known URLs. */
function mockFetch(routes: Record<string, { status: number; body: string } | 'error'>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/robots.txt')) {
      return new Response('User-agent: *\nAllow: /\n', { status: 200 });
    }
    for (const [route, resp] of Object.entries(routes)) {
      if (url.startsWith(route)) {
        if (resp === 'error') throw new Error('network down');
        return new Response(resp.body, { status: resp.status, headers: { 'content-type': 'text/html' } });
      }
    }
    return new Response('not found', { status: 404 });
  });
}

const NOW = new Date('2026-08-17T10:00:00Z');

describe('update pipeline (integration, fixture-backed)', () => {
  beforeEach(() => { vi.useRealTimers(); resetFetcherState(0); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('runs a complete update from an RSS fixture', async () => {
    vi.stubGlobal('fetch', mockFetch({
      'https://feeds.example.org/feed.xml': { status: 200, body: fixture('feed.xml') },
      'https://example.org/': { status: 200, body: '<html><body>ok</body></html>' },
    }));
    const store = new MemStore([makeSource({})]);
    const { run, dataset } = await runPipeline(store, { trigger: 'manual_cli', now: NOW, fetchDetailPages: false });

    expect(run.status).toBe('completed');
    expect(run.sourcesChecked).toBe(1);
    // 2 relevant items kept, gossip rejected
    expect(run.newItems).toBe(2);
    expect(run.rejectedItems).toBe(1);
    expect(dataset.opportunities).toHaveLength(2);

    const cs = dataset.opportunities.find((o) => o.title.includes('Computer Science'))!;
    expect(cs.ghanaEligibility).toBe('ghana_eligible'); // 'including Ghana' names Ghana explicitly
    expect(cs.fundingType).toBe('fully_funded_stipend');
    expect(cs.academicFit).toBe('clearly_eligible');
    expect(cs.deadline.date).toBe('2026-09-30');
    expect(cs.canonicalUrl).not.toContain('utm_source');
    expect(cs.match.score).toBeGreaterThan(70);

    const air = dataset.opportunities.find((o) => o.title.includes('Clean Air'))!;
    expect(air.environmental).toBe(true);
  });

  it('does not duplicate opportunities across repeated runs', async () => {
    vi.stubGlobal('fetch', mockFetch({
      'https://feeds.example.org/feed.xml': { status: 200, body: fixture('feed.xml') },
    }));
    const store = new MemStore([makeSource({})]);
    await runPipeline(store, { trigger: 'manual_cli', now: NOW, fetchDetailPages: false });
    const second = await runPipeline(store, { trigger: 'manual_cli', now: NOW, fetchDetailPages: false });

    expect(second.run.newItems).toBe(0);
    expect(second.dataset.opportunities).toHaveLength(2);
  });

  it('records an UPDATED change when content changes', async () => {
    vi.stubGlobal('fetch', mockFetch({
      'https://feeds.example.org/feed.xml': { status: 200, body: fixture('feed.xml') },
    }));
    const store = new MemStore([makeSource({})]);
    await runPipeline(store, { trigger: 'manual_cli', now: NOW, fetchDetailPages: false });

    const changed = fixture('feed.xml').replace('Deadline: 30 September 2026', 'Deadline: 15 October 2026');
    vi.stubGlobal('fetch', mockFetch({
      'https://feeds.example.org/feed.xml': { status: 200, body: changed },
    }));
    const second = await runPipeline(store, { trigger: 'manual_cli', now: NOW, fetchDetailPages: false });

    expect(second.run.updatedItems).toBe(1);
    expect(second.dataset.changes.length).toBeGreaterThan(0);
    const change = second.dataset.changes[0];
    expect(change.changedFields.some((f) => f.field === 'deadline' && f.to === '2026-10-15')).toBe(true);
  });

  it('one failed source never stops the update', async () => {
    vi.stubGlobal('fetch', mockFetch({
      'https://broken.example.org/feed.xml': 'error',
      'https://feeds.example.org/feed.xml': { status: 200, body: fixture('feed.xml') },
    }));
    const store = new MemStore([
      makeSource({ id: 'broken', name: 'Broken Source', url: 'https://broken.example.org/feed.xml' }),
      makeSource({ id: 'ok', name: 'Working Source' }),
    ]);
    const { run, dataset } = await runPipeline(store, { trigger: 'manual_cli', now: NOW, fetchDetailPages: false });

    expect(run.status).toBe('completed');
    expect(run.errors.some((e) => e.includes('Broken Source'))).toBe(true);
    expect(run.sourceResults.find((r) => r.sourceId === 'broken')!.status).toBe('failed');
    expect(run.sourceResults.find((r) => r.sourceId === 'ok')!.status).toBe('success');
    expect(dataset.opportunities.length).toBeGreaterThan(0);
    expect(store.sources.find((s) => s.id === 'broken')!.failureCount).toBe(1);
  });

  it('respects robots.txt disallow', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /\n', { status: 200 });
      return new Response(fixture('feed.xml'), { status: 200 });
    }));
    const store = new MemStore([makeSource({})]);
    const { run } = await runPipeline(store, { trigger: 'manual_cli', now: NOW });
    expect(run.sourceResults[0].status).toBe('skipped_robots');
    expect(run.newItems).toBe(0);
  });

  it('skips inactive sources', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    const store = new MemStore([makeSource({ active: false })]);
    const { run } = await runPipeline(store, { trigger: 'manual_cli', now: NOW });
    expect(run.sourcesChecked).toBe(0);
    expect(run.sourceResults[0].status).toBe('skipped_inactive');
  });
});

describe('buildOpportunity from a realistic HTML page', () => {
  it('extracts Chevening details faithfully', () => {
    const ex = extractPage(fixture('chevening.html'));
    const source = makeSource({
      id: 'chevening', name: 'Chevening', url: 'https://www.chevening.org/scholarship/ghana/',
      parser: 'html_page', trust: 'official', sourceType: 'government', country: 'United Kingdom', region: 'uk',
    });
    const { opportunity } = buildOpportunity(
      { title: ex.title!, url: source.url, summary: ex.description, publishedAt: null, pageText: ex.bodyText },
      source,
      { ...DEFAULT_PROFILE, onboardingComplete: true },
      { pageText: ex.bodyText, verification: 'verified', now: NOW },
    );
    expect(opportunity.ghanaEligibility).toBe('ghana_eligible');
    expect(opportunity.fundingType).toBe('fully_funded_stipend');
    expect(opportunity.deadline.date).toBe('2025-11-04');
    expect(opportunity.deadline.timezone).toBe('Etc/GMT');
    expect(opportunity.academicRequirement).toBeTruthy();
    expect(opportunity.verificationStatus).toBe('verified');
  });

  it('marks first-class-only programmes as likely ineligible but keeps exact wording', () => {
    const ex = extractPage(fixture('first-class-only.html'));
    const source = makeSource({ id: 'elite', name: 'Elite', url: 'https://elite.example/fellowship', parser: 'html_page', trust: 'official' });
    const { opportunity } = buildOpportunity(
      { title: ex.title!, url: source.url, summary: null, publishedAt: null, pageText: ex.bodyText },
      source,
      { ...DEFAULT_PROFILE, onboardingComplete: true },
      { pageText: ex.bodyText, verification: 'verified', now: NOW },
    );
    expect(opportunity.academicFit).toBe('likely_ineligible');
    expect(opportunity.academicRequirement).toContain('First Class');
    expect(opportunity.ghanaEligibility).toBe('international');
  });
});

describe('isRelevantItem', () => {
  const src = makeSource({});
  it('rejects non-http URLs and irrelevant items', () => {
    expect(isRelevantItem({ title: 'Scholarship', url: 'javascript:x', summary: null, publishedAt: null, pageText: null }, src)).toBe(false);
    expect(isRelevantItem({ title: 'Cat photos of the week', url: 'https://x.org/cats', summary: null, publishedAt: null, pageText: null }, src)).toBe(false);
  });
  it('keeps relevant keyworded items', () => {
    expect(isRelevantItem({ title: 'Fully funded scholarship for Ghanaians', url: 'https://x.org/s', summary: null, publishedAt: null, pageText: null }, src)).toBe(true);
  });
});

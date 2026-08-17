import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFeed, parseSitemap, extractPage, parseHtmlList } from '../src/server/parsers';
import type { Source } from '../src/core/types';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('parseFeed (RSS)', () => {
  it('parses items, strips HTML and keeps links', () => {
    const items = parseFeed(fixture('feed.xml'));
    expect(items).toHaveLength(3);
    expect(items[0].title).toContain('Fully Funded Masters Scholarship');
    expect(items[0].url).toContain('utm_source'); // canonicalization happens later
    expect(items[0].summary).toContain('African nationals including Ghana');
  });
  it('returns [] for malformed XML', () => {
    expect(parseFeed('<not-xml')).toEqual([]);
  });
});

describe('parseFeed (Atom)', () => {
  it('parses atom entries', () => {
    const items = parseFeed(fixture('atom.xml'));
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('DevOps Bootcamp');
    expect(items[0].url).toBe('https://uni.example.edu/news/devops-bootcamp');
  });
});

describe('parseSitemap', () => {
  const xml = `<?xml version="1.0"?><urlset><url><loc>https://x.org/scholarship-a</loc></url><url><loc>https://x.org/about</loc></url></urlset>`;
  it('extracts and filters URLs by keyword', () => {
    expect(parseSitemap(xml, ['scholarship'])).toEqual(['https://x.org/scholarship-a']);
    expect(parseSitemap(xml)).toHaveLength(2);
  });
});

describe('extractPage', () => {
  it('extracts title, description, body text and JSON-LD from a realistic page', () => {
    const ex = extractPage(fixture('chevening.html'));
    expect(ex.title).toContain('Chevening');
    expect(ex.description).toContain('fully-funded');
    expect(ex.bodyText).toContain('Ghanaian applicants are encouraged to apply');
    expect(ex.jsonLd).toHaveLength(1);
    expect(ex.bodyText).not.toContain('application/ld+json'); // scripts removed
  });
});

describe('parseHtmlList', () => {
  const html = `
    <html><body>
      <article><h3><a href="/news/clean-air-fellowship-2026">Clean Air Fellowship 2026 — apply now</a></h3><p>A funded programme on air quality.</p></article>
      <article><h3><a href="/news/office-move">We moved office</a></h3><p>New address.</p></article>
    </body></html>`;
  const source = {
    id: 't', name: 'T', url: 'https://org.example/news', country: null, region: null,
    sourceType: 'climate_org', active: true, parser: 'html_list', trust: 'official',
    listConfig: { itemSelector: 'article', includeKeywords: ['fellowship', 'apply'] },
    notes: null, lastChecked: null, lastSuccess: null, failureCount: 0, robotsStatus: 'unknown',
  } as Source;

  it('extracts matching items with absolute URLs and skips irrelevant ones', () => {
    const items = parseHtmlList(html, source, 'https://org.example/news');
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://org.example/news/clean-air-fellowship-2026');
    expect(items[0].title).toContain('Clean Air Fellowship');
  });
});

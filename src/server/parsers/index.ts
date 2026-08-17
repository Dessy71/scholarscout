import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import type { Source } from '../../core/types';

/** A raw discovered item before normalization/classification. */
export interface RawItem {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  /** Full text extracted from the item's page (if fetched). */
  pageText: string | null;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '#text' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)['#text']);
  }
  return String(v);
}

function stripHtml(html: string): string {
  const $ = cheerio.load(`<div>${html}</div>`);
  return $.root().text().replace(/\s+/g, ' ').trim();
}

/** Parse RSS 2.0 and Atom feeds. */
export function parseFeed(body: string): RawItem[] {
  let doc: Record<string, unknown>;
  try {
    doc = xml.parse(body) as Record<string, unknown>;
  } catch {
    return [];
  }
  const items: RawItem[] = [];

  // RSS 2.0
  const rss = doc.rss as { channel?: { item?: unknown } } | undefined;
  if (rss?.channel) {
    for (const item of asArray(rss.channel.item as Record<string, unknown>[])) {
      const title = stripHtml(textOf(item.title));
      const url = textOf(item.link).trim();
      if (!title || !url) continue;
      const description = textOf(item.description ?? item['content:encoded'] ?? '');
      items.push({
        title,
        url,
        summary: description ? stripHtml(description).slice(0, 600) : null,
        publishedAt: textOf(item.pubDate) || null,
        pageText: description ? stripHtml(description) : null,
      });
    }
    return items;
  }

  // Atom
  const feed = doc.feed as { entry?: unknown } | undefined;
  if (feed?.entry) {
    for (const entry of asArray(feed.entry as Record<string, unknown>[])) {
      const title = stripHtml(textOf(entry.title));
      let url = '';
      for (const link of asArray(entry.link as Record<string, unknown>[])) {
        const rel = textOf(link['@_rel']);
        if (!rel || rel === 'alternate') { url = textOf(link['@_href']); break; }
      }
      if (!title || !url) continue;
      const content = textOf(entry.summary ?? entry.content ?? '');
      items.push({
        title,
        url: url.trim(),
        summary: content ? stripHtml(content).slice(0, 600) : null,
        publishedAt: textOf(entry.updated ?? entry.published) || null,
        pageText: content ? stripHtml(content) : null,
      });
    }
  }
  return items;
}

/** Parse sitemap.xml → candidate URLs (optionally filtered by keywords). */
export function parseSitemap(body: string, keywords?: string[]): string[] {
  let doc: Record<string, unknown>;
  try {
    doc = xml.parse(body) as Record<string, unknown>;
  } catch {
    return [];
  }
  const urlset = doc.urlset as { url?: unknown } | undefined;
  const urls: string[] = [];
  for (const entry of asArray(urlset?.url as Record<string, unknown>[])) {
    const loc = textOf(entry.loc).trim();
    if (!loc) continue;
    if (keywords && keywords.length > 0) {
      const l = loc.toLowerCase();
      if (!keywords.some((k) => l.includes(k.toLowerCase()))) continue;
    }
    urls.push(loc);
  }
  return urls.slice(0, 50);
}

/** Parse a listing/news HTML page into candidate items using the source's selectors. */
export function parseHtmlList(body: string, source: Source, baseUrl: string): RawItem[] {
  const $ = cheerio.load(body);
  const cfg = source.listConfig;
  if (!cfg) return [];
  const items: RawItem[] = [];
  $(cfg.itemSelector).each((_, el) => {
    const $el = $(el);
    const $link = cfg.linkSelector ? $el.find(cfg.linkSelector).first() : $el.find('a[href]').first();
    const href = $link.attr('href');
    if (!href) return;
    let url: string;
    try { url = new URL(href, baseUrl).toString(); } catch { return; }

    const title = (cfg.titleSelector ? $el.find(cfg.titleSelector).first().text() : ($el.find('h1,h2,h3,h4').first().text() || $link.text()))
      .replace(/\s+/g, ' ').trim();
    if (!title || title.length < 8) return;

    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (cfg.includeKeywords && cfg.includeKeywords.length > 0) {
      const lower = `${title} ${text}`.toLowerCase();
      if (!cfg.includeKeywords.some((k) => lower.includes(k.toLowerCase()))) return;
    }

    const summary = cfg.summarySelector
      ? $el.find(cfg.summarySelector).first().text().replace(/\s+/g, ' ').trim() || null
      : text.slice(0, 400) || null;

    items.push({ title, url, summary, publishedAt: null, pageText: text || null });
  });
  // de-dupe within page by URL
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true))).slice(0, 40);
}

export interface PageExtraction {
  title: string | null;
  description: string | null;
  bodyText: string;
  jsonLd: Record<string, unknown>[];
}

/** Extract main text + metadata + JSON-LD from a single HTML page. */
export function extractPage(body: string): PageExtraction {
  const $ = cheerio.load(body);
  $('script:not([type="application/ld+json"]), style, nav, footer, header, noscript, iframe, svg').remove();

  const jsonLd: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (node && typeof node === 'object') jsonLd.push(node as Record<string, unknown>);
      }
    } catch { /* malformed JSON-LD is common; skip */ }
  });

  const title = ($('meta[property="og:title"]').attr('content') || $('title').first().text() || '').trim() || null;
  const description = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim() || null;

  const main = $('main').length ? $('main') : $('article').length ? $('article') : $('body');
  const bodyText = main.text().replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim().slice(0, 40_000);

  return { title, description, bodyText, jsonLd };
}

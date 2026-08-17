/**
 * Respectful HTTP fetching layer.
 *  - Honors robots.txt (User-agent: * and our own UA token)
 *  - Per-host rate limiting (min 2s between requests to the same host)
 *  - Conditional requests via ETag / Last-Modified cache headers
 *  - Bounded redirects, timeouts, no auth/CAPTCHA/anti-bot circumvention
 */

const USER_AGENT = 'ScholarScoutBot/1.0 (personal scholarship research; +https://github.com/scholarscout)';
let minHostIntervalMs = 2000;
const FETCH_TIMEOUT_MS = 20_000;
/** Hard cap on downloaded body size — protects against huge/streaming responses. */
const MAX_BODY_BYTES = 3 * 1024 * 1024;

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, RobotsRules>();

/** Test hook: clear per-process caches and optionally shrink the rate-limit interval. */
export function resetFetcherState(minIntervalMs?: number): void {
  lastRequestAt.clear();
  robotsCache.clear();
  if (typeof minIntervalMs === 'number') minHostIntervalMs = minIntervalMs;
}

interface RobotsRules {
  fetched: boolean;
  disallow: string[]; // path prefixes for UA * or our UA
}

export interface FetchResult {
  ok: boolean;
  status: number;
  body: string;
  finalUrl: string;
  notModified: boolean;
  error: string | null;
}

export interface ConditionalHeaders {
  etag?: string;
  lastModified?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimit(host: string): Promise<void> {
  const last = lastRequestAt.get(host) ?? 0;
  const wait = last + minHostIntervalMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

function parseRobots(text: string): RobotsRules {
  const lines = text.split('\n');
  const disallow: string[] = [];
  let applies = false;
  for (const raw of lines) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(':');
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      applies = value === '*' || value.toLowerCase().includes('scholarscout');
    } else if (applies && key === 'disallow' && value) {
      disallow.push(value);
    }
  }
  return { fetched: true, disallow };
}

export async function checkRobots(url: string): Promise<'allowed' | 'disallowed' | 'unknown'> {
  let u: URL;
  try { u = new URL(url); } catch { return 'unknown'; }
  const origin = u.origin;

  let rules = robotsCache.get(origin);
  if (!rules) {
    try {
      await rateLimit(u.host);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { 'user-agent': USER_AGENT },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);
      rules = res.ok ? parseRobots(await res.text()) : { fetched: false, disallow: [] };
    } catch {
      rules = { fetched: false, disallow: [] };
    }
    robotsCache.set(origin, rules);
  }

  if (!rules.fetched) return 'unknown';
  const path = u.pathname || '/';
  for (const prefix of rules.disallow) {
    if (prefix === '/') return 'disallowed';
    if (path.startsWith(prefix)) return 'disallowed';
  }
  return 'allowed';
}

/** Read a response body but never more than `limit` bytes. */
async function readBounded(res: Response, limit: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, limit);
  const decoder = new TextDecoder();
  let out = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (bytes >= limit) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  out += decoder.decode();
  return out;
}

export async function respectfulFetch(url: string, conditional?: ConditionalHeaders): Promise<FetchResult> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, status: 0, body: '', finalUrl: url, notModified: false, error: 'invalid-url' };
  }

  const robots = await checkRobots(url);
  if (robots === 'disallowed') {
    return { ok: false, status: 0, body: '', finalUrl: url, notModified: false, error: 'robots-disallowed' };
  }

  await rateLimit(u.host);

  const headers: Record<string, string> = {
    'user-agent': USER_AGENT,
    accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en',
  };
  if (conditional?.etag) headers['if-none-match'] = conditional.etag;
  if (conditional?.lastModified) headers['if-modified-since'] = conditional.lastModified;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (res.status === 304) {
      return { ok: true, status: 304, body: '', finalUrl: res.url || url, notModified: true, error: null };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, body: '', finalUrl: res.url || url, notModified: false, error: `http-${res.status}` };
    }
    const body = await readBounded(res, MAX_BODY_BYTES);
    return { ok: true, status: res.status, body, finalUrl: res.url || url, notModified: false, error: null };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : 'fetch-failed';
    return { ok: false, status: 0, body: '', finalUrl: url, notModified: false, error: msg };
  }
}

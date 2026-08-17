/** Canonical URL handling: strip tracking parameters, normalize host/path. */

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'source', 'igshid',
  '_ga', '_gl', 'msclkid', 'yclid', 'wbraid', 'gbraid',
];

export function canonicalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  // protocol → https where the host is the same
  if (url.protocol === 'http:') url.protocol = 'https:';
  // lowercase host, strip www.
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  // remove tracking params
  for (const p of TRACKING_PARAMS) url.searchParams.delete(p);
  // sort remaining params for stability
  url.searchParams.sort();
  // strip trailing slash (but keep root "/")
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  // drop fragment
  url.hash = '';
  let out = url.toString();
  if (out.endsWith('?')) out = out.slice(0, -1);
  return out;
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Dependency-free FNV-1a based content hashing (isomorphic, deterministic). */

export function contentHash(input: string): string {
  // 64-bit FNV-1a implemented with two 32-bit lanes for good dispersion.
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x01000197);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** Stable id derived from a canonical URL. */
export function opportunityId(canonicalUrl: string): string {
  return 'opp_' + contentHash(canonicalUrl);
}

import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, isHttpUrl } from '../src/core/url';
import { contentHash, opportunityId } from '../src/core/hash';

describe('canonicalizeUrl', () => {
  it('strips tracking parameters', () => {
    expect(canonicalizeUrl('https://example.org/scholarship?utm_source=rss&utm_medium=feed&id=5'))
      .toBe('https://example.org/scholarship?id=5');
  });
  it('normalizes protocol, www and trailing slash', () => {
    expect(canonicalizeUrl('http://www.Example.org/path/')).toBe('https://example.org/path');
  });
  it('drops fragments and sorts params', () => {
    expect(canonicalizeUrl('https://example.org/a?b=2&a=1#section')).toBe('https://example.org/a?a=1&b=2');
  });
  it('syndicated copies of the same URL canonicalize identically', () => {
    const a = canonicalizeUrl('https://www.example.org/opp/?utm_campaign=x');
    const b = canonicalizeUrl('http://example.org/opp');
    expect(a).toBe(b);
  });
  it('leaves invalid URLs untouched', () => {
    expect(canonicalizeUrl('not a url')).toBe('not a url');
  });
});

describe('isHttpUrl', () => {
  it('accepts http(s), rejects others', () => {
    expect(isHttpUrl('https://x.org')).toBe(true);
    expect(isHttpUrl('ftp://x.org')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('nope')).toBe(false);
  });
});

describe('contentHash / opportunityId', () => {
  it('is deterministic and change-sensitive', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
  });
  it('derives stable ids from canonical URLs', () => {
    expect(opportunityId('https://example.org/a')).toBe(opportunityId('https://example.org/a'));
    expect(opportunityId('https://example.org/a')).toMatch(/^opp_[0-9a-f]{16}$/);
  });
});

/**
 * Join codes are the only credential needed to enter a session, so they must
 * come from a cryptographically secure source and stay uniformly distributed.
 */

import { describe, expect, it } from 'vitest';
import { generateSecureJoinCode } from '../../../server/utils/secureCode';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

describe('generateSecureJoinCode', () => {
  it('produces a code of the requested length', () => {
    expect(generateSecureJoinCode(4)).toHaveLength(4);
    expect(generateSecureJoinCode(6)).toHaveLength(6);
    expect(generateSecureJoinCode()).toHaveLength(4);
  });

  it('only uses the readable join-code alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateSecureJoinCode(8)).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it('does not repeat itself over many draws', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 2000; i += 1) codes.add(generateSecureJoinCode(6));
    // 36^6 keyspace: collisions across 2000 draws should be vanishingly rare.
    expect(codes.size).toBeGreaterThan(1990);
  });

  it('covers the whole alphabet without obvious bias', () => {
    const seen = new Map<string, number>();
    const draws = 20000;
    for (let i = 0; i < draws; i += 1) {
      const ch = generateSecureJoinCode(1);
      seen.set(ch, (seen.get(ch) ?? 0) + 1);
    }

    // Every character should appear...
    expect(seen.size).toBe(ALPHABET.length);

    // ...and none should dominate. Uniform expectation is draws/36 (~555);
    // a modulo-biased generator would push some characters ~2x above others.
    const expected = draws / ALPHABET.length;
    for (const [char, count] of seen) {
      expect(
        count,
        `character ${char} appeared ${count} times, expected ~${expected}`,
      ).toBeGreaterThan(expected * 0.7);
      expect(count).toBeLessThan(expected * 1.3);
    }
  });
});

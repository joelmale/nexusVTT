import { describe, it, expect, afterEach, vi } from 'vitest';
import { assertTestDatabase } from '../../integration/assertTestDatabase';

/**
 * This is the guard that stands between `npm run test:integration` and a
 * developer's real database, so its failure modes need to be distinguishable:
 * a malformed URL and a well-formed URL aimed at production are different
 * problems with different fixes.
 */
describe('assertTestDatabase', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
    vi.restoreAllMocks();
  });

  const withUrl = (url: string | undefined) => {
    if (url === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = url;
    }
    return () => assertTestDatabase();
  };

  it.each([
    'postgresql://u:p@localhost:5432/nexus_test',
    'postgresql://u:p@localhost:5432/nexus-testdb',
    'postgresql://u:p@localhost:5432/test',
  ])('accepts a test database: %s', (url) => {
    expect(withUrl(url)).not.toThrow();
  });

  it('refuses a well-formed URL pointing at a non-test database, and says so', () => {
    const run = withUrl('postgresql://u:p@db.internal:5432/nexus_production');

    // The bug this pins: both failure paths used to surface as the format
    // error, so a production URL looked like a typo.
    expect(run).toThrow(/does not appear to be a test database/);
    expect(run).not.toThrow(/Invalid DATABASE_URL format/);
  });

  it('rejects a run-together name that merely contains "test"', () => {
    // 'nexustestdb' ends with "testdb" but has no separator, so it could just
    // as easily be a real database. The guard requires an unambiguous suffix.
    expect(withUrl('postgresql://u:p@localhost:5432/nexustestdb')).toThrow(
      /does not appear to be a test database/,
    );
  });

  it('reports a genuinely malformed URL as a format error', () => {
    expect(withUrl('not a url at all')).toThrow(/Invalid DATABASE_URL format/);
  });

  it('warns but does not throw when DATABASE_URL is unset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(withUrl(undefined)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('No DATABASE_URL defined'),
    );
  });
});

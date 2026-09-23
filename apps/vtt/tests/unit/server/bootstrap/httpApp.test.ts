import { describe, expect, it } from 'vitest';
import { createCorsOriginValidator } from '../../../../server/bootstrap/httpApp.js';

describe('HTTP app bootstrap', () => {
  it('allows same-origin, configured, and development localhost requests', () => {
    const validate = createCorsOriginValidator(['https://table.example.test'], 'development');
    const outcomes: Array<{ error: Error | null; allow?: boolean }> = [];
    const callback = (error: Error | null, allow?: boolean) => outcomes.push({ error, allow });
    validate(undefined, callback);
    validate('https://table.example.test', callback);
    validate('http://localhost:4173', callback);
    expect(outcomes).toEqual([
      { error: null, allow: true },
      { error: null, allow: true },
      { error: null, allow: true },
    ]);
  });

  it('rejects unconfigured origins in production', () => {
    const validate = createCorsOriginValidator([], 'production');
    let error: Error | null = null;
    let allowed: boolean | undefined;
    validate('http://localhost:5173', (nextError, nextAllowed) => {
      error = nextError;
      allowed = nextAllowed;
    });
    expect(error?.message).toContain('CORS blocked');
    expect(allowed).toBe(false);
  });
});

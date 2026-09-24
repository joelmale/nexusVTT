/**
 * A client-facing admin API failure. `message` and `details` are returned in
 * the response body, so they must never contain absolute paths, secrets or
 * raw filesystem error text — only codes, asset ids and relative keys.
 */
export class AdminError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

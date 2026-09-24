import type { AuditEventInput } from './store/types.js';

const SENSITIVE_KEY = /cookie|token|secret|password|authorization|verifier|nonce|credential|content|body|question|text|notes/i;
const MAX_STRING = 200;
const MAX_ARRAY = 50;
const MAX_DEPTH = 3;

/**
 * Audit summaries carry identifiers and changed field names only. This is a
 * last line of defence: callers already avoid passing content, and anything
 * with a sensitive-looking key is dropped rather than masked.
 */
export function sanitizeSummary(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeObject(value, 0);
}

function sanitizeObject(value: Record<string, unknown>, depth: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const clean = sanitizeValue(inner, depth + 1);
    if (clean !== undefined) result[key] = clean;
  }
  return result;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (depth > MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') return sanitizeObject(value as Record<string, unknown>, depth);
  return undefined;
}

export function finalizeAudit(event: AuditEventInput): AuditEventInput {
  return { ...event, summary: sanitizeSummary(event.summary) };
}

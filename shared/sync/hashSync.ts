import { createHash } from 'node:crypto';
import { canonicalStringify, type StateHash, type JsonValue } from './contracts.js';

/**
 * Synchronous SHA-256 hash of canonical state (node:crypto).
 * MUST NOT be imported by src/ (client bundle).
 * Returns identical hash to async hashState() for same input.
 *
 * @param state value to hash
 * @returns hex-encoded SHA-256 hash
 */
export function hashSync(state: JsonValue): StateHash {
  const canonical = canonicalStringify(state);
  const hex = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return hex as StateHash;
}

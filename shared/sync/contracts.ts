import type { Operation } from 'fast-json-patch';

/**
 * Strict recursive JSON type excluding undefined.
 * Use instead of any/unknown for JSON payloads.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [k: string]: JsonValue };

/**
 * Branded type for state hash (SHA-256 hex).
 * Ensures type safety when passing hashes around.
 */
export type StateHash = string & { readonly __stateHash: unique symbol };

/**
 * JSON Patch: array of RFC 6902 operations.
 */
export type JsonPatch = readonly Operation[];

/**
 * Core game state shape that must be sync-compatible.
 */
export interface SyncableGameState {
  readonly scenes: readonly JsonValue[];
  readonly activeSceneId: string | null;
  readonly characters: readonly JsonValue[];
  readonly initiative: JsonValue;
}

/**
 * Full state upload: sends entire state to server.
 */
export interface FullStateUpload<TState> {
  readonly kind: 'full';
  readonly state: TState;
  readonly newToken: StateHash;
}

/**
 * Patch state upload: sends only delta (RFC 6902 patch).
 */
export interface PatchStateUpload {
  readonly kind: 'patch';
  readonly patch: JsonPatch;
  readonly baseToken: StateHash;
  readonly newToken: StateHash;
}

/**
 * Discriminated union for game state uploads.
 */
export type GameStateUpload<TState = SyncableGameState> =
  | FullStateUpload<TState>
  | PatchStateUpload;

/**
 * Utility type aliases for extract patterns.
 */
export type FullUpload<T = SyncableGameState> = Extract<
  GameStateUpload<T>,
  { kind: 'full' }
>;
export type PatchUpload = Extract<GameStateUpload<never>, { kind: 'patch' }>;

/**
 * Server ACK response to sender: confirms receipt and token assignment.
 */
export interface SyncAckMessage {
  readonly type: 'game-state-ack';
  readonly token: StateHash;
  readonly version: number;
}

/**
 * Reason codes for resync requests.
 */
export type ResyncReason =
  | 'base-mismatch'
  | 'integrity-mismatch'
  | 'malformed-patch'
  | 'payload-too-large';

/**
 * Server error response: requests client to resync full state.
 */
export interface ResyncRequiredMessage {
  readonly type: 'game-state-resync-required';
  readonly serverToken: StateHash;
  readonly reason: ResyncReason;
}

/**
 * Server→peers broadcast: patch applied to state.
 */
export interface GameStatePatchBroadcast {
  readonly type: 'game-state-patch';
  readonly patch: JsonPatch;
  readonly baseToken: StateHash;
  readonly newToken: StateHash;
  readonly version: number;
}

/**
 * Server authoritative state wrapper.
 */
export interface AuthoritativeState<TState> {
  value: TState;
  token: StateHash;
  version: number;
}

/**
 * Deterministic JSON serializer: sorts object keys lexicographically.
 * Produces byte-identical output for structurally-equal inputs regardless of
 * original key insertion order. Numbers formatted via default JS behavior.
 *
 * @param value JSON-serializable value
 * @returns deterministic string representation
 */
export function canonicalStringify(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalStringify(item));
    return '[' + items.join(',') + ']';
  }
  // Object: sort keys lexicographically
  const obj = value as { readonly [k: string]: JsonValue };
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Async SHA-256 hash of canonical state (WebCrypto-based).
 * Safe for browser and node (using globalThis.crypto.subtle).
 *
 * @param state value to hash
 * @returns hex-encoded SHA-256 hash
 */
export async function hashState(state: JsonValue): Promise<StateHash> {
  const canonical = canonicalStringify(state);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex as StateHash;
}

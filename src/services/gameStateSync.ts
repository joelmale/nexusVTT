import { compare } from 'fast-json-patch';
import {
  hashState,
  type GameStateUpload,
  type JsonPatch,
  type JsonValue,
  type StateHash,
  type SyncableGameState,
} from '../../shared/sync/contracts';

/**
 * Content-hash-chained delta-sync engine (PR-3, client side).
 *
 * THREE-POINTER RECONCILIATION
 * ----------------------------
 * The engine tracks three distinct views of the game state and the exact bug
 * this whole design exists to prevent is a `pending` vs `live` mixup:
 *
 *  - `acknowledged`      — the last state the SERVER confirmed. Patches are
 *                          ALWAYS computed from here, never from `live` and
 *                          never from the last SENT (`pending`) state.
 *  - `inFlight.pending`  — a deep-cloned SNAPSHOT of the state at the moment we
 *                          sent an upload. On ack it is promoted to
 *                          `acknowledged`. It is a snapshot, not a live ref, so
 *                          later mutations cannot retroactively change what we
 *                          promise the server we sent.
 *  - `live`              — the current store state, rebuilt on every `flush()`
 *                          via the injected `buildState` callback.
 *
 * Only ONE upload is ever outstanding (single in-flight). Changes that arrive
 * while a send is in flight set `dirty`, which drives exactly ONE coalesced
 * follow-up after the ack (never one-per-change).
 *
 * FEATURE FLAG
 * ------------
 * Behind `VITE_DELTA_SYNC` (default OFF). When OFF the engine sends the current
 * legacy untagged full snapshot and does NOT depend on ack/resync/timeout — its
 * behavior is byte-identical to the pre-PR-3 client. When ON it sends
 * tagged-full/patch uploads and consumes ack/resync/timeout.
 */

/** Payload the transport sends on the legacy (flag-OFF) path. */
export interface LegacyGameStatePayload {
  scenes: readonly JsonValue[];
  activeSceneId: string | null;
  characters: readonly JsonValue[];
  initiative: JsonValue;
}

/**
 * Transport abstraction. Kept as an injected dependency so the engine is unit
 * testable WITHOUT a real websocket.
 *  - `sendUpload`  — flag-ON path: sends a tagged `GameStateUpload`.
 *  - `sendLegacy`  — flag-OFF path: sends the current legacy untagged full
 *                    snapshot (exactly what today's code sends).
 */
export interface SyncTransport {
  sendUpload(upload: GameStateUpload): void;
  sendLegacy(payload: LegacyGameStatePayload): void;
}

export interface SyncEngineDeps {
  /** Rebuild the canonical, JSON-plain `live` state from the stores. */
  buildState: () => SyncableGameState;
  transport: SyncTransport;
  /** Reads the feature flag. Injected so tests can flip it deterministically. */
  isDeltaSyncEnabled: () => boolean;
  /** Timeout (ms) after a send with no ack before we re-baseline. */
  ackTimeoutMs?: number;
  /**
   * Optional observer fired whenever a resync is triggered, with its cause
   * (a server reason like 'integrity-mismatch', or 'ack-timeout'). Kept as an
   * injected hook so the engine stays console-free and unit-testable; the app
   * wires it to a dev-only log. Not passed in tests → no output.
   */
  onResync?: (reason: string) => void;
}

const DEFAULT_ACK_TIMEOUT_MS = 5000;

interface InFlight {
  readonly newToken: StateHash;
  /** Deep-cloned SNAPSHOT captured at send time — NOT a live reference. */
  readonly pending: SyncableGameState;
}

/** Deep clone via JSON round-trip. Input is already JSON-plain. */
function deepClone(value: SyncableGameState): SyncableGameState {
  return JSON.parse(JSON.stringify(value)) as SyncableGameState;
}

export class GameStateSyncEngine {
  private acknowledged: SyncableGameState | null = null;
  private acknowledgedToken: StateHash | null = null;
  private inFlight: InFlight | null = null;
  private dirty = false;
  /**
   * Synchronous re-entrancy guard. `inFlight` is only assigned AFTER the async
   * `await hashState(...)` inside `flush()`, so a `schedule()` that fires during
   * that await window would see `inFlight === null` and start a SECOND concurrent
   * `flush()` — two uploads, mismatched acks, a spurious base-mismatch resync.
   * This flag is set synchronously for the whole lifetime of a `flush()` call so
   * at most one runs at a time.
   */
  private flushing = false;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly deps: SyncEngineDeps;
  private readonly ackTimeoutMs: number;

  constructor(deps: SyncEngineDeps) {
    this.deps = deps;
    this.ackTimeoutMs = deps.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
  }

  /**
   * Mark dirty; if nothing is in flight, flush now. This is the single entry
   * point that all senders call instead of touching the transport directly.
   */
  schedule(): void {
    this.dirty = true;
    // `flushing` closes the async-hash re-entrancy window that `inFlight` alone
    // leaves open: a flush suspended on `await hashState(...)` has not yet set
    // `inFlight`, but `flushing` is already true, so we don't start a second one.
    if (!this.flushing && this.inFlight === null) {
      void this.flush();
    }
  }

  private clearAckTimer(): void {
    if (this.ackTimer !== null) {
      clearTimeout(this.ackTimer);
      this.ackTimer = null;
    }
  }

  private armAckTimer(): void {
    this.clearAckTimer();
    this.ackTimer = setTimeout(() => {
      // Dropped-ack recovery: treat exactly like a resync — drop the base and
      // re-baseline with a full snapshot on the next flush.
      this.onResyncRequired('ack-timeout');
    }, this.ackTimeoutMs);
  }

  private async flush(): Promise<void> {
    // Synchronous re-entrancy guard: at most one flush runs at a time. Set BEFORE
    // the first `await` so a `schedule()` during the hash window is coalesced into
    // the drain loop below instead of spawning a second concurrent flush.
    this.flushing = true;
    try {
      // DRAIN loop: keep flushing while changes remain AND no send established an
      // in-flight upload. When a send DOES set `inFlight` (flag-ON full/patch), we
      // stop and wait for the ack — `onAck` re-flushes if still dirty. When a send
      // does NOT set `inFlight` (flag-OFF legacy, or the empty-patch early-continue),
      // a change that landed during the await still marked `dirty`, so the loop
      // runs again and that change is not lost.
      do {
        this.dirty = false;

        // Build the current live state up front so both paths share one snapshot.
        const live = this.deps.buildState();

        // ---- Flag OFF: legacy untagged full snapshot. No chain bookkeeping. ----
        if (!this.deps.isDeltaSyncEnabled()) {
          this.deps.transport.sendLegacy({
            scenes: live.scenes,
            activeSceneId: live.activeSceneId,
            characters: live.characters,
            initiative: live.initiative,
          });
          // No in-flight established → loop exits only once nothing is dirty.
          continue;
        }

        // ---- Flag ON: tagged full / patch upload with chain bookkeeping. ----
        let upload: GameStateUpload;
        let newToken: StateHash;

        if (this.acknowledgedToken === null || this.acknowledged === null) {
          // No confirmed base yet → (re)baseline with a full snapshot.
          newToken = await hashState(live as unknown as JsonValue);
          upload = { kind: 'full', state: live, newToken };
        } else {
          // Patch is ALWAYS diffed against `acknowledged` (the last server-confirmed
          // state), never against `live` and never against the last SENT state.
          const patch = compare(
            this.acknowledged as unknown as Record<string, unknown>,
            live as unknown as Record<string, unknown>,
          ) as unknown as JsonPatch;

          if (patch.length === 0) {
            // Dedup: nothing actually changed since the last ack. No in-flight is
            // established, so re-check `dirty` (a change may have landed while we
            // diffed) before exiting the loop.
            continue;
          }

          newToken = await hashState(live as unknown as JsonValue);
          upload = {
            kind: 'patch',
            patch,
            baseToken: this.acknowledgedToken,
            newToken,
          };
        }

        // Capture a deep-cloned SNAPSHOT as `pending` (not a live reference) so a
        // later mutation can't retroactively rewrite what we promised the server.
        this.inFlight = { newToken, pending: deepClone(live) };
        this.armAckTimer();
        this.deps.transport.sendUpload(upload);
        // In-flight established → stop; the ack path drives the next flush.
      } while (this.dirty && this.inFlight === null);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Server confirmed a commit. Promote the in-flight snapshot to acknowledged.
   * Stale acks (no in-flight, or token mismatch) are ignored.
   */
  onAck(data: { token: StateHash }): void {
    if (this.inFlight === null || this.inFlight.newToken !== data.token) {
      // Stale / mismatched ack — ignore.
      return;
    }
    this.acknowledged = this.inFlight.pending;
    this.acknowledgedToken = data.token;
    this.inFlight = null;
    this.clearAckTimer();

    if (this.dirty) {
      void this.flush();
    }
  }

  /**
   * Chain broke (server rejected the base) — or an ack was dropped. Drop the
   * base so the next send is a fresh full snapshot, then re-baseline.
   *
   * @param reason cause of the resync — a server `ResyncReason`
   *   ('base-mismatch' | 'integrity-mismatch' | 'malformed-patch' |
   *   'payload-too-large') or 'ack-timeout'. Forwarded to the optional
   *   `onResync` observer for dev logging/metrics.
   */
  onResyncRequired(reason = 'server'): void {
    this.inFlight = null;
    this.clearAckTimer();
    this.acknowledged = null;
    this.acknowledgedToken = null;
    this.deps.onResync?.(reason);
    void this.flush();
  }

  /**
   * Rebase directly onto a server-authoritative snapshot after a compare-and-
   * swap conflict. This must not upload the loser's stale local state over the
   * winning commit.
   */
  onAuthoritativeSnapshot(
    state: SyncableGameState,
    token: StateHash,
    reason = 'server-authoritative',
  ): void {
    this.inFlight = null;
    this.clearAckTimer();
    this.acknowledged = deepClone(state);
    this.acknowledgedToken = token;
    this.dirty = false;
    this.deps.onResync?.(reason);
  }

  /** Full reset. Called on every (re)connect so we re-baseline the chain. */
  reset(): void {
    this.acknowledged = null;
    this.acknowledgedToken = null;
    this.inFlight = null;
    this.dirty = false;
    this.clearAckTimer();
  }
}

/**
 * Feature flag read. `VITE_DELTA_SYNC === 'true'` turns delta-sync ON.
 * Anything else (undefined included) → OFF, and the legacy path is used.
 */
export function isDeltaSyncEnabled(): boolean {
  return import.meta.env.VITE_DELTA_SYNC === 'true';
}

export interface GameStateSyncRuntime {
  buildState: () => SyncableGameState;
  transport: SyncTransport;
  onResync?: (reason: string) => void;
}

let runtime: GameStateSyncRuntime | null = null;

export function configureGameStateSyncRuntime(
  nextRuntime: GameStateSyncRuntime,
): void {
  runtime = nextRuntime;
}

function getRuntime(): GameStateSyncRuntime {
  if (!runtime) {
    throw new Error('Game-state sync runtime has not been initialized');
  }
  return runtime;
}

/**
 * Build the canonical, JSON-plain `SyncableGameState` from the live stores.
 *
 * `useGameStore`, `useCharacterStore` and `buildInitiativeSnapshot` are imported
 * statically at the top of this module. Those imports form an ESM cycle with
 * gameStore (which imports the singleton below), but the bindings are only READ
 * here inside a function — never at module-eval time — so the cycle is safe.
 *
 * The whole thing is JSON-round-tripped so it is plain JSON with no `undefined`
 * / class instances — required for STABLE hashing across sends.
 */
export function buildSyncableState(): SyncableGameState {
  return getRuntime().buildState();
}

/**
 * The single app-wide sync engine.
 *
 * Both `buildState` and the transport are SYNCHRONOUS: they read the stores /
 * call the websocket service directly (no dynamic import in the hot path), so a
 * `schedule()` on the flag-OFF path sends within the same microtask flush as
 * today's legacy code — preserving byte-identical timing and keeping the
 * gameStore persistence test green.
 */
export const gameStateSyncEngine = new GameStateSyncEngine({
  buildState: buildSyncableState,
  transport: {
    sendUpload: (upload) => {
      getRuntime().transport.sendUpload(upload);
    },
    sendLegacy: (payload) => {
      getRuntime().transport.sendLegacy(payload);
    },
  },
  isDeltaSyncEnabled,
  // Dev-only live signal: a resync means the delta chain broke and we fell back
  // to a full snapshot. In steady state this should be near-silent; a stream of
  // 'integrity-mismatch' means client/server hashing disagrees on real data
  // (keep delta-sync OFF and investigate canonicalStringify).
  onResync: (reason) => {
    runtime?.onResync?.(reason);
  },
});

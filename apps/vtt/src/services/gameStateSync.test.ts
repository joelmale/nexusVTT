import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GameStateSyncEngine,
  type SyncTransport,
  type LegacyGameStatePayload,
} from './gameStateSync';
import type {
  GameStateUpload,
  StateHash,
  SyncableGameState,
} from '../../shared/sync/contracts';

// ---- Test harness ----------------------------------------------------------

/** Mutable "live" state the engine reads via its injected buildState. */
let live: SyncableGameState;

function setLive(next: SyncableGameState): void {
  // Deep clone so the engine's snapshots can't be mutated by later setLive calls.
  live = JSON.parse(JSON.stringify(next)) as SyncableGameState;
}

const emptyState = (): SyncableGameState => ({
  scenes: [],
  activeSceneId: null,
  characters: [],
  initiative: {},
});

interface MockTransport extends SyncTransport {
  uploads: GameStateUpload[];
  legacy: LegacyGameStatePayload[];
}

function makeTransport(): MockTransport {
  const uploads: GameStateUpload[] = [];
  const legacy: LegacyGameStatePayload[] = [];
  return {
    uploads,
    legacy,
    sendUpload: (u) => uploads.push(u),
    sendLegacy: (p) => legacy.push(p),
  };
}

/**
 * Flush pending microtasks + macrotasks so the async `flush()` (which awaits
 * the WebCrypto `hashState`) runs to completion. A single macrotask is not
 * always enough for `crypto.subtle.digest` to settle, so we drain a few.
 */
const tick = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

function makeEngine(transport: SyncTransport, flagOn: boolean) {
  return new GameStateSyncEngine({
    buildState: () => JSON.parse(JSON.stringify(live)) as SyncableGameState,
    transport,
    isDeltaSyncEnabled: () => flagOn,
    ackTimeoutMs: 5000,
  });
}

/** Ack the single upload the engine just sent (by its newToken). */
function ackLatest(engine: GameStateSyncEngine, transport: MockTransport) {
  const last = transport.uploads[transport.uploads.length - 1];
  engine.onAck({ token: last.newToken });
}

beforeEach(() => {
  setLive(emptyState());
});

// ---- (a) first send with no ack is a full ----------------------------------

describe('GameStateSyncEngine — flag ON reconciliation', () => {
  it('(a) first send with no ack is a kind:"full"', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    setLive({ ...emptyState(), activeSceneId: 'scene-1' });
    engine.schedule();
    await tick();

    expect(transport.uploads).toHaveLength(1);
    expect(transport.uploads[0].kind).toBe('full');
    const full = transport.uploads[0];
    if (full.kind !== 'full') throw new Error('expected full');
    expect(full.newToken).toBeTruthy();
    expect(full.state).toEqual({ ...emptyState(), activeSceneId: 'scene-1' });
  });

  // ---- (b) after ack a change sends a patch diffing ACKNOWLEDGED ----------

  it('(b) after ack, a change sends a patch whose baseToken == acked token and diffs vs acknowledged (not live)', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    // First full send + ack establishes the acknowledged base.
    setLive({ ...emptyState(), activeSceneId: 'a' });
    engine.schedule();
    await tick();
    const fullToken = transport.uploads[0].newToken;
    ackLatest(engine, transport);

    // Mutate live and schedule → expect a patch against the ACKED state ('a').
    setLive({ ...emptyState(), activeSceneId: 'b' });
    engine.schedule();
    await tick();

    expect(transport.uploads).toHaveLength(2);
    const patchUpload = transport.uploads[1];
    if (patchUpload.kind !== 'patch') throw new Error('expected patch');
    // baseToken must equal the token the server acked.
    expect(patchUpload.baseToken).toBe(fullToken);
    // The patch diffs acknowledged('a') -> live('b'): replace activeSceneId to 'b'.
    expect(patchUpload.patch).toEqual([
      { op: 'replace', path: '/activeSceneId', value: 'b' },
    ]);
  });

  it('(b2) patch always diffs against acknowledged even after several unacked-then-acked hops', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    setLive({ ...emptyState(), activeSceneId: 'v1' });
    engine.schedule();
    await tick();
    ackLatest(engine, transport); // acknowledged = v1

    setLive({ ...emptyState(), activeSceneId: 'v2' });
    engine.schedule();
    await tick();
    ackLatest(engine, transport); // acknowledged = v2

    setLive({ ...emptyState(), activeSceneId: 'v3' });
    engine.schedule();
    await tick();

    const last = transport.uploads[transport.uploads.length - 1];
    if (last.kind !== 'patch') throw new Error('expected patch');
    // Diff must be v2 -> v3, NOT v1 -> v3.
    expect(last.patch).toEqual([
      { op: 'replace', path: '/activeSceneId', value: 'v3' },
    ]);
  });

  // ---- (c) changes while in-flight coalesce into ONE follow-up ------------

  it('(c) changes while in-flight set dirty and produce exactly ONE coalesced follow-up after the ack', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    setLive({ ...emptyState(), activeSceneId: 'a' });
    engine.schedule();
    await tick();
    ackLatest(engine, transport); // acknowledged = a
    expect(transport.uploads).toHaveLength(1);

    // Now send #2 (in flight, not yet acked).
    setLive({ ...emptyState(), activeSceneId: 'b' });
    engine.schedule();
    await tick();
    expect(transport.uploads).toHaveLength(2); // patch a->b in flight

    // Three more changes WHILE #2 is in flight → only dirty is set, no sends.
    setLive({ ...emptyState(), activeSceneId: 'c' });
    engine.schedule();
    setLive({ ...emptyState(), activeSceneId: 'd' });
    engine.schedule();
    setLive({ ...emptyState(), activeSceneId: 'e' });
    engine.schedule();
    await tick();
    expect(transport.uploads).toHaveLength(2); // still only the in-flight one

    // Ack #2 → exactly ONE coalesced follow-up (a->e via acked 'b'... wait: acked=b).
    ackLatest(engine, transport); // acknowledged = b
    await tick();
    expect(transport.uploads).toHaveLength(3); // single follow-up, not one-per-change
    const follow = transport.uploads[2];
    if (follow.kind !== 'patch') throw new Error('expected patch');
    // Diff acknowledged('b') -> live('e').
    expect(follow.patch).toEqual([
      { op: 'replace', path: '/activeSceneId', value: 'e' },
    ]);
  });

  // ---- (c2) re-entrant schedule() during the async hash window ------------

  it('(c2) a schedule() during the pending hashState await does NOT start a second concurrent flush; one upload in flight, one coalesced follow-up after the ack', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    // First schedule kicks off flush() → it suspends on `await hashState(live)`.
    // Mutate the built state and fire a SECOND schedule() in the SAME synchronous
    // tick (before any microtask settles). Pre-fix, the second schedule sees
    // inFlight === null (it's only set AFTER the await) and starts a rival flush,
    // producing TWO uploads. Post-fix, the `flushing` guard blocks it.
    setLive({ ...emptyState(), activeSceneId: 'first' });
    engine.schedule();
    setLive({ ...emptyState(), activeSceneId: 'second' });
    engine.schedule();

    await tick();

    // (1) Exactly ONE upload in flight — the re-entrant schedule was coalesced,
    //     not raced into a second concurrent flush.
    expect(transport.uploads).toHaveLength(1);
    const firstUpload = transport.uploads[0];
    expect(firstUpload.kind).toBe('full');

    // (2) After the single ack, exactly ONE coalesced follow-up reflecting the
    //     LATEST state ('second'), diffed against the acknowledged base ('first').
    ackLatest(engine, transport);
    await tick();

    expect(transport.uploads).toHaveLength(2);
    const follow = transport.uploads[1];
    if (follow.kind !== 'patch') throw new Error('expected patch');
    expect(follow.patch).toEqual([
      { op: 'replace', path: '/activeSceneId', value: 'second' },
    ]);
  });

  // ---- (d) resync / timeout drop the base; next send is a full -----------

  it('(d) onResyncRequired drops the base so the next send is a full snapshot', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    setLive({ ...emptyState(), activeSceneId: 'a' });
    engine.schedule();
    await tick();
    ackLatest(engine, transport); // acknowledged = a

    engine.onResyncRequired();
    await tick();

    // onResyncRequired flushes immediately with a full (base was dropped).
    const last = transport.uploads[transport.uploads.length - 1];
    expect(last.kind).toBe('full');
  });

  it('(d2) authoritative conflict recovery rebases without re-uploading stale state', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    setLive({ ...emptyState(), activeSceneId: 'losing-edit' });
    engine.schedule();
    await tick();
    expect(transport.uploads).toHaveLength(1);

    const authoritative = {
      ...emptyState(),
      activeSceneId: 'winning-edit',
    };
    const authoritativeToken = 'authoritative-token' as StateHash;
    setLive(authoritative);
    engine.onAuthoritativeSnapshot(
      authoritative,
      authoritativeToken,
      'base-mismatch',
    );
    engine.schedule();
    await tick();

    // Applying the winner does not echo it back as a stale full upload.
    expect(transport.uploads).toHaveLength(1);

    setLive({ ...emptyState(), activeSceneId: 'next-edit' });
    engine.schedule();
    await tick();

    expect(transport.uploads).toHaveLength(2);
    const follow = transport.uploads[1];
    if (follow.kind !== 'patch') throw new Error('expected patch');
    expect(follow.baseToken).toBe(authoritativeToken);
    expect(follow.patch).toEqual([
      { op: 'replace', path: '/activeSceneId', value: 'next-edit' },
    ]);
  });

  it('(d3) the ack timeout re-baselines with a full snapshot', async () => {
    // Use real timers because fake timers do not control WebCrypto digest.
    // Observe the timeout callback directly instead of relying on a short sleep,
    // which becomes flaky when the full suite is hashing in parallel.
    const transport = makeTransport();
    let resolveTimeout: () => void = () => undefined;
    const timeoutObserved = new Promise<void>((resolve) => {
      resolveTimeout = resolve;
    });
    const engine = new GameStateSyncEngine({
      buildState: () => JSON.parse(JSON.stringify(live)) as SyncableGameState,
      transport,
      isDeltaSyncEnabled: () => true,
      ackTimeoutMs: 250,
      onResync: (reason) => {
        if (reason === 'ack-timeout') resolveTimeout();
      },
    });

    setLive({ ...emptyState(), activeSceneId: 'a' });
    engine.schedule();
    await tick();
    ackLatest(engine, transport); // acknowledged = a

    // Send #2 (patch) and then let the ack time out (no ack sent).
    setLive({ ...emptyState(), activeSceneId: 'b' });
    engine.schedule();
    await tick();
    expect(transport.uploads.some((upload) => upload.kind === 'patch')).toBe(
      true,
    );

    // The unacknowledged patch times out and triggers a full follow-up.
    await timeoutObserved;
    await tick();

    const last = transport.uploads[transport.uploads.length - 1];
    expect(last.kind).toBe('full');
    engine.reset();
  });

  // ---- (e) stale ack (token mismatch) is ignored -------------------------

  it('(e) a stale ack (newToken mismatch) is ignored', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, true);

    setLive({ ...emptyState(), activeSceneId: 'a' });
    engine.schedule();
    await tick();
    expect(transport.uploads).toHaveLength(1);

    const realToken = transport.uploads[0].newToken;

    // Ack with a wrong token — must NOT promote acknowledged or clear inFlight.
    engine.onAck({ token: 'deadbeef' as StateHash });

    // Because the real send is still in flight (stale ack was ignored), a new
    // change only sets dirty — no second send yet.
    setLive({ ...emptyState(), activeSceneId: 'b' });
    engine.schedule();
    await tick();
    expect(transport.uploads).toHaveLength(1);

    // The CORRECT ack now promotes 'a' as acknowledged and flushes the coalesced
    // change as a patch whose baseToken is the just-acked real token — proving
    // the stale ack neither promoted early nor corrupted the chain.
    ackLatest(engine, transport);
    await tick();
    expect(transport.uploads).toHaveLength(2);
    const follow = transport.uploads[1];
    if (follow.kind !== 'patch') throw new Error('expected patch');
    expect(follow.baseToken).toBe(realToken);
    expect(follow.patch).toEqual([
      { op: 'replace', path: '/activeSceneId', value: 'b' },
    ]);
  });
});

// ---- (f) flag OFF always legacy, never patch -------------------------------

describe('GameStateSyncEngine — flag OFF (legacy)', () => {
  it('(f) flag OFF always sends legacy untagged full and never a patch', async () => {
    const transport = makeTransport();
    const engine = makeEngine(transport, false);

    setLive({ ...emptyState(), activeSceneId: 'a' });
    engine.schedule();
    await tick();

    // Even after a would-be ack, subsequent sends stay legacy full.
    setLive({ ...emptyState(), activeSceneId: 'b' });
    engine.schedule();
    await tick();
    setLive({ ...emptyState(), activeSceneId: 'c' });
    engine.schedule();
    await tick();

    expect(transport.uploads).toHaveLength(0); // no tagged uploads at all
    expect(transport.legacy.length).toBeGreaterThanOrEqual(3);
    expect(transport.legacy[transport.legacy.length - 1]).toEqual({
      scenes: [],
      activeSceneId: 'c',
      characters: [],
      initiative: {},
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

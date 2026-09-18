import jsonpatch, { type Operation } from 'fast-json-patch';
import type { Connection, GameState, Room } from '../types.js';
import type { DatabaseService } from '../database.js';
import type { SocketManager } from './SocketManager.js';
import type {
  GameStateUpload,
  JsonPatch,
  JsonValue,
  ResyncReason,
  StateHash,
  SyncableGameState,
} from '../../shared/sync/contracts.js';
import { createEmptySyncableGameState } from '../../shared/sync/contracts.js';
import { hashSync } from '../../shared/sync/hashSync.js';
import { observeCommitLatency } from '../observability/multiplayerMetrics.js';
import type { DeltaSyncMetrics } from '../observability/deltaSyncMetrics.js';
import { buildSyncableFromLegacy } from './syncableState.js';
import { sendMessage } from './messaging.js';

// Hard caps guarding the critical section from oversized payloads. A trip
// sends a payload-too-large resync instead of touching room state.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MiB serialized
const MAX_PATCH_OPS = 5000;

export interface GameStateCommitServiceDependencies {
  socketManager: SocketManager;
  db: DatabaseService;
  /** Shared, mutated in place; also read by the metrics routes. */
  deltaSyncMetrics: DeltaSyncMetrics;
}

/**
 * Owns the canonical game-state commit path: the per-room serialization queue,
 * upload validation, the PostgreSQL compare-and-swap of
 * (gameState, syncToken, stateVersion), the sender ACK and the peer patch
 * broadcast.
 *
 * Ordering here is a durability contract, not an implementation detail:
 * the `game-state-ack` is sent only after `commitGameState()` has committed,
 * and in-memory room state advances only after that same commit.
 */
export class GameStateCommitService {
  private readonly socketManager: SocketManager;
  private readonly db: DatabaseService;
  private readonly deltaSyncMetrics: DeltaSyncMetrics;
  private readonly commitQueues = new Map<string, Promise<void>>();

  constructor({
    socketManager,
    db,
    deltaSyncMetrics,
  }: GameStateCommitServiceDependencies) {
    this.socketManager = socketManager;
    this.db = db;
    this.deltaSyncMetrics = deltaSyncMetrics;
  }

  /** Number of rooms with an in-flight or queued commit. */
  public get queueDepth(): number {
    return this.commitQueues.size;
  }

  public enqueueUpload(
    roomCode: string,
    sender: Connection,
    data: unknown,
  ): void {
    const previous = this.commitQueues.get(roomCode) ?? Promise.resolve();
    const queued = previous
      .catch(() => undefined)
      .then(() => this.handleGameStateUpload(roomCode, sender, data));
    this.commitQueues.set(roomCode, queued);
    void queued.finally(() => {
      if (this.commitQueues.get(roomCode) === queued) {
        this.commitQueues.delete(roomCode);
      }
    });
  }

  /**
   * Validates a host upload and atomically compare-and-swaps the snapshot,
   * content hash, and version in PostgreSQL. PostgreSQL is the serialization
   * point across replicas; memory, peer broadcasts, and the sender ACK advance
   * only after the transaction commits.
   */
  private async handleGameStateUpload(
    roomCode: string,
    sender: Connection,
    data: unknown,
  ): Promise<void> {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room) return;

    const upload = (data as { upload?: GameStateUpload }).upload;
    this.deltaSyncMetrics.totalUploads++;

    // ---- payload-too-large guard (before touching any state) -------------
    if (upload) {
      const serialized = JSON.stringify(upload);
      if (serialized.length > MAX_UPLOAD_BYTES) {
        this.sendResync(sender, room, 'payload-too-large');
        return;
      }
      if (upload.kind === 'patch' && upload.patch.length > MAX_PATCH_OPS) {
        this.sendResync(sender, room, 'payload-too-large');
        return;
      }
    } else {
      // Legacy untagged snapshot: guard on the serialized top-level data.
      const serialized = JSON.stringify(data ?? {});
      if (serialized.length > MAX_UPLOAD_BYTES) {
        this.sendResync(sender, room, 'payload-too-large');
        return;
      }
    }

    // Capture the database compare-and-swap anchors before building a candidate.
    const prevToken = room.syncToken;
    const prevVersion = room.stateVersion;
    const prevState: SyncableGameState = room.gameState
      ? (jsonpatch.deepClone(room.gameState) as unknown as SyncableGameState)
      : createEmptySyncableGameState();

    // The committed next state + its token, resolved per input shape. Every
    // rejecting branch returns before commit, so both values are definitely
    // assigned by the successful branch that reaches the commit below.
    let committed: SyncableGameState;
    let committedToken: StateHash;
    // For patch uploads we reuse the client's patch as the peer broadcast; for
    // full/legacy we compute a delta below. undefined = compute delta.
    let broadcastPatch: JsonPatch | undefined;

    if (!upload) {
      // --- Legacy full (trusted; client sent no token, no integrity check) --
      const state = buildSyncableFromLegacy(data);
      committed = state;
      committedToken = hashSync(state as unknown as JsonValue);
    } else if (upload.kind === 'full') {
      // --- Tagged full: verify integrity against declared newToken ----------
      if (hashSync(upload.state as unknown as JsonValue) !== upload.newToken) {
        this.sendResync(sender, room, 'integrity-mismatch');
        return;
      }
      committed = upload.state;
      committedToken = upload.newToken;
    } else {
      // --- Patch: base-match, apply, integrity-check ------------------------
      if (upload.baseToken !== room.syncToken) {
        this.sendResync(sender, room, 'base-mismatch');
        return; // no mutation
      }
      let candidate: SyncableGameState;
      try {
        const result = jsonpatch.applyPatch(
          jsonpatch.deepClone(prevState),
          upload.patch as Operation[],
          /* validateOperation */ true,
        );
        candidate = result.newDocument as unknown as SyncableGameState;
      } catch {
        this.sendResync(sender, room, 'malformed-patch');
        return;
      }
      if (hashSync(candidate as unknown as JsonValue) !== upload.newToken) {
        this.sendResync(sender, room, 'integrity-mismatch');
        return;
      }
      committed = candidate;
      committedToken = upload.newToken;
      broadcastPatch = upload.patch;
    }

    const commitStartedAt = Date.now();
    let persisted: Awaited<ReturnType<DatabaseService['commitGameState']>>;
    try {
      persisted = await this.db.commitGameState(
        roomCode,
        prevVersion,
        prevToken,
        committed,
        committedToken,
      );
    } catch (error) {
      this.deltaSyncMetrics.durability.failures++;
      console.error(
        `Failed to durably commit game state for room ${roomCode}:`,
        error,
      );
      sendMessage(sender, {
        type: 'error',
        data: {
          message: 'Game-state commit failed; the update was not acknowledged.',
          code: 503,
        },
        timestamp: Date.now(),
      });
      return;
    }

    if (persisted.status === 'conflict') {
      this.deltaSyncMetrics.durability.conflicts++;
      let authoritative = buildSyncableFromLegacy(persisted.gameState);
      let authoritativeToken = hashSync(authoritative as unknown as JsonValue);
      let authoritativeVersion = persisted.stateVersion;

      // Legacy save APIs invalidate their token. Re-anchor such rows without
      // overwriting a durable commit that raced with this recovery.
      if (persisted.syncToken !== authoritativeToken) {
        const repaired = await this.db.repairGameStateMetadata(
          roomCode,
          persisted.stateVersion,
          persisted.syncToken,
          authoritative,
          authoritativeToken,
        );
        if (repaired) {
          authoritative = buildSyncableFromLegacy(repaired.gameState);
          authoritativeToken = hashSync(authoritative as unknown as JsonValue);
          authoritativeVersion = repaired.stateVersion;
        }
      }

      if (authoritativeVersion >= room.stateVersion) {
        room.previousGameState = room.gameState;
        room.gameState = authoritative as unknown as GameState;
        room.syncToken = authoritativeToken;
        room.stateVersion = authoritativeVersion;
      }
      this.sendResync(sender, room, 'base-mismatch');
      return;
    }

    const commitLatencyMs = Date.now() - commitStartedAt;
    this.deltaSyncMetrics.durability.committed++;
    this.deltaSyncMetrics.durability.totalCommitLatencyMs += commitLatencyMs;
    this.deltaSyncMetrics.durability.maxCommitLatencyMs = Math.max(
      this.deltaSyncMetrics.durability.maxCommitLatencyMs,
      commitLatencyMs,
    );
    observeCommitLatency(
      this.deltaSyncMetrics.durability.commitLatency,
      commitLatencyMs,
    );

    room.gameState = committed as unknown as GameState;
    room.syncToken = committedToken;
    room.stateVersion = persisted.stateVersion;
    room.previousGameState = prevState as unknown as GameState;
    const newToken = committedToken;
    const version = persisted.stateVersion;

    // Record commit branch for metrics (legacy/full/patch).
    if (!upload) {
      this.deltaSyncMetrics.commits.legacy++;
    } else if (upload.kind === 'full') {
      this.deltaSyncMetrics.commits.full++;
    } else {
      // upload.kind === 'patch'
      this.deltaSyncMetrics.commits.patch++;
      // Calculate bytes saved: max(0, fullSnapshotSize - patchSize).
      const fullSnapshotBytes = JSON.stringify(committed).length;
      const patchBytes = JSON.stringify(upload.patch).length;
      this.deltaSyncMetrics.patchBytesSaved += Math.max(
        0,
        fullSnapshotBytes - patchBytes,
      );
    }

    // Peer delta: for full/legacy commits compute prevState -> committed so
    // peers still receive a minimal patch rather than a whole snapshot.
    const patch: JsonPatch =
      broadcastPatch ??
      (jsonpatch.compare(
        prevState as unknown as Record<string, unknown>,
        committed as unknown as Record<string, unknown>,
      ) as JsonPatch);
    // The ACK is a durability promise: the complete tuple is already committed.
    this.sendSyncAck(sender, newToken, version);

    // 2) Broadcast the chained patch to peers, excluding the sender.
    if (patch.length > 0) {
      this.socketManager.broadcastToRoom(
        roomCode,
        {
          type: 'game-state-patch',
          data: {
            patch: patch as unknown[],
            version,
            baseToken: prevToken,
            newToken,
          },
          timestamp: Date.now(),
        },
        sender.id,
      );
      console.log(
        `📡 Broadcasting game state patch v${version} to room ${roomCode} (${patch.length} operations) [excluding sender ${sender.id}]`,
      );
    }
  }

  /** Sends a game-state-ack to the sender confirming the committed token. */
  private sendSyncAck(
    connection: Connection,
    token: StateHash,
    version: number,
  ): void {
    sendMessage(connection, {
      type: 'game-state-ack',
      data: { token, version },
      timestamp: Date.now(),
    });
  }

  /**
   * Sends a game-state-resync-required directive to the sender after a chain
   * break (base/integrity mismatch, malformed patch, oversized payload).
   * Increments the resync counter for the given reason.
   */
  private sendResync(
    connection: Connection,
    room: Room,
    reason: ResyncReason,
  ): void {
    const gameState = (room.gameState ??
      createEmptySyncableGameState()) as GameState;
    const serverToken =
      room.syncToken ?? hashSync(gameState as unknown as JsonValue);
    this.deltaSyncMetrics.resync[reason]++;
    sendMessage(connection, {
      type: 'game-state-resync-required',
      data: {
        serverToken,
        gameState,
        version: room.stateVersion,
        reason,
      },
      timestamp: Date.now(),
    });
  }
}

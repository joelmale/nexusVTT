import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../../../server/database.js';
import { RealtimeCoordinator } from '../../../../server/services/realtimeCoordinator.js';
import type { OrderedTransportEnvelope } from '../../../../shared/events/contracts.js';

function event(serverSequence: number): OrderedTransportEnvelope {
  return {
    type: 'event',
    data: { name: 'scene/update', sceneId: `scene-${serverSequence}` },
    timestamp: serverSequence,
    eventId: `00000000-0000-4000-8000-${String(serverSequence).padStart(12, '0')}`,
    actorId: '11111111-1111-4111-8111-111111111111',
    clientSequence: serverSequence,
    serverSequence,
    occurredAt: serverSequence,
    roomCode: 'ABCD',
    echoToActor: false,
  };
}

describe('RealtimeCoordinator single-instance fallback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('delivers ordered events and repairs a sequence gap from the journal', async () => {
    vi.stubEnv('REDIS_URL', '');
    const database = {
      getRoomEventReplay: vi.fn(async () => ({
        baselineSequence: 1,
        latestSequence: 3,
        events: [event(2), event(3)],
        truncated: false,
      })),
    } as unknown as DatabaseService;
    const coordinator = new RealtimeCoordinator(database);
    const delivered: number[] = [];
    coordinator.on('ordered', (envelope: OrderedTransportEnvelope) => {
      delivered.push(envelope.serverSequence);
    });

    await coordinator.initialize();
    coordinator.registerRoom('ABCD', 0);
    await coordinator.publishOrdered(event(1));
    await coordinator.publishOrdered(event(3));

    expect(delivered).toEqual([1, 2, 3]);
    expect(database.getRoomEventReplay).toHaveBeenCalledWith('ABCD', 1);
    expect(coordinator.getMetrics()).toMatchObject({
      enabled: false,
      sequenceGaps: 1,
      journalCatchUps: 1,
      replayedEvents: 2,
    });
    await coordinator.shutdown();
  });

  it('tracks local presence without requiring Redis', async () => {
    vi.stubEnv('REDIS_URL', '');
    const coordinator = new RealtimeCoordinator({} as DatabaseService);
    await coordinator.initialize();

    await coordinator.registerPresence('abcd', 'host-connection', 'host', 'host');
    await coordinator.registerPresence(
      'ABCD',
      'player-connection',
      'player',
      'player',
    );
    await coordinator.updatePresenceRole(
      'ABCD',
      'player-connection',
      'cohost',
    );

    expect(await coordinator.getRoomPresence('ABCD')).toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({ userId: 'host', role: 'host' }),
        expect.objectContaining({ userId: 'player', role: 'cohost' }),
      ]),
    });

    await coordinator.unregisterPresence('ABCD', 'player-connection');
    expect((await coordinator.getRoomPresence('ABCD')).members).toHaveLength(1);
    await coordinator.shutdown();
  });

  it('normalizes room registrations, ignores unchanged roles, and removes local presence', async () => {
    vi.stubEnv('REDIS_URL', '');
    const coordinator = new RealtimeCoordinator({} as DatabaseService);
    coordinator.registerRoom('abcd', 2);
    coordinator.registerRoom('ABCD', 1);
    await coordinator.registerPresence('abcd', 'connection-1', 'user-1', 'player');
    await coordinator.updatePresenceRole('ABCD', 'connection-1', 'player');
    expect(await coordinator.getRoomPresence('ABCD')).toMatchObject({ members: [expect.objectContaining({ userId: 'user-1', role: 'player' })] });
    coordinator.unregisterRoom('abcd');
    await coordinator.unregisterPresence('abcd', 'connection-1');
    expect((await coordinator.getRoomPresence('ABCD')).members).toHaveLength(0);
    await coordinator.shutdown();
  });

  it('does not replay duplicate ordered events and adopts the baseline from a truncated journal', async () => {
    vi.stubEnv('REDIS_URL', '');
    const database = { getRoomEventReplay: vi.fn(async () => ({ baselineSequence: 10, latestSequence: 11, truncated: true, events: [event(11)] })) } as unknown as DatabaseService;
    const coordinator = new RealtimeCoordinator(database);
    const delivered: number[] = [];
    coordinator.on('ordered', (entry: OrderedTransportEnvelope) => delivered.push(entry.serverSequence));
    coordinator.registerRoom('ABCD', 2);
    await coordinator.publishOrdered(event(2));
    await coordinator.publishOrdered(event(11));
    expect(delivered).toEqual([11]);
    expect(coordinator.getMetrics()).toMatchObject({ duplicateFanout: 1, sequenceGaps: 1, journalCatchUps: 1, replayedEvents: 1 });
    await coordinator.shutdown();
  });

  it('processes remote transient and presence fanout only for active rooms', async () => {
    vi.stubEnv('REDIS_URL', '');
    const coordinator = new RealtimeCoordinator({} as DatabaseService);
    coordinator.registerRoom('ABCD', 0);
    const transient = vi.fn(); const presence = vi.fn();
    coordinator.on('transient', transient); coordinator.on('presence', presence);
    const internal = coordinator as unknown as { handleFanout(raw: string): Promise<void> };
    await internal.handleFanout(JSON.stringify({ version: 1, kind: 'transient', originInstanceId: 'other', roomCode: 'abcd', publishedAt: 1, message: { type: 'chat-message', data: {}, timestamp: 1 }, excludeId: 'user-1' }));
    await internal.handleFanout(JSON.stringify({ version: 1, kind: 'presence', originInstanceId: 'other', roomCode: 'ABCD', publishedAt: 1 }));
    await internal.handleFanout('not-json');
    expect(transient).toHaveBeenCalledWith('ABCD', expect.objectContaining({ type: 'chat-message' }), 'user-1');
    expect(presence).toHaveBeenCalledWith('ABCD', expect.any(Object));
    expect(coordinator.getMetrics()).toMatchObject({ transientReceived: 1 });
    await coordinator.shutdown();
  });

  it('publishes through an available coordinator client and records publish failures', async () => {
    vi.stubEnv('REDIS_URL', '');
    const coordinator = new RealtimeCoordinator({} as DatabaseService);
    const publish = vi.fn().mockResolvedValue(undefined);
    const internal = coordinator as unknown as {
      commandClient: { publish: typeof publish };
      connected: boolean;
      publish(message: Record<string, unknown>): Promise<void>;
    };
    internal.commandClient = { publish };
    internal.connected = true;
    await internal.publish({ kind: 'presence' });
    publish.mockRejectedValueOnce(new Error('redis down'));
    await internal.publish({ kind: 'presence' });
    expect(publish).toHaveBeenCalledTimes(2);
    expect(coordinator.getMetrics().publishFailures).toBe(1);
    internal.commandClient = null as unknown as { publish: typeof publish };
    await coordinator.shutdown();
  });
});

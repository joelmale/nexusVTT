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
});

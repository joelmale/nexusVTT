import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { EntityVersionConflictError, EventJournalRepository } from '../../../../server/repositories/EventJournalRepository.js';

const identity = { eventId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', clientSequence: 1, occurredAt: 1 };
const message = { type: 'event', data: { name: 'token/move' }, timestamp: 1 } as never;

describe('EventJournalRepository', () => {
  let query: ReturnType<typeof vi.fn>; let client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }; let repository: EventJournalRepository;
  beforeEach(() => { query = vi.fn(); client = { query: vi.fn(), release: vi.fn() }; repository = new EventJournalRepository({ query, connect: vi.fn(async () => client) } as unknown as Pool); });

  it('commits one ordered event and advances entity version in the same transaction', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'session-1', eventSequence: '4' }] })
      .mockResolvedValueOnce({ rows: [{ version: '2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await repository.append('ROOM', identity, message, false, { entityId: 'token-1', expectedVersion: 1 });
    expect(result).toMatchObject({ duplicate: false, event: { roomCode: 'ROOM', serverSequence: 4, actorId: identity.actorId } });
    expect(client.query).toHaveBeenCalledWith('BEGIN'); expect(client.query).toHaveBeenCalledWith('COMMIT'); expect(client.release).toHaveBeenCalled();
  });

  it('returns existing events idempotently and rolls back entity conflicts', async () => {
    const existing = { type: 'chat-message', data: {}, roomCode: 'ROOM', serverSequence: 1 };
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ envelope: existing }] }).mockResolvedValueOnce({ rows: [] });
    await expect(repository.append('ROOM', identity, message, false)).resolves.toMatchObject({ duplicate: true, event: { echoToActor: true } });
    client.query.mockReset().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'session-1', eventSequence: '2' }] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ version: '4' }] }).mockResolvedValueOnce({ rows: [] });
    await expect(repository.append('ROOM', identity, message, false, { entityId: 'token-1', expectedVersion: 1 })).rejects.toBeInstanceOf(EntityVersionConflictError);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('builds replay windows for current, truncated, and unavailable event history', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'session-1', eventSequence: '5' }] });
    await expect(repository.getReplayWindow('ROOM', null)).resolves.toMatchObject({ baselineSequence: 5, truncated: false });
    query.mockResolvedValueOnce({ rows: [{ id: 'session-1', eventSequence: '5' }] });
    await expect(repository.getReplayWindow('ROOM', 6)).resolves.toMatchObject({ baselineSequence: 5, truncated: true });
    query.mockResolvedValueOnce({ rows: [{ id: 'session-1', eventSequence: '5' }] }).mockResolvedValueOnce({ rows: [{ earliestSequence: '4' }] }).mockResolvedValueOnce({ rows: [{ envelope: { type: 'event', data: { name: 'dice/roll-result' }, serverSequence: 4 } }] });
    await expect(repository.getReplayWindow('ROOM', 1)).resolves.toMatchObject({ baselineSequence: 3, truncated: true, events: [expect.objectContaining({ echoToActor: true })] });
  });
});

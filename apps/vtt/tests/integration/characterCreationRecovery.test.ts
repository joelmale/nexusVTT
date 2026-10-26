import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDatabaseService,
  type DatabaseService,
} from '../../server/database.js';
import { CharacterCreationConflictError } from '../../server/utils/characterCreationIdentity.js';
import { assertTestDatabase } from './assertTestDatabase.js';

const runIntegration = process.env.DATABASE_URL ? describe : describe.skip;

runIntegration('character creation durable recovery', () => {
  let db: DatabaseService;
  let pool: Pool;
  const ownerIds: string[] = [];

  beforeAll(async () => {
    assertTestDatabase();
    db = createDatabaseService({ connectionString: process.env.DATABASE_URL });
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await db.initialize();
    for (let index = 0; index < 2; index += 1) {
      const result = await pool.query<{ id: string }>(
        'INSERT INTO users (name, provider) VALUES ($1, $2) RETURNING id',
        [`Repair test ${index}`, 'test'],
      );
      ownerIds.push(result.rows[0].id);
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
        ownerIds,
      ]);
      await pool.end();
    }
    await db?.close();
  });

  it('serializes concurrent retries and replays after a lost response', async () => {
    const attemptId = randomUUID();
    const input = {
      id: randomUUID(),
      abilities: { STR: 16 },
      inventory: [{ id: 'sword', quantity: 1 }],
    };
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        db.createCharacterOnce(ownerIds[0], 'Saved once', input, attemptId, 1),
      ),
    );
    expect(new Set(results.map((record) => record.id)).size).toBe(1);
    const replay = await db.createCharacterOnce(
      ownerIds[0],
      'Saved once',
      input,
      attemptId,
      1,
    );
    expect(replay.id).toBe(results[0].id);
    expect(replay.data).toMatchObject({ id: replay.id, legacyId: input.id });
    expect(
      (await db.getCharactersByUser(ownerIds[0])).filter(
        (record) => record.name === 'Saved once',
      ),
    ).toHaveLength(1);
  });

  it('isolates attempts by owner and permits intentional same-content copies', async () => {
    const attemptId = randomUUID();
    const first = await db.createCharacterOnce(
      ownerIds[0],
      'Copy',
      {},
      attemptId,
      1,
    );
    const second = await db.createCharacterOnce(
      ownerIds[1],
      'Copy',
      {},
      attemptId,
      1,
    );
    const copy = await db.createCharacterOnce(
      ownerIds[0],
      'Copy',
      {},
      randomUUID(),
      1,
    );
    expect(new Set([first.id, second.id, copy.id]).size).toBe(3);
  });

  it('refuses changed choices, nested definition IDs or revisions for a frozen attempt', async () => {
    const attemptId = randomUUID();
    await db.createCharacterOnce(
      ownerIds[0],
      'Fixed revision',
      { inventory: [{ id: 'one' }] },
      attemptId,
      2,
    );
    await expect(
      db.createCharacterOnce(
        ownerIds[0],
        'Fixed revision',
        { inventory: [{ id: 'two' }] },
        attemptId,
        2,
      ),
    ).rejects.toBeInstanceOf(CharacterCreationConflictError);
    await expect(
      db.createCharacterOnce(
        ownerIds[0],
        'Fixed revision',
        { inventory: [{ id: 'one' }] },
        attemptId,
        3,
      ),
    ).rejects.toBeInstanceOf(CharacterCreationConflictError);
  });

  it('rolls back the character and legacy mapping when receipt persistence fails', async () => {
    const embeddedId = randomUUID();
    await expect(
      db.createCharacterOnce(
        ownerIds[0],
        'Must roll back',
        { id: embeddedId },
        'a'.repeat(129),
        1,
      ),
    ).rejects.toThrow();
    expect(
      (await db.getCharactersByUser(ownerIds[0])).some(
        (record) => record.name === 'Must roll back',
      ),
    ).toBe(false);
    expect(
      await db.characters.resolveCanonicalId('character', embeddedId),
    ).toBeNull();
  });

  it('retains a tombstone so retrying a deleted character cannot resurrect it', async () => {
    const attemptId = randomUUID();
    const character = await db.createCharacterOnce(
      ownerIds[0],
      'Deleted',
      {},
      attemptId,
      1,
    );
    await db.deleteCharacter(character.id);
    await expect(
      db.createCharacterOnce(ownerIds[0], 'Deleted', {}, attemptId, 1),
    ).rejects.toThrow('deleted');
  });

  it('round-trips campaign edition, one-shot mode and explicit mood clearing', async () => {
    const campaign = await db.createCampaign(
      ownerIds[0],
      'One evening',
      undefined,
      {
        edition: '2014',
        mode: 'one-shot',
        mood: 'grimdark',
      },
    );
    await db.updateCampaign(campaign.id, { mood: null });
    expect(await db.getCampaignById(campaign.id)).toMatchObject({
      edition: '2014',
      mode: 'one-shot',
      mood: null,
    });
  });
});

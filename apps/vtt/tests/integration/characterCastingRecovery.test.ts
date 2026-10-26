import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  DomainCommand,
  DomainCommandPayload,
} from '@nexus/game-contracts';
import {
  createDatabaseService,
  type DatabaseService,
} from '../../server/database.js';
import { bundledSpellDefinitions } from '../../server/services/characterActorProjection.js';
import { assertTestDatabase } from './assertTestDatabase.js';
import {
  createEmptySyncableGameState,
  type JsonValue,
} from '../../shared/sync/contracts.js';
import { hashSync } from '../../shared/sync/hashSync.js';

const runIntegration = process.env.DATABASE_URL ? describe : describe.skip;
runIntegration('saved character admission and casting recovery', () => {
  let db: DatabaseService;
  let pool: Pool;
  let ownerId: string;
  let campaignId: string;
  const additionalUsers: string[] = [];
  beforeAll(async () => {
    assertTestDatabase();
    db = createDatabaseService({ connectionString: process.env.DATABASE_URL });
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await db.initialize();
    ownerId = (
      await pool.query<{ id: string }>(
        "INSERT INTO users (name, provider) VALUES ('Casting repair test', 'test') RETURNING id",
      )
    ).rows[0].id;
    campaignId = (await db.createCampaign(ownerId, 'Casting recovery')).id;
  });
  afterAll(async () => {
    if (pool) {
      await pool.query('DELETE FROM users WHERE id = $1', [ownerId]);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
        additionalUsers,
      ]);
      await pool.end();
    }
    await db?.close();
  });
  function command(payload: DomainCommandPayload): DomainCommand {
    return {
      commandId: randomUUID(),
      campaignId,
      issuerUserId: ownerId,
      protocolVersion: '1.0',
      timestamp: new Date().toISOString(),
      payload,
    };
  }

  it('admits saved HP and resources once, commits a concurrent cast retry once, rejects unknown revisions and restores slots', async () => {
    const character = await db.createCharacterOnce(
      ownerId,
      'Saved wizard',
      {
        edition: '2024',
        classSlug: 'wizard',
        level: 1,
        hitPoints: 0,
        maxHitPoints: 8,
        proficiencyBonus: 2,
        abilities: { INT: { score: 16, modifier: 3 } },
        spellcasting: {
          ability: 'INT',
          spellAttackBonus: 5,
          spellSaveDC: 13,
          spellSlots: [3, 2],
          usedSpellSlots: [0, 1],
          cantripsKnown: ['fire-bolt'],
          spellbook: ['magic-missile', 'shield'],
          preparedSpells: ['magic-missile'],
        },
      },
      randomUUID(),
      1,
    );
    const admit = command({
      type: 'AdmitCharacter',
      characterDefinitionRef: {
        kind: 'character',
        id: character.id,
        revision: 1,
      },
      initialControllerUserIds: [ownerId],
    });
    await Promise.all([
      db.domainCommands.execute(admit, { principalId: ownerId }),
      db.domainCommands.execute(
        { ...admit, commandId: randomUUID() },
        { principalId: ownerId },
      ),
    ]);
    const actors = await db.campaignActors.getActorsByCampaign(campaignId);
    expect(actors).toHaveLength(1);
    const actor = actors[0];
    expect(actor.currentHp).toBe(0);
    expect(actor.maxHp).toBe(8);
    const spell = bundledSpellDefinitions(campaignId, ownerId, '2024').find(
      (entry) => entry.slug === 'magic-missile',
    )!;
    const cast = command({
      type: 'CastSpell',
      actorId: actor.id,
      spellRef: { kind: 'spell', id: spell.id, revision: 1 },
      profileId: 'class:wizard',
      castAtLevel: 1,
    });
    const results = await Promise.all([
      db.domainCommands.execute(cast, { principalId: ownerId }),
      db.domainCommands.execute(cast, { principalId: ownerId }),
    ]);
    expect(results.every((result) => result.receipt.result.success)).toBe(true);
    expect(results.filter((result) => result.duplicate)).toHaveLength(1);
    const committed = await db.campaignActors.getActorById(actor.id);
    expect(committed?.resourcePools).toMatchObject({
      'class:wizard:slots': { slots: { '1': { current: 0, total: 2 } } },
    });
    const missing = command({
      ...(cast.payload as Extract<DomainCommandPayload, { type: 'CastSpell' }>),
      spellRef: { kind: 'spell', id: spell.id, revision: 999 },
    });
    await expect(
      db.domainCommands.execute(missing, { principalId: ownerId }),
    ).rejects.toThrow('revision');
    expect(await db.commandReceipts.getReceipt(missing.commandId)).toBeNull();
    await db.domainCommands.execute(
      command({ type: 'RestActor', actorId: actor.id, restType: 'long' }),
      { principalId: ownerId },
    );
    expect(
      (await db.campaignActors.getActorById(actor.id))?.resourcePools,
    ).toMatchObject({
      'class:wizard:slots': { slots: { '1': { current: 2 } } },
    });
  });

  it('uses the committed room claim to admit an account character and revokes a previous controller after reassignment', async () => {
    const firstPlayer = randomUUID();
    const nextPlayer = randomUUID();
    additionalUsers.push(firstPlayer, nextPlayer);
    await pool.query(
      "INSERT INTO users (id, name, provider) VALUES ($1, 'Claim controller one', 'test'), ($2, 'Claim controller two', 'test')",
      [firstPlayer, nextPlayer],
    );
    const character = await db.createCharacterOnce(
      ownerId,
      'Claimed wizard',
      {
        edition: '2024',
        classSlug: 'wizard',
        level: 1,
        abilities: { INT: { score: 16, modifier: 3 } },
        spellcasting: {
          ability: 'INT',
          spellSlots: [3, 2],
          cantripsKnown: ['fire-bolt'],
          spellbook: ['magic-missile'],
          preparedSpells: ['magic-missile'],
        },
      },
      randomUUID(),
      1,
    );
    const room = await db.sessions.createSession(campaignId, ownerId);
    async function assign(playerId: string) {
      const current = (await db.sessions.getSessionById(room.sessionId))!;
      const state = {
        ...createEmptySyncableGameState(),
        characters: [{ id: character.id, name: 'Claimed wizard', playerId }],
      };
      const committed = await db.sessions.commitGameState(
        room.joinCode,
        current.stateVersion,
        current.syncToken,
        state,
        hashSync(state as unknown as JsonValue),
      );
      expect(committed.status).toBe('committed');
    }
    await assign(firstPlayer);
    const admission = command({
      type: 'AdmitCharacter',
      characterDefinitionRef: {
        kind: 'character',
        id: character.id,
        revision: 1,
      },
      initialControllerUserIds: [firstPlayer],
    });
    const admitted = await db.domainCommands.execute(
      { ...admission, issuerUserId: firstPlayer },
      { principalId: firstPlayer, campaignId, roomId: room.joinCode },
    );
    expect(admitted.receipt.result.success).toBe(true);
    const actor = (
      await db.campaignActors.getActorsByCampaign(campaignId)
    ).find(
      (entry) => (entry.sourceRef as { id?: string })?.id === character.id,
    )!;
    const spell = bundledSpellDefinitions(campaignId, ownerId, '2024').find(
      (entry) => entry.slug === 'magic-missile',
    )!;
    const cast = () =>
      command({
        type: 'CastSpell',
        actorId: actor.id,
        spellRef: { kind: 'spell', id: spell.id, revision: 1 },
        profileId: 'class:wizard',
        castAtLevel: 1,
      });
    expect(
      (
        await db.domainCommands.execute(cast(), {
          principalId: firstPlayer,
          campaignId,
          roomId: room.joinCode,
        })
      ).receipt.result.success,
    ).toBe(true);
    await assign(nextPlayer);
    const rejected = cast();
    await expect(
      db.domainCommands.execute(rejected, {
        principalId: firstPlayer,
        campaignId,
        roomId: room.joinCode,
      }),
    ).rejects.toThrow('current room controller');
    expect(await db.commandReceipts.getReceipt(rejected.commandId)).toBeNull();
    expect(
      (
        await db.domainCommands.execute(cast(), {
          principalId: nextPlayer,
          campaignId,
          roomId: room.joinCode,
        })
      ).receipt.result.success,
    ).toBe(true);
    expect(
      (await db.campaignActors.getActorById(actor.id))?.resourcePools,
    ).toMatchObject({
      'class:wizard:slots': { slots: { '1': { current: 0 } } },
    });
  });
});

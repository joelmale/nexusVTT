import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { DomainCommandService } from '../../../../server/commands/DomainCommandService.js';
import type { DatabaseService } from '../../../../server/database.js';
import type { DomainCommand } from '@nexus/game-contracts';

describe('DomainCommandService', () => {
  let service: DomainCommandService;
  let mockDb: {
    commandReceipts: {
      getReceipt: ReturnType<typeof vi.fn>;
      saveReceipt: ReturnType<typeof vi.fn>;
    };
    campaignActors: {
      lockActorForUpdate: ReturnType<typeof vi.fn>;
      updateActorState: ReturnType<typeof vi.fn>;
      getActorsByCampaign: ReturnType<typeof vi.fn>;
      createActor: ReturnType<typeof vi.fn>;
    };
    characters: {
      getCharacterById: ReturnType<typeof vi.fn>;
    };
    libraryObjects: {
      getRevision: ReturnType<typeof vi.fn>;
      getObjectById: ReturnType<typeof vi.fn>;
    };
    encounterRuns: {
      createRun: ReturnType<typeof vi.fn>;
      getRunById: ReturnType<typeof vi.fn>;
      updateRun: ReturnType<typeof vi.fn>;
    };
    withTransaction: ReturnType<typeof vi.fn>;
  };
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
  };

  const mockActor = {
    id: '11111111-1111-4111-8111-111111111111',
    campaignId: '22222222-2222-4222-8222-222222222222',
    ownerId: 'user-1',
    name: 'Kyra',
    ruleset: { system: 'dnd5e', edition: '2024' },
    stateVersion: 1,
    currentHp: 20,
    maxHp: 25,
    tempHp: 0,
    conditions: [] as string[],
    deathSaves: { successes: 0, failures: 0 },
    resourcePools: {},
    spellcastingProfiles: [],
    inventory: [],
    activeSessionId: null,
    payload: { kind: 'character', characterId: 'char-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    };

    mockDb = {
      commandReceipts: {
        getReceipt: vi.fn().mockResolvedValue(null),
        saveReceipt: vi.fn().mockResolvedValue(undefined),
      },
      campaignActors: {
        lockActorForUpdate: vi.fn(),
        updateActorState: vi.fn(),
        getActorsByCampaign: vi.fn().mockResolvedValue([]),
        createActor: vi.fn(),
      },
      characters: {
        getCharacterById: vi.fn(),
      },
      libraryObjects: {
        getRevision: vi.fn().mockResolvedValue(null),
        getObjectById: vi.fn().mockResolvedValue(null),
      },
      encounterRuns: {
        createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
        getRunById: vi.fn(),
        updateRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      },
      withTransaction: vi.fn(async (cb: (client: PoolClient) => Promise<unknown>) => {
        return cb(mockClient as unknown as PoolClient);
      }),
    };

    service = new DomainCommandService(mockDb as unknown as DatabaseService);
  });

  describe('ApplyDamage', () => {
    const baseDamageCommand: DomainCommand = {
      commandId: '99999999-9999-4999-8999-999999999999',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: { [mockActor.id]: 1 },
      payload: {
        type: 'ApplyDamage',
        targetActorId: mockActor.id,
        amount: 8,
        damageType: 'slashing',
      },
    };

    it('reduces HP and advances version upon damage', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce({ ...mockActor });
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...mockActor, currentHp: 12, stateVersion: 2 },
      });

      const response = await service.execute(baseDamageCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(response.receipt.result.committedVersions[mockActor.id]).toBe(2);
      expect((response.receipt.result.data as { currentHp: number }).currentHp).toBe(12);

      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          currentHp: 12,
          tempHp: 0,
        }),
        mockClient,
      );
      expect(mockDb.commandReceipts.saveReceipt).toHaveBeenCalled();
    });

    it('absorbs damage through temporary HP first', async () => {
      const actorWithTempHp = { ...mockActor, tempHp: 5 };
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(actorWithTempHp);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...actorWithTempHp, tempHp: 0, currentHp: 17, stateVersion: 2 },
      });

      const response = await service.execute(baseDamageCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          tempHp: 0,
          currentHp: 17, // 8 dmg - 5 tempHp = 3 dmg to currentHp
        }),
        mockClient,
      );
    });

    it('applies unconscious condition and resets death saves when dropping to 0 HP', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce({ ...mockActor, currentHp: 5 });
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: {
          ...mockActor,
          currentHp: 0,
          conditions: ['unconscious'],
          deathSaves: { successes: 0, failures: 0 },
          stateVersion: 2,
        },
      });

      const response = await service.execute(baseDamageCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          currentHp: 0,
          conditions: ['unconscious'],
          deathSaves: { successes: 0, failures: 0 },
        }),
        mockClient,
      );
    });

    it('increments death save failure when taking damage at 0 HP', async () => {
      const zeroHpActor = {
        ...mockActor,
        currentHp: 0,
        conditions: ['unconscious'],
        deathSaves: { successes: 0, failures: 1 },
      };
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(zeroHpActor);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: {
          ...zeroHpActor,
          deathSaves: { successes: 0, failures: 2 },
          stateVersion: 2,
        },
      });

      const response = await service.execute(baseDamageCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          currentHp: 0,
          deathSaves: { successes: 0, failures: 2 },
        }),
        mockClient,
      );
    });

    it('marks character dead when reaching 3 death save failures', async () => {
      const dyingActor = {
        ...mockActor,
        currentHp: 0,
        conditions: ['unconscious'],
        deathSaves: { successes: 0, failures: 2 },
      };
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(dyingActor);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: {
          ...dyingActor,
          deathSaves: { successes: 0, failures: 3 },
          conditions: ['unconscious', 'dead'],
          stateVersion: 2,
        },
      });

      const response = await service.execute(baseDamageCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          deathSaves: { successes: 0, failures: 3 },
          conditions: ['unconscious', 'dead'],
        }),
        mockClient,
      );
    });

    it('rejects execution when expectedActorVersion does not match current stateVersion', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce({
        ...mockActor,
        stateVersion: 3, // Contention: actor advanced to version 3
      });

      const response = await service.execute(baseDamageCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(false);
      expect(response.receipt.result.error).toContain('State version mismatch');
      expect(response.receipt.result.committedVersions[mockActor.id]).toBe(3);
      expect(mockDb.campaignActors.updateActorState).not.toHaveBeenCalled();
    });

    it('rejects unauthorized user trying to damage another player actor', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce({
        ...mockActor,
        ownerId: 'different-user',
      });

      await expect(
        service.execute(baseDamageCommand, { principalId: 'unauthorized-user', isDm: false }),
      ).rejects.toThrow('Principal unauthorized-user is not authorized to damage actor');
    });

    it('allows DM to damage any actor', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce({
        ...mockActor,
        ownerId: 'different-user',
      });
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...mockActor, currentHp: 12, stateVersion: 2 },
      });

      const response = await service.execute(baseDamageCommand, {
        principalId: 'dm-user',
        isDm: true,
      });

      expect(response.receipt.result.success).toBe(true);
    });
  });

  describe('HealActor', () => {
    const healCommand: DomainCommand = {
      commandId: '88888888-8888-4888-8888-888888888888',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: { [mockActor.id]: 1 },
      payload: {
        type: 'HealActor',
        targetActorId: mockActor.id,
        amount: 10,
      },
    };

    it('caps healing at maxHp', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce({
        ...mockActor,
        currentHp: 20,
        maxHp: 25,
      });
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...mockActor, currentHp: 25, stateVersion: 2 },
      });

      const response = await service.execute(healCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          currentHp: 25, // 20 + 10 capped at 25
        }),
        mockClient,
      );
    });

    it('removes unconscious and resets death saves when healing from 0 HP', async () => {
      const unconsciousActor = {
        ...mockActor,
        currentHp: 0,
        conditions: ['unconscious'],
        deathSaves: { successes: 1, failures: 2 },
      };
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(unconsciousActor);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: {
          ...mockActor,
          currentHp: 10,
          conditions: [],
          deathSaves: { successes: 0, failures: 0 },
          stateVersion: 2,
        },
      });

      const response = await service.execute(healCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          currentHp: 10,
          conditions: [],
          deathSaves: { successes: 0, failures: 0 },
        }),
        mockClient,
      );
    });
  });

  describe('AdmitCharacter', () => {
    const admitCommand: DomainCommand = {
      commandId: '77777777-7777-4777-8777-777777777777',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'AdmitCharacter',
        characterDefinitionRef: { kind: 'character', id: 'char-123', revision: 1 },
        initialControllerUserIds: ['user-1'],
      },
    };

    it('creates campaign actor when character not yet admitted', async () => {
      mockDb.characters.getCharacterById.mockResolvedValueOnce({
        id: 'char-123',
        name: 'Seoni',
        ownerId: 'user-1',
        data: { maxHp: 18, level: 3, classes: ['Sorcerer'] },
      });
      mockDb.campaignActors.getActorsByCampaign.mockResolvedValueOnce([]);
      mockDb.campaignActors.createActor.mockResolvedValueOnce({
        ...mockActor,
        id: 'new-actor-id',
        name: 'Seoni',
        currentHp: 18,
        maxHp: 18,
      });

      const response = await service.execute(admitCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect((response.receipt.result.data as { name: string }).name).toBe('Seoni');
      expect(mockDb.campaignActors.createActor).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Seoni',
          currentHp: 18,
          maxHp: 18,
          sourceRef: { kind: 'character', id: 'char-123', revision: 1 },
        }),
        undefined,
        mockClient,
      );
    });

    it('returns existing actor without duplicate insert if already admitted', async () => {
      mockDb.characters.getCharacterById.mockResolvedValueOnce({
        id: 'char-123',
        name: 'Seoni',
        ownerId: 'user-1',
      });
      const existingAdmittedActor = {
        ...mockActor,
        sourceRef: { kind: 'character', id: 'char-123' },
      };
      mockDb.campaignActors.getActorsByCampaign.mockResolvedValueOnce([existingAdmittedActor]);

      const response = await service.execute(admitCommand, { principalId: 'user-1' });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.createActor).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency & Deduplication', () => {
    const command: DomainCommand = {
      commandId: '66666666-6666-4666-8666-666666666666',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: { [mockActor.id]: 1 },
      payload: {
        type: 'ApplyDamage',
        targetActorId: mockActor.id,
        amount: 5,
        damageType: 'fire',
      },
    };

    it('returns cached receipt with duplicate: true when identical command is replayed', async () => {
      const cachedReceipt = {
        commandId: command.commandId,
        principalId: 'user-1',
        campaignId: command.campaignId,
        payloadHash: 'c744c82dae72352fa84b80ffbc52fc996d9a98ef2e379dd8a7c20ad4feceadcb',
        committedAt: new Date().toISOString(),
        result: {
          success: true,
          committedVersions: { [mockActor.id]: 2 },
        },
      };

      // Compute actual hash
      const crypto = await import('crypto');
      const actualHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(command.payload))
        .digest('hex');

      cachedReceipt.payloadHash = actualHash;

      mockDb.commandReceipts.getReceipt.mockResolvedValueOnce({
        result: cachedReceipt,
        payloadHash: actualHash,
      });

      const response = await service.execute(command, { principalId: 'user-1' });

      expect(response.duplicate).toBe(true);
      expect(response.receipt).toEqual(cachedReceipt);
      expect(mockDb.withTransaction).not.toHaveBeenCalled();
    });

    it('throws error when commandId is reused with a different payload', async () => {
      mockDb.commandReceipts.getReceipt.mockResolvedValueOnce({
        result: {},
        payloadHash: 'completely-different-hash',
      });

      await expect(
        service.execute(command, { principalId: 'user-1' }),
      ).rejects.toThrow('was already submitted with a different payload');
    });
  });

  describe('DeployEncounter', () => {
    const deployCommand: DomainCommand = {
      commandId: '99999999-9999-4999-8999-999999999999',
      protocolVersion: '1.0',
      campaignId: '22222222-2222-4222-8222-222222222222',
      issuerUserId: 'dm-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'DeployEncounter',
        templateRef: {
          kind: 'encounter',
          id: 'enc-template-1',
          revision: 1,
        },
        sceneId: '33333333-3333-4333-8333-333333333333',
        anchorPosition: { x: 100, y: 200 },
        hiddenFromPlayers: false,
      },
    };

    it('spawns isolated multi-copy monster actors and creates encounter run', async () => {
      mockDb.libraryObjects.getRevision.mockResolvedValueOnce({
        data: {
          groups: [
            {
              id: 'grp-1',
              monsterRef: { kind: 'monster', id: 'm-goblin', revision: 1 },
              count: 2,
              faction: 'hostile',
              customName: 'Goblin',
            },
          ],
        },
      });

      mockDb.libraryObjects.getObjectById.mockResolvedValueOnce({
        id: 'm-goblin',
        currentRevision: 1,
      });

      mockDb.libraryObjects.getRevision.mockResolvedValueOnce({
        data: {
          name: 'Goblin',
          hitPoints: { average: 7 },
          armorClass: [{ value: 15 }],
          speed: { walk: 30 },
        },
      });

      const response = await service.execute(deployCommand, {
        principalId: 'dm-1',
        isDm: true,
      });

      expect(response.receipt.result.success).toBe(true);
      const data = response.receipt.result.data as {
        encounterRunId: string;
        spawnedActorIds: string[];
      };
      expect(data.spawnedActorIds).toHaveLength(2);
      expect(mockDb.campaignActors.createActor).toHaveBeenCalledTimes(2);

      // Verify each copy gets its own isolated name & unique actor record
      expect(mockDb.campaignActors.createActor).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          name: 'Goblin #1',
          currentHp: 7,
          maxHp: 7,
        }),
        expect.any(String),
        mockClient,
      );
      expect(mockDb.campaignActors.createActor).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          name: 'Goblin #2',
          currentHp: 7,
          maxHp: 7,
        }),
        expect.any(String),
        mockClient,
      );

      expect(mockDb.encounterRuns.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'deployed',
          currentRound: 1,
          currentTurnIndex: 0,
        }),
        mockClient,
      );
    });

    it('throws error when non-DM attempts to deploy encounter', async () => {
      await expect(
        service.execute(deployCommand, { principalId: 'player-1', isDm: false }),
      ).rejects.toThrow('Only the Dungeon Master can deploy encounters');
    });
  });

  describe('StartEncounter', () => {
    const startCommand: DomainCommand = {
      commandId: '88888888-8888-4888-8888-888888888888',
      protocolVersion: '1.0',
      campaignId: '22222222-2222-4222-8222-222222222222',
      issuerUserId: 'dm-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'StartEncounter',
        encounterRunId: '44444444-4444-4444-8444-444444444444',
      },
    };

    it('transitions encounter to active and rolls/sorts initiatives', async () => {
      mockDb.encounterRuns.getRunById.mockResolvedValueOnce({
        id: '44444444-4444-4444-8444-444444444444',
        stage: 'deployed',
        participants: [
          { actorId: 'act-1', initiativeRoll: 10 },
          { actorId: 'act-2', initiativeRoll: 18 },
        ],
      });

      const response = await service.execute(startCommand, {
        principalId: 'dm-1',
        isDm: true,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.encounterRuns.updateRun).toHaveBeenCalledWith(
        '44444444-4444-4444-8444-444444444444',
        expect.objectContaining({
          stage: 'active',
          currentRound: 1,
          currentTurnIndex: 0,
          participants: [
            expect.objectContaining({ actorId: 'act-2', initiativeRoll: 18 }),
            expect.objectContaining({ actorId: 'act-1', initiativeRoll: 10 }),
          ],
        }),
        mockClient,
      );
    });

    it('throws error when non-DM attempts to start encounter', async () => {
      await expect(
        service.execute(startCommand, { principalId: 'player-1', isDm: false }),
      ).rejects.toThrow('Only the Dungeon Master can start encounters');
    });
  });

  describe('AdvanceCombatTurn', () => {
    const advanceCommand: DomainCommand = {
      commandId: '77777777-7777-4777-8777-777777777777',
      protocolVersion: '1.0',
      campaignId: '22222222-2222-4222-8222-222222222222',
      issuerUserId: 'dm-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'AdvanceCombatTurn',
        encounterRunId: '44444444-4444-4444-8444-444444444444',
      },
    };

    it('advances turn index within same round', async () => {
      mockDb.encounterRuns.getRunById.mockResolvedValueOnce({
        id: '44444444-4444-4444-8444-444444444444',
        stage: 'active',
        currentRound: 1,
        currentTurnIndex: 0,
        participants: [
          { actorId: 'act-1', reactionUsed: true },
          { actorId: 'act-2', reactionUsed: true },
        ],
      });

      const response = await service.execute(advanceCommand, {
        principalId: 'dm-1',
        isDm: true,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.encounterRuns.updateRun).toHaveBeenCalledWith(
        '44444444-4444-4444-8444-444444444444',
        expect.objectContaining({
          currentRound: 1,
          currentTurnIndex: 1,
        }),
        mockClient,
      );
    });

    it('increments round and wraps turn index to 0 at end of initiative order', async () => {
      mockDb.encounterRuns.getRunById.mockResolvedValueOnce({
        id: '44444444-4444-4444-8444-444444444444',
        stage: 'active',
        currentRound: 1,
        currentTurnIndex: 1,
        participants: [
          { actorId: 'act-1', reactionUsed: true },
          { actorId: 'act-2', reactionUsed: true },
        ],
      });

      const response = await service.execute(advanceCommand, {
        principalId: 'dm-1',
        isDm: true,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.encounterRuns.updateRun).toHaveBeenCalledWith(
        '44444444-4444-4444-8444-444444444444',
        expect.objectContaining({
          currentRound: 2,
          currentTurnIndex: 0,
        }),
        mockClient,
      );
    });

    it('throws error when encounter is not active', async () => {
      mockDb.encounterRuns.getRunById.mockResolvedValueOnce({
        id: '44444444-4444-4444-8444-444444444444',
        stage: 'completed',
        currentRound: 3,
        currentTurnIndex: 0,
        participants: [],
      });

      await expect(
        service.execute(advanceCommand, { principalId: 'dm-1', isDm: true }),
      ).rejects.toThrow('Encounter run is not active');
    });
  });

  describe('ApplyPreparationPlan', () => {
    const actorWithProfiles = {
      ...mockActor,
      spellcastingProfiles: [
        {
          profileId: 'prof-1',
          name: 'Wizard Casting',
          sourceType: 'class' as const,
          sourceSlug: 'wizard',
          spellcastingAbility: 'INT' as const,
          spellSaveDC: 15,
          spellAttackBonus: 7,
          isRitualCaster: true,
          preparationMode: 'prepared' as const,
          preparationLimit: 3,
          resourcePoolId: 'slots',
          boundCollectionIds: [],
          knownSpellSlugs: ['fire-bolt', 'shield', 'magic-missile', 'sleep'],
          preparedSpellSlugs: ['shield'],
        },
      ],
    };

    const prepCommand: DomainCommand = {
      commandId: '88888888-8888-4888-8888-888888888888',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: { [mockActor.id]: 1 },
      payload: {
        type: 'ApplyPreparationPlan',
        targetActorId: mockActor.id,
        profileId: 'prof-1',
        preparedSpellSlugs: ['shield', 'magic-missile'],
      },
    };

    it('successfully applies a valid preparation plan within limit', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(actorWithProfiles);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...actorWithProfiles, stateVersion: 2 },
      });

      const response = await service.execute(prepCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          expectedVersion: 1,
          spellcastingProfiles: [
            expect.objectContaining({
              profileId: 'prof-1',
              preparedSpellSlugs: ['shield', 'magic-missile'],
            }),
          ],
        }),
        mockClient,
      );
    });

    it('rejects when caller is unauthorized', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(actorWithProfiles);

      await expect(
        service.execute(prepCommand, { principalId: 'rogue-user', isDm: false }),
      ).rejects.toThrow('Principal rogue-user is not authorized to prepare spells');
    });

    it('rejects when target profile does not exist', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(actorWithProfiles);

      const invalidProfCommand = {
        ...prepCommand,
        payload: {
          ...prepCommand.payload,
          profileId: 'nonexistent-prof',
        },
      };

      await expect(
        service.execute(invalidProfCommand, { principalId: 'user-1', isDm: false }),
      ).rejects.toThrow("Spellcasting profile 'nonexistent-prof' not found");
    });

    it('returns failure receipt when prepared spells exceed limit', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(actorWithProfiles);

      const exceedCommand = {
        ...prepCommand,
        payload: {
          ...prepCommand.payload,
          preparedSpellSlugs: ['fire-bolt', 'shield', 'magic-missile', 'sleep'], // 4 > limit of 3
        },
      };

      const response = await service.execute(exceedCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(false);
      expect(response.receipt.result.error).toContain('Plan exceeds preparation capacity');
    });
  });

  describe('CastSpell', () => {
    const actorCaster = {
      ...mockActor,
      spellcastingProfiles: [
        {
          profileId: 'prof-1',
          name: 'Wizard Casting',
          sourceType: 'class' as const,
          sourceSlug: 'wizard',
          spellcastingAbility: 'INT' as const,
          spellSaveDC: 15,
          spellAttackBonus: 7,
          isRitualCaster: true,
          preparationMode: 'prepared' as const,
          preparationLimit: 4,
          resourcePoolId: 'pool-slots',
          boundCollectionIds: [],
          knownSpellSlugs: ['shield', 'hold-person'],
          preparedSpellSlugs: ['shield', 'hold-person'],
        },
      ],
      resourcePools: {
        'pool-slots': {
          id: 'pool-slots',
          name: 'Spell Slots',
          poolType: 'slots' as const,
          current: 4,
          max: 4,
          slots: {
            '1': { current: 2, max: 4 },
          },
          slotsByLevel: {
            1: { current: 2, max: 4 },
          },
          resetOn: 'long-rest' as const,
        },
      },
      concentration: null,
    };

    const castCommand: DomainCommand = {
      commandId: '77777777-7777-4777-8777-777777777777',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: { [mockActor.id]: 1 },
      payload: {
        type: 'CastSpell',
        actorId: mockActor.id,
        spellRef: {
          kind: 'spell' as const,
          id: '55555555-5555-4555-8555-555555555555',
          revision: 1,
        },
        profileId: 'prof-1',
        castAtLevel: 1,
        targetActorIds: [],
      },
    };

    it('successfully consumes slot and records cast', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(actorCaster);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...actorCaster, stateVersion: 2 },
      });
      mockDb.libraryObjects.getRevision.mockResolvedValueOnce({
        id: '55555555-5555-4555-8555-555555555555',
        revision: 1,
        data: {
          id: '55555555-5555-4555-8555-555555555555',
          kind: 'spell',
          ruleset: { system: 'dnd5e', edition: '2024' },
          slug: 'shield',
          name: 'Shield',
          level: 1,
          school: 'abjuration',
          castingTime: '1 reaction',
          range: 'Self',
          duration: '1 round',
          concentration: false,
          ritual: false,
          components: { verbal: true, somatic: true, material: false, materialConsumed: false },
          classes: [],
          description: 'Shield spell',
          ownerId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          schemaVersion: 1,
          revision: 1,
          tags: [],
          archived: false,
        },
      });

      const response = await service.execute(castCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          expectedVersion: 1,
          resourcePools: expect.objectContaining({
            'pool-slots': expect.objectContaining({
              slots: expect.objectContaining({
                '1': { current: 1, max: 4 },
              }),
            }),
          }),
        }),
        mockClient,
      );
    });

    it('handles concentration and replaces existing concentration', async () => {
      const concentratingActor = {
        ...actorCaster,
        payload: {
          concentration: {
            spellSlug: 'bless',
            castId: 'old-cast-id',
            concentrationStartedAt: new Date().toISOString(),
          },
        },
      };

      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(concentratingActor);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...concentratingActor, stateVersion: 2 },
      });
      mockDb.libraryObjects.getRevision.mockResolvedValueOnce({
        id: '55555555-5555-4555-8555-555555555555',
        revision: 1,
        data: {
          id: '55555555-5555-4555-8555-555555555555',
          kind: 'spell',
          ruleset: { system: 'dnd5e', edition: '2024' },
          slug: 'hold-person',
          name: 'Hold Person',
          level: 1,
          school: 'enchantment',
          castingTime: '1 action',
          range: '60 feet',
          duration: '1 minute',
          concentration: true,
          ritual: false,
          components: { verbal: true, somatic: true, material: false, materialConsumed: false },
          classes: [],
          description: 'Hold Person spell',
          ownerId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          schemaVersion: 1,
          revision: 1,
          tags: [],
          archived: false,
        },
      });

      const response = await service.execute(castCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          expectedVersion: 1,
          payload: expect.objectContaining({
            concentration: expect.objectContaining({
              spellName: 'Hold Person',
            }),
          }),
        }),
        mockClient,
      );
    });

    it('returns failure receipt when casting a leveled spell with no slots left', async () => {
      const outOfSlotsActor = {
        ...actorCaster,
        resourcePools: {
          'pool-slots': {
            id: 'pool-slots',
            name: 'Spell Slots',
            poolType: 'slots' as const,
            current: 0,
            max: 4,
            slots: {
              '1': { current: 0, max: 4 },
            },
            resetOn: 'long-rest' as const,
          },
        },
      };

      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(outOfSlotsActor);
      mockDb.libraryObjects.getRevision.mockResolvedValueOnce({
        id: '55555555-5555-4555-8555-555555555555',
        revision: 1,
        data: {
          id: '55555555-5555-4555-8555-555555555555',
          kind: 'spell',
          ruleset: { system: 'dnd5e', edition: '2024' },
          slug: 'shield',
          name: 'Shield',
          level: 1,
          school: 'abjuration',
          castingTime: '1 reaction',
          range: 'Self',
          duration: '1 round',
          concentration: false,
          ritual: false,
          components: { verbal: true, somatic: true, material: false, materialConsumed: false },
          classes: [],
          description: 'Shield spell',
          ownerId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          schemaVersion: 1,
          revision: 1,
          tags: [],
          archived: false,
        },
      });

      const response = await service.execute(castCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(false);
      expect(response.receipt.result.error).toContain('No level 1 spell slots remaining');
    });
  });

  describe('EndConcentration', () => {
    const concentratingActor = {
      ...mockActor,
      payload: {
        concentration: {
          spellSlug: 'haste',
          castId: 'active-cast-uuid',
          concentrationStartedAt: new Date().toISOString(),
        },
      },
    };

    const endConcCommand: DomainCommand = {
      commandId: '66666666-6666-4666-8666-666666666666',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: { [mockActor.id]: 1 },
      payload: {
        type: 'EndConcentration',
        actorId: mockActor.id,
        castId: 'active-cast-uuid',
      },
    };

    it('clears active concentration on actor', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(concentratingActor);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...concentratingActor, stateVersion: 2 },
      });

      const response = await service.execute(endConcCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          expectedVersion: 1,
          payload: expect.objectContaining({
            concentration: null,
          }),
        }),
        mockClient,
      );
    });
  });

  describe('RestActor', () => {
    const restedActor = {
      ...mockActor,
      currentHp: 10,
      maxHp: 25,
      tempHp: 5,
      conditions: ['unconscious'],
      deathSaves: { successes: 1, failures: 2 },
      resourcePools: {
        'pool-pact': {
          current: 0,
          max: 2,
          resetOn: 'short-rest' as const,
        },
        'pool-long': {
          current: 1,
          max: 4,
          resetOn: 'long-rest' as const,
        },
      },
    };

    it('performs short rest: resets short-rest pools and applies hit dice healing', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(restedActor);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...restedActor, stateVersion: 2 },
      });

      const shortRestCommand: DomainCommand = {
        commandId: '55555555-5555-4555-8555-555555555555',
        protocolVersion: '1.0',
        campaignId: mockActor.campaignId,
        issuerUserId: 'user-1',
        timestamp: new Date().toISOString(),
        expectedActorVersions: { [mockActor.id]: 1 },
        payload: {
          type: 'RestActor',
          actorId: mockActor.id,
          restType: 'short',
          hitDiceToSpend: 1,
        },
      };

      const response = await service.execute(shortRestCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          expectedVersion: 1,
          currentHp: 16, // 10 + 6
          resourcePools: expect.objectContaining({
            'pool-pact': expect.objectContaining({ current: 2 }),
            'pool-long': expect.objectContaining({ current: 1 }), // unchanged
          }),
        }),
        mockClient,
      );
    });

    it('performs long rest: full heal, clears temp HP/unconscious/death saves, restores all pools', async () => {
      mockDb.campaignActors.lockActorForUpdate.mockResolvedValueOnce(restedActor);
      mockDb.campaignActors.updateActorState.mockResolvedValueOnce({
        status: 'updated',
        actor: { ...restedActor, stateVersion: 2 },
      });

      const longRestCommand: DomainCommand = {
        commandId: '44444444-4444-4444-8444-444444444444',
        protocolVersion: '1.0',
        campaignId: mockActor.campaignId,
        issuerUserId: 'user-1',
        timestamp: new Date().toISOString(),
        expectedActorVersions: { [mockActor.id]: 1 },
        payload: {
          type: 'RestActor',
          actorId: mockActor.id,
          restType: 'long',
          hitDiceToSpend: 0,
        },
      };

      const response = await service.execute(longRestCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(true);
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        mockActor.id,
        expect.objectContaining({
          expectedVersion: 1,
          currentHp: 25,
          tempHp: 0,
          conditions: [],
          deathSaves: { successes: 0, failures: 0 },
          resourcePools: expect.objectContaining({
            'pool-pact': expect.objectContaining({ current: 2 }),
            'pool-long': expect.objectContaining({ current: 4 }),
          }),
        }),
        mockClient,
      );
    });
  });

  describe('TransferItem', () => {
    const actorSource = {
      ...mockActor,
      id: '11111111-1111-4111-8111-111111111111',
      inventory: [
        {
          instanceId: 'item-wand',
          name: 'Wand of Magic Missiles',
          quantity: 2,
          isEquipped: false,
          isAttuned: false,
          itemRef: {
            kind: 'item' as const,
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            revision: 1,
          },
        },
      ],
    };

    const actorTarget = {
      ...mockActor,
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Valeros',
      ownerId: 'user-2',
      inventory: [],
    };

    const transferCommand: DomainCommand = {
      commandId: '33333333-3333-4333-8333-333333333333',
      protocolVersion: '1.0',
      campaignId: mockActor.campaignId,
      issuerUserId: 'user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: {},
      payload: {
        type: 'TransferItem',
        sourceActorId: actorSource.id,
        targetActorId: actorTarget.id,
        itemInstanceId: 'item-wand',
        quantity: 1,
      },
    };

    it('transfers item instance between source and target actors', async () => {
      mockDb.campaignActors.lockActorForUpdate
        .mockResolvedValueOnce(actorSource)
        .mockResolvedValueOnce(actorTarget);

      mockDb.campaignActors.updateActorState.mockResolvedValue({
        status: 'updated',
        actor: { ...actorSource, stateVersion: 2 },
      });

      const response = await service.execute(transferCommand, {
        principalId: 'user-1',
        isDm: false,
      });

      expect(response.receipt.result.success).toBe(true);
      // Source item quantity decremented from 2 to 1
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        actorSource.id,
        expect.objectContaining({
          expectedVersion: 1,
          inventory: [
            expect.objectContaining({
              instanceId: 'item-wand',
              quantity: 1,
            }),
          ],
        }),
        mockClient,
      );

      // Target received item
      expect(mockDb.campaignActors.updateActorState).toHaveBeenCalledWith(
        actorTarget.id,
        expect.objectContaining({
          expectedVersion: 1,
          inventory: [
            expect.objectContaining({
              name: 'Wand of Magic Missiles',
              quantity: 1,
            }),
          ],
        }),
        mockClient,
      );
    });

    it('rejects transfer when item not found in source inventory', async () => {
      mockDb.campaignActors.lockActorForUpdate
        .mockResolvedValueOnce({ ...actorSource, inventory: [] })
        .mockResolvedValueOnce(actorTarget);

      await expect(
        service.execute(transferCommand, { principalId: 'user-1', isDm: false }),
      ).rejects.toThrow(`Item instance item-wand not found in actor ${actorSource.id}'s inventory`);
    });

    it('rejects transfer when requested quantity exceeds available', async () => {
      mockDb.campaignActors.lockActorForUpdate
        .mockResolvedValueOnce(actorSource)
        .mockResolvedValueOnce(actorTarget);

      const highQtyCommand = {
        ...transferCommand,
        payload: {
          ...transferCommand.payload,
          quantity: 10,
        },
      };

      await expect(
        service.execute(highQtyCommand, { principalId: 'user-1', isDm: false }),
      ).rejects.toThrow('Insufficient item quantity to transfer');
    });
  });
});

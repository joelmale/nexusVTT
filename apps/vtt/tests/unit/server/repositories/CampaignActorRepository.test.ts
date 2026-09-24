import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, QueryResult, type PoolClient } from 'pg';
import { CampaignActorRepository } from '../../../../server/repositories/CampaignActorRepository.js';

describe('CampaignActorRepository', () => {
  let pool: { query: ReturnType<typeof vi.fn> };
  let repository: CampaignActorRepository;

  const mockActorRow = {
    id: '11111111-1111-4111-8111-111111111111',
    campaignId: '22222222-2222-4222-8222-222222222222',
    sourceRef: { kind: 'character', id: 'char-1', revision: 1 },
    ownerId: 'user-1',
    name: 'Valeros',
    ruleset: { system: 'dnd5e', edition: '2024' },
    stateVersion: '3',
    currentHp: 25,
    maxHp: 30,
    tempHp: 5,
    conditions: ['poisoned'],
    deathSaves: { successes: 1, failures: 0 },
    resourcePools: { 'slot:1': { current: 3, max: 4 } },
    spellcastingProfiles: [{ id: 'fighter-profile' }],
    inventory: [{ id: 'sword-1' }],
    activeSessionId: '33333333-3333-4333-8333-333333333333',
    payload: { kind: 'character', characterId: 'char-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    pool = {
      query: vi.fn(),
    };
    repository = new CampaignActorRepository(pool as unknown as Pool);
  });

  describe('getActorById', () => {
    it('returns normalized actor record when found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockActorRow] } as QueryResult);

      const actor = await repository.getActorById(mockActorRow.id);

      expect(actor).not.toBeNull();
      expect(actor?.id).toBe(mockActorRow.id);
      expect(actor?.stateVersion).toBe(3); // parsed string to number
      expect(actor?.conditions).toEqual(['poisoned']);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM campaign_actors WHERE id = $1',
        [mockActorRow.id],
      );
    });

    it('returns null when actor not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] } as unknown as QueryResult);

      const actor = await repository.getActorById('missing-actor');
      expect(actor).toBeNull();
    });
  });

  describe('lockActorForUpdate', () => {
    it('executes SELECT FOR UPDATE on client', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [mockActorRow] }),
      };

      const actor = await repository.lockActorForUpdate(
        mockActorRow.id,
        mockClient as unknown as PoolClient,
      );

      expect(actor?.id).toBe(mockActorRow.id);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM campaign_actors WHERE id = $1 FOR UPDATE',
        [mockActorRow.id],
      );
    });
  });

  describe('getActorsByCampaign & getActorsBySession', () => {
    it('returns list of campaign actors', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockActorRow] } as QueryResult);

      const actors = await repository.getActorsByCampaign(mockActorRow.campaignId);
      expect(actors).toHaveLength(1);
      expect(actors[0].name).toBe('Valeros');
    });

    it('returns list of session actors', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockActorRow] } as QueryResult);

      const actors = await repository.getActorsBySession(mockActorRow.activeSessionId!);
      expect(actors).toHaveLength(1);
    });
  });

  describe('createActor', () => {
    it('inserts new actor and returns normalized record', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockActorRow] } as QueryResult);

      const created = await repository.createActor({
        campaignId: mockActorRow.campaignId,
        sourceRef: mockActorRow.sourceRef,
        ownerId: mockActorRow.ownerId,
        name: mockActorRow.name,
        ruleset: mockActorRow.ruleset,
        currentHp: mockActorRow.currentHp,
        maxHp: mockActorRow.maxHp,
        tempHp: mockActorRow.tempHp,
        conditions: mockActorRow.conditions,
        deathSaves: mockActorRow.deathSaves,
        resourcePools: mockActorRow.resourcePools,
        spellcastingProfiles: mockActorRow.spellcastingProfiles,
        inventory: mockActorRow.inventory,
        activeSessionId: mockActorRow.activeSessionId,
        payload: mockActorRow.payload,
      });

      expect(created.name).toBe('Valeros');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO campaign_actors'),
        expect.any(Array),
      );
    });

    it('supports custom ID insertion', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockActorRow] } as QueryResult);

      const created = await repository.createActor(
        {
          campaignId: mockActorRow.campaignId,
          sourceRef: mockActorRow.sourceRef,
          ownerId: mockActorRow.ownerId,
          name: mockActorRow.name,
          ruleset: mockActorRow.ruleset,
          currentHp: mockActorRow.currentHp,
          maxHp: mockActorRow.maxHp,
          tempHp: mockActorRow.tempHp,
          conditions: [],
          deathSaves: { successes: 0, failures: 0 },
          resourcePools: {},
          spellcastingProfiles: [],
          inventory: [],
          activeSessionId: null,
          payload: mockActorRow.payload,
        },
        'custom-actor-id',
      );

      expect(created.name).toBe('Valeros');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1, "campaignId"'),
        expect.arrayContaining(['custom-actor-id']),
      );
    });
  });

  describe('updateActorState', () => {
    it('returns updated status on successful CAS stateVersion match', async () => {
      const updatedRow = { ...mockActorRow, stateVersion: '4', currentHp: 20 };
      pool.query.mockResolvedValueOnce({ rows: [updatedRow] } as QueryResult);

      const result = await repository.updateActorState(mockActorRow.id, {
        expectedVersion: 3,
        currentHp: 20,
      });

      expect(result.status).toBe('updated');
      if (result.status === 'updated') {
        expect(result.actor.stateVersion).toBe(4);
        expect(result.actor.currentHp).toBe(20);
      }
    });

    it('updates all optional actor fields in query clauses', async () => {
      const updatedRow = { ...mockActorRow, stateVersion: '4' };
      pool.query.mockResolvedValueOnce({ rows: [updatedRow] } as QueryResult);

      const result = await repository.updateActorState(mockActorRow.id, {
        expectedVersion: 3,
        currentHp: 25,
        maxHp: 30,
        tempHp: 5,
        conditions: ['poisoned'],
        deathSaves: { successes: 1, failures: 0 },
        resourcePools: { rage: { current: 2, max: 3 } },
        spellcastingProfiles: [],
        inventory: [{ id: 'item-1', name: 'Potion', quantity: 2 }],
        activeSessionId: 'session-2',
        payload: { extra: true },
      });

      expect(result.status).toBe('updated');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /UPDATE campaign_actors.*"maxHp" = \$4.*"tempHp" = \$5.*"resourcePools" = \$8::jsonb/s,
        ),
        expect.any(Array),
      );
    });

    it('returns conflict status when expectedVersion does not match', async () => {
      // 1. CAS update returns 0 rows
      pool.query.mockResolvedValueOnce({ rows: [] } as unknown as QueryResult);
      // 2. Select current returns existing row
      pool.query.mockResolvedValueOnce({ rows: [mockActorRow] } as QueryResult);

      const result = await repository.updateActorState(mockActorRow.id, {
        expectedVersion: 1, // Stale version
        currentHp: 20,
      });

      expect(result.status).toBe('conflict');
      if (result.status === 'conflict') {
        expect(result.currentActor.stateVersion).toBe(3);
      }
    });

    it('throws error when updating non-existent actor', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] } as unknown as QueryResult);
      pool.query.mockResolvedValueOnce({ rows: [] } as unknown as QueryResult);

      await expect(
        repository.updateActorState('missing-id', {
          expectedVersion: 1,
        }),
      ).rejects.toThrow('Cannot update non-existent CampaignActor: missing-id');
    });
  });

  describe('deleteActor', () => {
    it('deletes actor and returns true when row affected', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult);
      const success = await repository.deleteActor(mockActorRow.id);
      expect(success).toBe(true);
    });

    it('returns false when no row affected', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0 } as QueryResult);
      const success = await repository.deleteActor('missing-id');
      expect(success).toBe(false);
    });
  });
});

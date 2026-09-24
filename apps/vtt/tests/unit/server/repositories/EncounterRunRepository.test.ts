import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { EncounterRunRepository } from '../../../../server/repositories/EncounterRunRepository';
import type { EncounterRunRecord } from '../../../../server/repositories/base';

describe('EncounterRunRepository', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let repository: EncounterRunRepository;

  const mockRun: EncounterRunRecord = {
    id: 'run-101',
    campaignId: 'camp-1',
    templateRef: { kind: 'encounter', id: 'enc-template-1' },
    stage: 'deployed',
    deploymentCommandId: 'cmd-deploy-1',
    activeSessionId: 'sess-1',
    currentRound: 1,
    currentTurnIndex: 0,
    activeWaveIndex: 0,
    participants: [{ actorId: 'act-goblin-1', initiativeRoll: 12 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
    repository = new EncounterRunRepository(mockPool as unknown as Pool);
  });

  describe('getRunById', () => {
    it('returns encounter run record when found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.getRunById('run-101');
      expect(result).toEqual(mockRun);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM encounter_runs WHERE id = $1',
        ['run-101'],
      );
    });

    it('returns null when run not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getRunById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createRun', () => {
    it('creates run with default parameters and generated ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.createRun({
        campaignId: 'camp-1',
        templateRef: { kind: 'encounter', id: 'enc-template-1' },
        deploymentCommandId: 'cmd-deploy-1',
      });

      expect(result).toEqual(mockRun);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO encounter_runs'),
        expect.arrayContaining(['camp-1', 'cmd-deploy-1']),
      );
    });

    it('creates run with specified custom ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.createRun({
        id: 'run-custom-1',
        campaignId: 'camp-1',
        templateRef: { kind: 'encounter', id: 'enc-template-1' },
        deploymentCommandId: 'cmd-deploy-1',
        stage: 'deployed',
      });

      expect(result).toEqual(mockRun);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO encounter_runs ($1,'),
        expect.arrayContaining(['run-custom-1', 'camp-1']),
      );
    });
  });

  describe('updateRun', () => {
    it('updates specified fields on encounter run', async () => {
      const updated = { ...mockRun, stage: 'active' as const, currentRound: 2, currentTurnIndex: 1 };
      mockPool.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await repository.updateRun('run-101', {
        stage: 'active',
        currentRound: 2,
        currentTurnIndex: 1,
        activeWaveIndex: 1,
        activeSessionId: 'sess-2',
        participants: [{ actorId: 'act-1', initiativeRoll: 18 }],
      });

      expect(result).toEqual(updated);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE encounter_runs'),
        expect.arrayContaining(['run-101', 'active', 2, 1, 1, 'sess-2']),
      );
    });

    it('returns null if run does not exist to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.updateRun('nonexistent', { stage: 'completed' });
      expect(result).toBeNull();
    });
  });

  describe('listRunsByCampaign', () => {
    it('returns all encounter runs for a given campaign', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockRun] });

      const result = await repository.listRunsByCampaign('camp-1');
      expect(result).toEqual([mockRun]);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM encounter_runs WHERE "campaignId" = $1 ORDER BY "createdAt" DESC',
        ['camp-1'],
      );
    });
  });
});

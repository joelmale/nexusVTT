import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, QueryResult } from 'pg';
import { CampaignRepository } from '../../../../server/repositories/CampaignRepository.js';
import type { CampaignRecord } from '../../../../server/repositories/base.js';

describe('CampaignRepository', () => {
  let pool: { query: ReturnType<typeof vi.fn> };
  let repository: CampaignRepository;

  beforeEach(() => {
    pool = {
      query: vi.fn(),
    };
    repository = new CampaignRepository(pool as unknown as Pool);
  });

  describe('createCampaign', () => {
    it('creates a campaign and returns the created record', async () => {
      const mockRecord: CampaignRecord = {
        id: 'camp-123',
        name: 'Curse of Strahd',
        description: 'Gothic horror',
        dmId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      pool.query.mockResolvedValueOnce({ rows: [mockRecord] } as QueryResult);

      const result = await repository.createCampaign(
        'user-1',
        'Curse of Strahd',
        'Gothic horror',
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO campaigns'),
        ['Curse of Strahd', 'Gothic horror', 'user-1'],
      );
      expect(result).toEqual(mockRecord);
    });

    it('handles omitted description gracefully by passing null', async () => {
      const mockRecord: CampaignRecord = {
        id: 'camp-124',
        name: 'Lost Mine of Phandelver',
        dmId: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      pool.query.mockResolvedValueOnce({ rows: [mockRecord] } as QueryResult);

      const result = await repository.createCampaign('user-2', 'Lost Mine of Phandelver');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO campaigns'),
        ['Lost Mine of Phandelver', null, 'user-2'],
      );
      expect(result).toEqual(mockRecord);
    });
  });

  describe('getCampaignsByUser', () => {
    it('fetches all campaigns owned by a user', async () => {
      const mockCampaigns = [{ id: 'camp-1', name: 'Campaign 1' }];
      pool.query.mockResolvedValueOnce({ rows: mockCampaigns } as QueryResult);

      const result = await repository.getCampaignsByUser('user-1');

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM campaigns WHERE "dmId" = $1 ORDER BY "createdAt" DESC',
        ['user-1'],
      );
      expect(result).toEqual(mockCampaigns);
    });
  });

  describe('getCampaignById', () => {
    it('returns the campaign record when found', async () => {
      const mockCampaign = { id: 'camp-1', name: 'Found Campaign' };
      pool.query.mockResolvedValueOnce({ rows: [mockCampaign] } as QueryResult);

      const result = await repository.getCampaignById('camp-1');
      expect(result).toEqual(mockCampaign);
    });

    it('returns null when campaign is not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] } as QueryResult);

      const result = await repository.getCampaignById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('isUserAuthorizedForCampaign', () => {
    it('returns false if the campaign does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] } as QueryResult); // getCampaignById

      const isAuth = await repository.isUserAuthorizedForCampaign('user-1', 'camp-missing');
      expect(isAuth).toBe(false);
    });

    it('returns true immediately if the user is the DM', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'camp-1', dmId: 'dm-user-id' }],
      } as QueryResult); // getCampaignById

      const isAuth = await repository.isUserAuthorizedForCampaign('dm-user-id', 'camp-1');
      expect(isAuth).toBe(true);
      expect(pool.query).toHaveBeenCalledTimes(1); // No secondary query needed
    });

    it('returns true if the user is authorized via sessions/players/hosts', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'camp-1', dmId: 'other-dm' }],
        } as QueryResult) // getCampaignById
        .mockResolvedValueOnce({ rowCount: 1 } as QueryResult); // session auth query

      const isAuth = await repository.isUserAuthorizedForCampaign('player-1', 'camp-1');
      expect(isAuth).toBe(true);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('returns false if the user is not found in sessions/players/hosts', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'camp-1', dmId: 'other-dm' }],
        } as QueryResult)
        .mockResolvedValueOnce({ rowCount: 0 } as QueryResult);

      const isAuth = await repository.isUserAuthorizedForCampaign('random-user', 'camp-1');
      expect(isAuth).toBe(false);
    });

    it('returns false if a database error is thrown during authorization check', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB connection lost'));

      const isAuth = await repository.isUserAuthorizedForCampaign('user-1', 'camp-1');
      expect(isAuth).toBe(false);
    });
  });

  describe('updateCampaign', () => {
    it('updates allowed fields and serializes scenes', async () => {
      pool.query.mockResolvedValueOnce({} as QueryResult);

      await repository.updateCampaign('camp-1', {
        name: 'New Name',
        scenes: [{ id: 'scene-1' }],
        lastRoomCode: 'XYZW',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE campaigns SET.*"name" = \$1.*"scenes" = \$2.*"lastRoomCode" = \$3.*WHERE id = \$4/),
        ['New Name', JSON.stringify([{ id: 'scene-1' }]), 'XYZW', 'camp-1'],
      );
    });

    it('does not run query if no allowed fields are present', async () => {
      // @ts-expect-error testing unexpected keys
      await repository.updateCampaign('camp-1', { nonExistent: 'val' });
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('deleteCampaign', () => {
    it('executes delete query with campaign id', async () => {
      pool.query.mockResolvedValueOnce({} as QueryResult);

      await repository.deleteCampaign('camp-1');

      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM campaigns WHERE id = $1',
        ['camp-1'],
      );
    });
  });

  describe('saveCampaignScenes & getCampaignScenes', () => {
    it('saves scenes serialized to JSON', async () => {
      pool.query.mockResolvedValueOnce({} as QueryResult);
      const scenes = [{ id: 's1', name: 'Dungeon' }];

      await repository.saveCampaignScenes('camp-1', scenes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaigns SET scenes = $1'),
        [JSON.stringify(scenes), 'camp-1'],
      );
    });

    it('returns scenes array if valid', async () => {
      const scenes = [{ id: 's1', name: 'Dungeon' }];
      pool.query.mockResolvedValueOnce({
        rows: [{ scenes }],
      } as QueryResult);

      const result = await repository.getCampaignScenes('camp-1');
      expect(result).toEqual(scenes);
    });

    it('returns empty array if campaign not found or scenes is not an array', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] } as QueryResult);
      expect(await repository.getCampaignScenes('camp-1')).toEqual([]);

      pool.query.mockResolvedValueOnce({
        rows: [{ scenes: 'not an array' }],
      } as QueryResult);
      expect(await repository.getCampaignScenes('camp-1')).toEqual([]);
    });
  });
});

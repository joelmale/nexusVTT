import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, QueryResult } from 'pg';
import { CharacterRepository } from '../../../../server/repositories/CharacterRepository.js';
import type { CharacterRecord } from '../../../../server/repositories/base.js';

describe('CharacterRepository', () => {
  let pool: { query: ReturnType<typeof vi.fn> };
  let repository: CharacterRepository;

  beforeEach(() => {
    pool = {
      query: vi.fn(),
    };
    repository = new CharacterRepository(pool as unknown as Pool);
  });

  describe('createCharacter', () => {
    it('creates a character and stringifies data', async () => {
      const mockRecord: CharacterRecord = {
        id: 'char-1',
        name: 'Gandalf',
        ownerId: 'user-1',
        data: { class: 'Wizard', level: 20 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      pool.query.mockResolvedValueOnce({ rows: [mockRecord] } as QueryResult);

      const result = await repository.createCharacter('user-1', 'Gandalf', {
        class: 'Wizard',
        level: 20,
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO characters'),
        ['Gandalf', 'user-1', JSON.stringify({ class: 'Wizard', level: 20 })],
      );
      expect(result).toEqual(mockRecord);
    });

    it('defaults data to empty object if not provided', async () => {
      const mockRecord: CharacterRecord = {
        id: 'char-2',
        name: 'Fighter',
        ownerId: 'user-2',
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      pool.query.mockResolvedValueOnce({ rows: [mockRecord] } as QueryResult);

      const result = await repository.createCharacter('user-2', 'Fighter');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO characters'),
        ['Fighter', 'user-2', '{}'],
      );
      expect(result).toEqual(mockRecord);
    });
  });

  describe('getCharactersByUser', () => {
    it('fetches characters for a specific owner', async () => {
      const mockCharacters = [{ id: 'c-1', name: 'Rogue' }];
      pool.query.mockResolvedValueOnce({ rows: mockCharacters } as QueryResult);

      const result = await repository.getCharactersByUser('user-1');
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM characters WHERE "ownerId" = $1 ORDER BY "createdAt" DESC',
        ['user-1'],
      );
      expect(result).toEqual(mockCharacters);
    });
  });

  describe('getCharacterById', () => {
    it('returns character record when found', async () => {
      const mockCharacter = { id: 'c-1', name: 'Cleric' };
      pool.query.mockResolvedValueOnce({ rows: [mockCharacter] } as QueryResult);

      const result = await repository.getCharacterById('c-1');
      expect(result).toEqual(mockCharacter);
    });

    it('returns null when character not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] } as unknown as QueryResult);

      const result = await repository.getCharacterById('c-missing');
      expect(result).toBeNull();
    });
  });

  describe('updateCharacter', () => {
    it('updates allowed fields name and data', async () => {
      pool.query.mockResolvedValueOnce({} as QueryResult);

      await repository.updateCharacter('c-1', {
        name: 'New Hero Name',
        data: { hp: 42 },
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE characters SET.*"name" = \$1.*"data" = \$2.*WHERE id = \$3/),
        ['New Hero Name', JSON.stringify({ hp: 42 }), 'c-1'],
      );
    });

    it('ignores unallowed update keys and does not run query when empty', async () => {
      // @ts-expect-error testing invalid key
      await repository.updateCharacter('c-1', { unknownProp: 'val' });
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('deleteCharacter', () => {
    it('deletes a single character by id', async () => {
      pool.query.mockResolvedValueOnce({} as QueryResult);

      await repository.deleteCharacter('c-1');
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM characters WHERE id = $1',
        ['c-1'],
      );
    });
  });

  describe('deleteCharactersByUser', () => {
    it('deletes characters for an owner and returns deleted count', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 3 } as QueryResult);

      const count = await repository.deleteCharactersByUser('user-1');
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM characters WHERE "ownerId" = $1',
        ['user-1'],
      );
      expect(count).toBe(3);
    });

    it('returns 0 if rowCount is null', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: null } as unknown as QueryResult);

      const count = await repository.deleteCharactersByUser('user-1');
      expect(count).toBe(0);
    });
  });

  describe('deleteCharactersByIds', () => {
    it('returns 0 immediately if ids array is empty', async () => {
      const count = await repository.deleteCharactersByIds([]);
      expect(count).toBe(0);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('deletes multiple characters using ANY array syntax', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 2 } as QueryResult);

      const count = await repository.deleteCharactersByIds(['id-1', 'id-2']);
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM characters WHERE id = ANY($1::uuid[])',
        [['id-1', 'id-2']],
      );
      expect(count).toBe(2);
    });
  });

  describe('Legacy ID reconciliation', () => {
    it('records and resolves legacy object IDs', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult);

      await repository.recordLegacyId(
        'character',
        'legacy-hero-123',
        '11111111-1111-4111-8111-111111111111',
        'user-1',
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO legacy_object_ids'),
        ['character', 'legacy-hero-123', '11111111-1111-4111-8111-111111111111', 'user-1'],
      );

      pool.query.mockResolvedValueOnce({
        rows: [{ canonicalId: '11111111-1111-4111-8111-111111111111' }],
      } as QueryResult);

      const canonicalId = await repository.resolveCanonicalId(
        'character',
        'legacy-hero-123',
      );

      expect(canonicalId).toBe('11111111-1111-4111-8111-111111111111');
    });

    it('reconciles embedded id when creating character with distinct client id', async () => {
      const canonicalId = '22222222-2222-4222-8222-222222222222';
      const mockCreated = {
        id: canonicalId,
        name: 'Elrond',
        ownerId: 'user-1',
        data: { id: 'client-creator-id-999', class: 'Wizard' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 1. insert character
      pool.query.mockResolvedValueOnce({ rows: [mockCreated] } as QueryResult);
      // 2. record legacy id
      pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult);
      // 3. update character data with reconciled id
      pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult);

      const result = await repository.createCharacter('user-1', 'Elrond', {
        id: 'client-creator-id-999',
        class: 'Wizard',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO legacy_object_ids'),
        ['character', 'client-creator-id-999', canonicalId, 'user-1'],
      );
      expect(result.data).toEqual({
        id: canonicalId,
        legacyId: 'client-creator-id-999',
        class: 'Wizard',
      });
    });

    it('resolves character by legacy id if direct UUID lookup returns null', async () => {
      const canonicalId = '33333333-3333-4333-8333-333333333333';
      const mockCharacter = { id: canonicalId, name: 'Aragorn', ownerId: 'user-1' };

      // Direct lookup returns nothing
      pool.query.mockResolvedValueOnce({
        rows: [],
      } as unknown as QueryResult);
      // Legacy alias lookup returns canonical ID
      pool.query.mockResolvedValueOnce({
        rows: [{ canonicalId }],
      } as unknown as QueryResult);
      // Canonical ID lookup returns character
      pool.query.mockResolvedValueOnce({
        rows: [mockCharacter],
      } as unknown as QueryResult);

      const result = await repository.getCharacterById('legacy-strider-1');
      expect(result).toEqual(mockCharacter);
    });
  });
});

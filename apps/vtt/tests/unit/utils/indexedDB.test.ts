import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dungeonMapIndexedDB } from '../../../src/services/indexedDB';
import type { DungeonMapDB, GameStateDB } from '../../../src/services/indexedDB';

describe.skip('IndexedDB', () => {
  beforeEach(async () => {
    // Initialize the database before each test
    // Don't reset to avoid timing issues with fake-indexeddb
    await dungeonMapIndexedDB.init();
  });

  afterEach(async () => {
    // Clean up data after each test
    try {
      await dungeonMapIndexedDB.clearAll();
      await dungeonMapIndexedDB.clearAllGameStates();
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn('Cleanup error:', error);
    }
  });

  describe('Dungeon Map Operations', () => {
    const mockMapData: Omit<DungeonMapDB, 'id'> = {
      name: 'Test Dungeon',
      imageData: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
      format: 'webp',
      originalSize: 1000,
      compressedSize: 500,
      timestamp: Date.now(),
      source: 'one-page-dungeon-generator',
    };

    it('should save a dungeon map', async () => {
      const id = await dungeonMapIndexedDB.saveMap(mockMapData);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should retrieve a saved map by ID', async () => {
      const id = await dungeonMapIndexedDB.saveMap(mockMapData);
      const retrieved = await dungeonMapIndexedDB.getMapById(id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(id);
      expect(retrieved?.name).toBe(mockMapData.name);
      expect(retrieved?.format).toBe(mockMapData.format);
      expect(retrieved?.source).toBe(mockMapData.source);
    });

    it('should return null for non-existent map', async () => {
      const retrieved = await dungeonMapIndexedDB.getMapById('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should retrieve all maps', async () => {
      const id1 = await dungeonMapIndexedDB.saveMap(mockMapData);
      const id2 = await dungeonMapIndexedDB.saveMap({
        ...mockMapData,
        name: 'Test Dungeon 2',
      });

      const allMaps = await dungeonMapIndexedDB.getAllMaps();
      expect(allMaps).toHaveLength(2);
      expect(allMaps.some(m => m.id === id1)).toBe(true);
      expect(allMaps.some(m => m.id === id2)).toBe(true);
    });

    it('should delete a map', async () => {
      const id = await dungeonMapIndexedDB.saveMap(mockMapData);
      const deleted = await dungeonMapIndexedDB.deleteMap(id);

      expect(deleted).toBe(true);

      const retrieved = await dungeonMapIndexedDB.getMapById(id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent map', async () => {
      const deleted = await dungeonMapIndexedDB.deleteMap('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should clear all maps', async () => {
      await dungeonMapIndexedDB.saveMap(mockMapData);
      await dungeonMapIndexedDB.saveMap({ ...mockMapData, name: 'Map 2' });

      await dungeonMapIndexedDB.clearAll();

      const allMaps = await dungeonMapIndexedDB.getAllMaps();
      expect(allMaps).toHaveLength(0);
    });

    it('should get storage stats', async () => {
      await dungeonMapIndexedDB.saveMap(mockMapData);
      await dungeonMapIndexedDB.saveMap({ ...mockMapData, name: 'Map 2' });

      const stats = await dungeonMapIndexedDB.getStorageStats();
      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageSize).toBeGreaterThan(0);
      expect(stats.averageSize).toBe(stats.totalSize / stats.count);
    });

    it('should cleanup old maps keeping only specified count', async () => {
      // Create 5 maps with increasing timestamps
      for (let i = 0; i < 5; i++) {
        await dungeonMapIndexedDB.saveMap({
          ...mockMapData,
          name: `Map ${i}`,
          timestamp: Date.now() + i * 1000, // Ensure increasing timestamps
        });
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Keep only 2 most recent
      const deletedCount = await dungeonMapIndexedDB.cleanupOldMaps(2);
      expect(deletedCount).toBe(3);

      const remainingMaps = await dungeonMapIndexedDB.getAllMaps();
      expect(remainingMaps).toHaveLength(2);
    });
  });

  describe('Game State Operations', () => {
    const mockGameState: Omit<GameStateDB, 'timestamp' | 'version'> & { id: string } = {
      id: 'test-campaign-1',
      scenes: [{ id: 'scene1', name: 'Test Scene' }],
      activeSceneId: 'scene1',
      characters: [{ id: 'char1', name: 'Test Character' }],
      initiative: { round: 1, turn: 0 },
      settings: { gridSize: 50 },
    };

    it('should save game state', async () => {
      await dungeonMapIndexedDB.saveGameState(mockGameState);

      const retrieved = await dungeonMapIndexedDB.getGameState(mockGameState.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(mockGameState.id);
      expect(retrieved?.scenes).toEqual(mockGameState.scenes);
      expect(retrieved?.activeSceneId).toBe(mockGameState.activeSceneId);
    });

    it('should auto-increment version on save', async () => {
      await dungeonMapIndexedDB.saveGameState(mockGameState);
      const first = await dungeonMapIndexedDB.getGameState(mockGameState.id);
      expect(first?.version).toBe(1);

      await dungeonMapIndexedDB.saveGameState(mockGameState);
      const second = await dungeonMapIndexedDB.getGameState(mockGameState.id);
      expect(second?.version).toBe(2);
    });

    it('should update timestamp on save', async () => {
      const now = Date.now();
      await dungeonMapIndexedDB.saveGameState(mockGameState);

      const retrieved = await dungeonMapIndexedDB.getGameState(mockGameState.id);
      expect(retrieved?.timestamp).toBeGreaterThanOrEqual(now);
    });

    it('should return null for non-existent game state', async () => {
      const retrieved = await dungeonMapIndexedDB.getGameState('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should delete game state', async () => {
      await dungeonMapIndexedDB.saveGameState(mockGameState);
      await dungeonMapIndexedDB.deleteGameState(mockGameState.id);

      const retrieved = await dungeonMapIndexedDB.getGameState(mockGameState.id);
      expect(retrieved).toBeNull();
    });

    it('should clear all game states', async () => {
      await dungeonMapIndexedDB.saveGameState(mockGameState);
      await dungeonMapIndexedDB.saveGameState({
        ...mockGameState,
        id: 'test-campaign-2',
      });

      await dungeonMapIndexedDB.clearAllGameStates();

      const state1 = await dungeonMapIndexedDB.getGameState('test-campaign-1');
      const state2 = await dungeonMapIndexedDB.getGameState('test-campaign-2');
      expect(state1).toBeNull();
      expect(state2).toBeNull();
    });
  });

  describe('Database Management', () => {
    it('should check if IndexedDB is available', () => {
      const ctor = dungeonMapIndexedDB.constructor as { isAvailable: () => boolean };
      const isAvailable = ctor.isAvailable();
      // In test environment with mocked IndexedDB, should be available
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should initialize database without errors', async () => {
      await expect(dungeonMapIndexedDB.init()).resolves.not.toThrow();
    });

    it('should reset database', async () => {
      // Add some data
      await dungeonMapIndexedDB.saveMap({
        name: 'Test Map',
        imageData: 'data:image/webp;base64,test',
        format: 'webp',
        originalSize: 100,
        compressedSize: 50,
        timestamp: Date.now(),
        source: 'one-page-dungeon-generator',
      });

      await dungeonMapIndexedDB.saveGameState({
        id: 'test',
        scenes: [],
        activeSceneId: null,
        characters: [],
        initiative: null,
        settings: {},
      });

      // Reset
      await dungeonMapIndexedDB.resetDatabase();
      await dungeonMapIndexedDB.init();

      // Verify data is gone
      const maps = await dungeonMapIndexedDB.getAllMaps();
      const gameState = await dungeonMapIndexedDB.getGameState('test');

      expect(maps).toHaveLength(0);
      expect(gameState).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple saves of same map ID', async () => {
      const mapData1 = {
        name: 'Original Name',
        imageData: 'data:image/webp;base64,original',
        format: 'webp' as const,
        originalSize: 100,
        compressedSize: 50,
        timestamp: Date.now(),
        source: 'one-page-dungeon-generator' as const,
      };

      const id = await dungeonMapIndexedDB.saveMap(mapData1);

      // Save again with different data but same ID won't work
      // because saveMap generates new IDs each time
      // Let's verify each save creates a new entry
      const id2 = await dungeonMapIndexedDB.saveMap(mapData1);
      expect(id2).not.toBe(id);

      const allMaps = await dungeonMapIndexedDB.getAllMaps();
      expect(allMaps.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty database operations gracefully', async () => {
      const stats = await dungeonMapIndexedDB.getStorageStats();
      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);

      const deletedCount = await dungeonMapIndexedDB.cleanupOldMaps(5);
      expect(deletedCount).toBe(0);
    });

    it('should handle cleanup with keepCount larger than total', async () => {
      await dungeonMapIndexedDB.saveMap({
        name: 'Map 1',
        imageData: 'data:image/webp;base64,test',
        format: 'webp',
        originalSize: 100,
        compressedSize: 50,
        timestamp: Date.now(),
        source: 'one-page-dungeon-generator',
      });

      const deletedCount = await dungeonMapIndexedDB.cleanupOldMaps(10);
      expect(deletedCount).toBe(0);

      const maps = await dungeonMapIndexedDB.getAllMaps();
      expect(maps).toHaveLength(1);
    });
  });
});

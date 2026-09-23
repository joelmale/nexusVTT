import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const exposed: unknown[] = [];
vi.mock('comlink', () => ({ expose: vi.fn((value: unknown) => exposed.push(value)) }));

type StorageApi = {
  saveMap(map: never): Promise<string>;
  getAllMaps(): Promise<Array<{ id: string; timestamp: number; compressedSize: number }>>;
  getMapById(id: string): Promise<unknown | null>;
  deleteMap(id: string): Promise<boolean>;
  clearAllMaps(): Promise<void>;
  getMapStorageStats(): Promise<{ count: number; totalSize: number; averageSize: number }>;
  cleanupOldMaps(keepCount?: number): Promise<number>;
  saveGameState(state: never): Promise<void>;
  getGameState(id: string): Promise<{ version: number } | null>;
  deleteGameState(id: string): Promise<void>;
  clearAllGameStates(): Promise<void>;
  healthCheck(): Promise<{ status: string }>;
};

describe('storage worker API', () => {
  beforeEach(async () => {
    exposed.length = 0;
    vi.resetModules();
    await import('@/workers/storageWorker');
  });
  afterEach(() => vi.restoreAllMocks());

  it('persists, sorts, summarizes, and cleans up dungeon maps', async () => {
    const worker = exposed[0] as StorageApi;
    const first = await worker.saveMap({ name: 'Older', timestamp: 1, originalSize: 2048, compressedSize: 100 } as never);
    const second = await worker.saveMap({ name: 'Newer', timestamp: 2, originalSize: 1024, compressedSize: 300 } as never);
    expect((await worker.getAllMaps()).map((map) => map.id)).toEqual([second, first]);
    expect(await worker.getMapById(first)).toMatchObject({ id: first });
    expect(await worker.getMapStorageStats()).toEqual({ count: 2, totalSize: 400, averageSize: 200 });
    expect(await worker.cleanupOldMaps(1)).toBe(1);
    expect(await worker.deleteMap(second)).toBe(true);
    await worker.clearAllMaps();
    expect(await worker.getAllMaps()).toEqual([]);
  });

  it('versions game-state saves and supports deletion, clearing, and health checks', async () => {
    const worker = exposed[0] as StorageApi;
    await worker.saveGameState({ id: 'campaign-1', scenes: [] } as never);
    await worker.saveGameState({ id: 'campaign-1', scenes: [] } as never);
    expect(await worker.getGameState('campaign-1')).toMatchObject({ version: 2 });
    await worker.deleteGameState('campaign-1');
    expect(await worker.getGameState('campaign-1')).toBeNull();
    await worker.saveGameState({ id: 'campaign-2', scenes: [] } as never);
    await worker.clearAllGameStates();
    expect(await worker.getGameState('campaign-2')).toBeNull();
    await expect(worker.healthCheck()).resolves.toMatchObject({ status: 'ok' });
  });
});

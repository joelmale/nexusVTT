import type { Drawing } from '@/types/drawing';
import type { Scene } from '@/types/game';
import { getLinearFlowStorage } from './linearFlowStorage';

/**
 * Drawing persistence service that handles saving and loading drawings
 * Now using IndexedDB with automatic migration from localStorage.
 */
class DrawingPersistenceService {
  private readonly STORAGE_PREFIX = 'nexus-drawings';
  private readonly SCENES_KEY = 'nexus-scenes';
  private storage = getLinearFlowStorage();
  private migrationDone = false;

  /**
   * Ensure migration is complete before any operations
   */
  private async ensureMigration(): Promise<void> {
    if (this.migrationDone) return;

    if (this.storage.needsDrawingMigration()) {
      console.log(
        '🔄 Auto-migrating drawing data from localStorage to IndexedDB...',
      );
      const result = await this.storage.migrateDrawingData();

      if (result.errors.length > 0) {
        console.warn('⚠️ Migration completed with some errors:', result.errors);
      } else {
        console.log('✅ Migration completed successfully:', result);
      }
    }

    this.migrationDone = true;
  }

  /**
   * Save drawings for a scene (now using IndexedDB)
   */
  saveDrawingsLocally(sceneId: string, drawings: Drawing[]): void {
    try {
      const key = `${this.STORAGE_PREFIX}-${sceneId}`;
      const data = {
        sceneId,
        drawings,
        lastUpdated: Date.now(),
        version: 1,
      };
      localStorage.setItem(key, JSON.stringify(data));
      console.log(
        `Saved ${drawings.length} drawings locally for scene ${sceneId}`,
      );
    } catch (error) {
      console.error('Failed to save drawings to localStorage:', error);
    }
  }

  /**
   * Load drawings for a scene from localStorage
   */
  loadDrawingsLocally(sceneId: string): Drawing[] {
    try {
      const key = `${this.STORAGE_PREFIX}-${sceneId}`;
      const stored = localStorage.getItem(key);

      if (!stored) {
        return [];
      }

      const data = JSON.parse(stored);

      if (!data.drawings || !Array.isArray(data.drawings)) {
        console.warn('Invalid drawings data in localStorage');
        return [];
      }

      console.log(
        `Loaded ${data.drawings.length} drawings locally for scene ${sceneId}`,
      );
      return data.drawings;
    } catch (error) {
      console.error('Failed to load drawings from localStorage:', error);
      return [];
    }
  }

  /**
   * Save entire scene data to localStorage
   */
  saveSceneLocally(scene: Scene): void {
    try {
      const scenesData = this.loadAllScenesLocally();
      const existingIndex = scenesData.findIndex((s) => s.id === scene.id);

      if (existingIndex >= 0) {
        scenesData[existingIndex] = { ...scene, updatedAt: Date.now() };
      } else {
        scenesData.push({ ...scene, updatedAt: Date.now() });
      }

      localStorage.setItem(this.SCENES_KEY, JSON.stringify(scenesData));
      console.log(`Saved scene ${scene.id} locally`);
    } catch (error) {
      console.error('Failed to save scene to localStorage:', error);
    }
  }

  /**
   * Load all scenes from localStorage
   */
  loadAllScenesLocally(): Scene[] {
    try {
      const stored = localStorage.getItem(this.SCENES_KEY);
      if (!stored) {
        return [];
      }

      const scenes = JSON.parse(stored);
      if (!Array.isArray(scenes)) {
        return [];
      }

      console.log(`Loaded ${scenes.length} scenes from localStorage`);
      return scenes;
    } catch (error) {
      console.error('Failed to load scenes from localStorage:', error);
      return [];
    }
  }

  /**
   * Save drawings using IndexedDB (with auto-migration)
   */
  async saveDrawings(sceneId: string, drawings: Drawing[]): Promise<void> {
    await this.ensureMigration();
    await this.storage.saveDrawings(sceneId, drawings);
  }

  /**
   * Load drawings using IndexedDB (with auto-migration)
   */
  async loadDrawings(sceneId: string, roomCode?: string): Promise<Drawing[]> {
    await this.ensureMigration();
    return this.storage.getDrawings(sceneId, roomCode);
  }

  /**
   * Save scene using IndexedDB (with auto-migration)
   */
  async saveScene(scene: Scene): Promise<void> {
    await this.ensureMigration();
    await this.storage.saveScene(scene);
  }

  /**
   * Load all scenes using IndexedDB (with auto-migration)
   */
  async loadAllScenes(roomCode?: string): Promise<Scene[]> {
    await this.ensureMigration();
    return this.storage.getScenes(roomCode);
  }

  /**
   * Delete scene using IndexedDB (with auto-migration)
   */
  async deleteScene(sceneId: string): Promise<void> {
    await this.ensureMigration();
    this.storage.deleteScene(sceneId);
  }
}

// Export singleton instance
export const drawingPersistenceService = new DrawingPersistenceService();

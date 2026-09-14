/**
 * Linear Flow Storage Bridge
 *
 * Connects the Linear Flow (appFlowStore) with the entity store
 * Provides migration from localStorage to IndexedDB + proper serialization
 */

import { getEntityStore } from './entityStore';
import type { Scene, Token, Drawing } from '@/types/game';
import type { PlayerCharacter, GameConfig } from '@/types/game';

export class LinearFlowStorage {
  private store = getEntityStore();

  // Debug helper: migrate drawing data from localStorage
  async migrateDrawingData(): Promise<{
    migratedScenes: number;
    migratedDrawings: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let migratedScenes = 0;
    let migratedDrawings = 0;

    try {
      console.log(
        '🔄 Migrating drawing data from localStorage to IndexedDB...',
      );

      // Migrate scenes
      const scenesData = localStorage.getItem('nexus-scenes');
      if (scenesData) {
        try {
          const scenes: Scene[] = JSON.parse(scenesData);
          console.log(`📂 Found ${scenes.length} scenes in localStorage`);

          for (const scene of scenes) {
            await this.saveScene(scene);
            migratedScenes++;
            console.log(`✅ Migrated scene: ${scene.name} (${scene.id})`);
          }

          // Clean up old data
          localStorage.removeItem('nexus-scenes');
          console.log('🗑️ Removed old nexus-scenes from localStorage');
        } catch (error) {
          errors.push(`Failed to migrate scenes: ${error}`);
        }
      }

      // Migrate drawings for each scene
      const localStorageKeys = Object.keys(localStorage);
      const drawingKeys = localStorageKeys.filter((key) =>
        key.startsWith('nexus-drawings-'),
      );

      console.log(
        `📂 Found ${drawingKeys.length} drawing sets in localStorage`,
      );

      for (const key of drawingKeys) {
        try {
          const sceneId = key.replace('nexus-drawings-', '');
          const drawingsData = localStorage.getItem(key);

          if (drawingsData) {
            const data = JSON.parse(drawingsData);
            if (data.drawings && Array.isArray(data.drawings)) {
              await this.saveDrawings(sceneId, data.drawings);
              migratedDrawings += data.drawings.length;
              console.log(
                `✅ Migrated ${data.drawings.length} drawings for scene ${sceneId}`,
              );
            }
          }

          // Clean up old data
          localStorage.removeItem(key);
          console.log(`🗑️ Removed old ${key} from localStorage`);
        } catch (error) {
          errors.push(`Failed to migrate drawings for ${key}: ${error}`);
        }
      }

      console.log(
        `✅ Migration complete: ${migratedScenes} scenes, ${migratedDrawings} drawings`,
      );

      return { migratedScenes, migratedDrawings, errors };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      errors.push(`Migration failed: ${error}`);
      return { migratedScenes, migratedDrawings, errors };
    }
  }

  // Debug helper: check if migration is needed
  needsDrawingMigration(): boolean {
    const hasOldScenes = localStorage.getItem('nexus-scenes') !== null;
    const localStorageKeys = Object.keys(localStorage);
    const hasOldDrawings = localStorageKeys.some((key) =>
      key.startsWith('nexus-drawings-'),
    );

    return hasOldScenes || hasOldDrawings;
  }

  // Debug helper: create test data
  createTestData(): void {
    console.log('🧪 Creating test data...');

    // Create test session
    const sessionId = this.store.create('session', {
      roomCode: 'TEST123',
      hostId: 'test-dm',
      config: {
        name: 'Test Campaign',
        description: 'Test session for debugging',
      },
    });

    // Create test scene
    const sceneId = this.store.create('scene', {
      name: 'Test Scene',
      description: 'A test scene for debugging',
      sessionId: sessionId.id,
      background: { type: 'color', value: '#ffffff' },
      gridSize: 50,
    });

    // Create test character
    const characterId = this.store.create('character', {
      name: 'Test Character',
      type: 'player',
      sessionId: sessionId.id,
      sceneId: sceneId.id,
      position: { x: 100, y: 100 },
    });

    console.log('🧪 Created test entities:', {
      session: sessionId.id,
      scene: sceneId.id,
      character: characterId.id,
    });

    console.log('🧪 Current stats:', this.getStats());
  }

  // Debug helper: reset database
  async resetDatabase(): Promise<void> {
    try {
      console.log('🔄 LinearFlowStorage: Resetting database...');

      // Clear localStorage first
      localStorage.removeItem('nexus-app-flow');
      localStorage.removeItem('nexus-characters');
      localStorage.removeItem('nexus-sessions');

      // Delete IndexedDB databases
      const dbNames = ['nexus-entity-store', 'nexus-vtt'];
      for (const dbName of dbNames) {
        try {
          await new Promise<void>((resolve) => {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = () => {
              console.log(`🗑️ Deleted database: ${dbName}`);
              resolve();
            };
            deleteReq.onerror = () => {
              console.warn(
                `Failed to delete database ${dbName}:`,
                deleteReq.error,
              );
              resolve(); // Continue anyway
            };
            deleteReq.onblocked = () => {
              console.warn(`Database deletion blocked: ${dbName}`);
              resolve(); // Continue anyway
            };
          });
        } catch (error) {
          console.warn(`Error deleting database ${dbName}:`, error);
        }
      }

      console.log('✅ Database reset complete - please reload page');
    } catch (error) {
      console.error('Failed to reset database:', error);
    }
  }

  // =============================================================================
  // SCENE MANAGEMENT
  // =============================================================================

  /**
   * Create a scene using the entity store
   */
  async createScene(
    sceneData: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Scene> {
    const scene = this.store.createScene(sceneData);

    // Auto-save to IndexedDB (throttled)
    console.log('🎬 Created scene in entity store:', scene.name);

    return scene;
  }

  /**
   * Get all scenes
   */
  getScenes(roomCode?: string): Scene[] {
    if (roomCode) {
      return this.store.query({
        type: 'scene',
        where: { roomCode },
      }) as unknown as Scene[];
    }
    return this.store.getByType('scene') as unknown as Scene[];
  }

  /**
   * Get active scene with all related data
   */
  getSceneWithData(sceneId: string): {
    scene: Scene | null;
    tokens: Token[];
    drawings: Drawing[];
  } {
    return this.store.getSceneWithRelations(sceneId);
  }

  /**
   * Update scene
   */
  updateScene(sceneId: string, updates: Partial<Scene>): Scene | null {
    return this.store.update(sceneId, updates) as Scene | null;
  }

  /**
   * Delete scene
   */
  deleteScene(sceneId: string): boolean {
    return this.store.delete(sceneId);
  }

  /**
   * Save scene (upsert existing)
   */
  async saveScene(scene: Scene): Promise<void> {
    // Serialize scene to plain object (handles Zustand draft proxies)
    const plainScene = JSON.parse(JSON.stringify(scene));

    // Check if scene exists
    const existingScene = this.store.get(plainScene.id) as Scene | null;

    if (existingScene) {
      // Update existing
      this.store.update(plainScene.id, {
        ...plainScene,
        updatedAt: Date.now(),
      });
      console.log('🎬 Updated scene in entity store:', plainScene.name);
    } else {
      // Create new
      this.store.create('scene', {
        ...plainScene,
        createdAt: plainScene.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
      console.log('🎬 Created scene in entity store:', plainScene.name);
    }
  }

  // =============================================================================
  // DRAWING MANAGEMENT
  // =============================================================================

  /**
   * Save drawings for a scene
   */
  async saveDrawings(sceneId: string, drawings: Drawing[]): Promise<void> {
    // First, delete existing drawings for this scene
    this.deleteDrawings(sceneId);

    // Create new drawing entities
    for (const drawing of drawings) {
      this.store.create('drawing', {
        ...drawing,
        sceneId,
        createdAt: drawing.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }

    console.log(`🎨 Saved ${drawings.length} drawings for scene ${sceneId}`);
  }

  /**
   * Get all drawings for a scene
   */
  getDrawings(sceneId: string, roomCode?: string): Drawing[] {
    const where: Record<string, unknown> = { sceneId };
    if (roomCode) {
      where.roomCode = roomCode;
    }
    return this.store.query({
      type: 'drawing',
      where,
    }) as unknown as Drawing[];
  }

  /**
   * Delete all drawings for a scene
   */
  deleteDrawings(sceneId: string): void {
    const drawings = this.getDrawings(sceneId);
    for (const drawing of drawings) {
      this.store.delete(drawing.id);
    }
    console.log(`🗑️ Deleted ${drawings.length} drawings for scene ${sceneId}`);
  }

  /**
   * Add a single drawing to a scene
   */
  addDrawing(sceneId: string, drawing: Drawing): Drawing {
    const drawingEntity = this.store.create('drawing', {
      ...drawing,
      sceneId,
      createdAt: drawing.createdAt || Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`🎨 Added drawing to scene ${sceneId}:`, drawing.id);
    return drawingEntity as unknown as Drawing;
  }

  /**
   * Update a specific drawing
   */
  updateDrawing(drawingId: string, updates: Partial<Drawing>): Drawing | null {
    const updated = this.store.update(drawingId, {
      ...(updates as Record<string, unknown>),
      updatedAt: Date.now(),
    }) as unknown as Drawing | null;

    if (updated) {
      console.log(`🎨 Updated drawing:`, drawingId);
    }

    return updated;
  }

  /**
   * Delete a specific drawing
   */
  deleteDrawing(drawingId: string): boolean {
    const success = this.store.delete(drawingId);
    if (success) {
      console.log(`🗑️ Deleted drawing:`, drawingId);
    }
    return success;
  }

  // =============================================================================
  // CHARACTER MANAGEMENT (Enhanced)
  // =============================================================================

  /**
   * Save character with enhanced entity system
   */
  saveCharacter(character: PlayerCharacter): PlayerCharacter {
    // Convert to entity format
    const characterEntity = this.store.create('character', {
      ...character,
      browserId: this.getBrowserId(),
    });

    console.log('👤 Saved character to entity store:', character.name);
    return characterEntity as unknown as PlayerCharacter;
  }

  /**
   * Get characters for current browser
   */
  getCharacters(): PlayerCharacter[] {
    const browserId = this.getBrowserId();
    return this.store.query({
      type: 'character',
      where: { browserId },
    }) as unknown as PlayerCharacter[];
  }

  /**
   * Delete character
   */
  deleteCharacter(characterId: string): boolean {
    return this.store.delete(characterId);
  }

  // =============================================================================
  // GAME CONFIGURATION
  // =============================================================================

  /**
   * Save game configuration
   */
  saveGameConfig(roomCode: string, config: GameConfig): void {
    this.store.create('game-config', {
      roomCode,
      ...config,
    });
  }

  /**
   * Get game configuration
   */
  getGameConfig(roomCode: string): GameConfig | null {
    const configs = this.store.query({
      type: 'game-config',
      where: { roomCode },
    });

    return configs.length > 0 ? (configs[0] as unknown as GameConfig) : null;
  }

  // =============================================================================
  // SESSION MANAGEMENT (Enhanced with sessionPersistence migration)
  // =============================================================================

  /**
   * Save session state (enhanced)
   */
  saveSession(sessionData: {
    user: { name: string; type: string; id: string };
    roomCode: string;
    view: string;
    isConnected: boolean;
  }): void {
    // Remove any existing session for this browser
    const existingSessions = this.store.query({
      type: 'session',
      where: { browserId: this.getBrowserId() },
    });

    existingSessions.forEach((session) => {
      this.store.delete(session.id);
    });

    // Create new session
    this.store.create('session', {
      ...sessionData,
      browserId: this.getBrowserId(),
      lastActivity: Date.now(),
    });

    console.log('💾 Saved session to entity store');
  }

  /**
   * Save legacy session persistence data to IndexedDB
   */
  saveLegacySessionData(sessionData: unknown, gameState: unknown): void {
    const browserId = this.getBrowserId();

    // Save session data
    if (sessionData) {
      this.store.create('session-legacy', {
        ...sessionData,
        browserId,
        dataType: 'session',
      });
    }

    // Save game state
    if (gameState) {
      this.store.create('session-legacy', {
        ...gameState,
        browserId,
        dataType: 'gameState',
      });
    }

    console.log('💾 Saved legacy session data to IndexedDB');
  }

  /**
   * Load session state
   */
  loadSession(): {
    user: { name: string; type: string; id: string };
    roomCode: string;
    view: string;
    isConnected: boolean;
    browserId: string;
    lastActivity: number;
  } | null {
    const sessions = this.store.query({
      type: 'session',
      where: { browserId: this.getBrowserId() },
    });

    if (sessions.length === 0) return null;

    const session = sessions[0];
    console.log('📂 Loaded session from entity store');
    return session as unknown as {
      user: { name: string; type: string; id: string };
      roomCode: string;
      view: string;
      isConnected: boolean;
      browserId: string;
      lastActivity: number;
    };
  }

  /**
   * Load legacy session data
   */
  loadLegacySessionData(): {
    session: unknown | null;
    gameState: unknown | null;
  } {
    const browserId = this.getBrowserId();

    const sessionData = this.store.query({
      type: 'session-legacy',
      where: { browserId, dataType: 'session' },
    });

    const gameStateData = this.store.query({
      type: 'session-legacy',
      where: { browserId, dataType: 'gameState' },
    });

    return {
      session: sessionData.length > 0 ? sessionData[0] : null,
      gameState: gameStateData.length > 0 ? gameStateData[0] : null,
    };
  }

  /**
   * Clear session
   */
  clearSession(): void {
    const browserId = this.getBrowserId();

    // Clear regular sessions
    const sessions = this.store.query({
      type: 'session',
      where: { browserId },
    });

    sessions.forEach((session) => {
      this.store.delete(session.id);
    });

    // Clear legacy sessions
    const legacySessions = this.store.query({
      type: 'session-legacy',
      where: { browserId },
    });

    legacySessions.forEach((session) => {
      this.store.delete(session.id);
    });

    console.log('🗑️ Cleared session data from IndexedDB');
  }

  /**
   * Clear all game data (scenes and sessions) but keep characters
   * Use this when starting a fresh new game
   */
  async clearGameData(): Promise<void> {
    console.log('🗑️ Clearing game data (keeping characters)...');

    // Get all entities first (before deleting anything to avoid query issues)
    // Filter out undefined values in case of corrupted data
    const allDrawings = (
      this.store.getByType('drawing') as unknown as Drawing[]
    ).filter((d) => d != null);
    const allScenes = (
      this.store.getByType('scene') as unknown as Scene[]
    ).filter((s) => s != null);

    // Delete all drawings first
    allDrawings.forEach((drawing) => {
      if (drawing?.id) {
        this.store.delete(drawing.id);
      }
    });
    console.log(`🗑️ Deleted ${allDrawings.length} drawings`);

    // Delete all scenes
    allScenes.forEach((scene) => {
      if (scene?.id) {
        this.store.delete(scene.id);
      }
    });
    console.log(`🗑️ Deleted ${allScenes.length} scenes`);

    // Clear sessions
    this.clearSession();

    // Note: With PostgreSQL architecture, we DON'T reset the user here.
    // User data comes from the database or guest session and should persist.
    // Only clear session-specific state, not user identity.

    // Force save to persist the cleared state
    await this.forceSave();

    console.log('✅ Game data cleared - ready for new game');
  }

  // =============================================================================
  // MIGRATION FROM LOCALSTORAGE
  // =============================================================================

  /**
   * Comprehensive migration from localStorage to IndexedDB
   */
  async migrateFromLocalStorage(): Promise<{
    migrated: boolean;
    scenes: number;
    characters: number;
    sessions: number;
    legacySessions: number;
    browserId: boolean;
  }> {
    const stats = {
      migrated: false,
      scenes: 0,
      characters: 0,
      sessions: 0,
      legacySessions: 0,
      browserId: false,
    };

    try {
      console.log('🔄 Starting comprehensive localStorage migration...');

      // 1. Migrate browser ID (getBrowserId() handles this automatically)
      const browserId = this.getBrowserId();
      if (browserId) {
        stats.browserId = true;
      }

      // 2. Migrate session persistence service data (nexus-session, nexus-game-state)
      const sessionData = localStorage.getItem('nexus-session');
      const gameStateData = localStorage.getItem('nexus-game-state');

      if (sessionData || gameStateData) {
        try {
          const parsedSession = sessionData ? JSON.parse(sessionData) : null;
          const parsedGameState = gameStateData
            ? JSON.parse(gameStateData)
            : null;

          this.saveLegacySessionData(parsedSession, parsedGameState);
          stats.legacySessions++;

          // Migrate scenes from gameState if available
          if (
            parsedGameState?.scenes &&
            Array.isArray(parsedGameState.scenes)
          ) {
            for (const scene of parsedGameState.scenes) {
              await this.createScene(scene);
              stats.scenes++;
            }
          }

          // Migrate characters from gameState
          if (
            parsedGameState?.characters &&
            Array.isArray(parsedGameState.characters)
          ) {
            parsedGameState.characters.forEach((character: PlayerCharacter) => {
              this.saveCharacter(character);
              stats.characters++;
            });
          }

          // Clean up old localStorage
          localStorage.removeItem('nexus-session');
          localStorage.removeItem('nexus-game-state');
          console.log(
            '🗑️ Cleaned up nexus-session and nexus-game-state from localStorage',
          );
        } catch (error) {
          console.error('Failed to migrate session persistence data:', error);
        }
      }

      // 3. Migrate appFlowStore data (nexus-app-flow)
      const appFlowData = localStorage.getItem('nexus-app-flow');
      if (appFlowData) {
        try {
          const parsed = JSON.parse(appFlowData);
          if (parsed.state) {
            const { user, roomCode, view, gameConfig, selectedCharacter } =
              parsed.state;

            // Migrate session
            if (user?.name && roomCode) {
              this.saveSession({
                user,
                roomCode,
                view: view || 'game',
                isConnected: false,
              });
              stats.sessions++;
            }

            // Migrate game config
            if (gameConfig && roomCode) {
              this.saveGameConfig(roomCode, gameConfig);
            }

            // Migrate selected character
            if (selectedCharacter) {
              this.saveCharacter(selectedCharacter);
              stats.characters++;
            }
          }

          // Clean up old localStorage (but keep for Zustand compatibility)
          console.log(
            '📝 Note: Keeping nexus-app-flow for Zustand compatibility',
          );
        } catch (error) {
          console.error('Failed to migrate app flow data:', error);
        }
      }

      // 4. Migrate standalone characters (nexus-characters)
      const charactersData = localStorage.getItem('nexus-characters');
      if (charactersData) {
        try {
          const characters = JSON.parse(charactersData);
          if (Array.isArray(characters)) {
            characters.forEach((character) => {
              this.saveCharacter(character);
              stats.characters++;
            });
          }

          localStorage.removeItem('nexus-characters');
          console.log('🗑️ Cleaned up nexus-characters from localStorage');
        } catch (error) {
          console.error('Failed to migrate characters data:', error);
        }
      }

      // 5. Check if migration was successful
      if (
        stats.characters > 0 ||
        stats.scenes > 0 ||
        stats.sessions > 0 ||
        stats.legacySessions > 0 ||
        stats.browserId
      ) {
        stats.migrated = true;
        console.log('✅ Comprehensive migration complete:', stats);

        // Mark migration as complete
        localStorage.setItem('nexus-migration-complete', 'true');

        // Force save to ensure data is persisted
        await this.forceSave();
      } else {
        console.log('ℹ️ No data found to migrate');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }

    return stats;
  }

  /**
   * Check if migration is needed (comprehensive check)
   */
  needsMigration(): boolean {
    // If migration is marked complete, no need to migrate
    if (localStorage.getItem('nexus-migration-complete') === 'true') {
      return false;
    }

    // Check for any localStorage data that needs migration
    const localStorageKeys = Object.keys(localStorage);
    const needsMigrationKeys = [
      'nexus-session',
      'nexus-game-state',
      'nexus-browser-id',
      'nexus-characters',
      'nexus-scenes',
    ];

    const hasOldData = needsMigrationKeys.some(
      (key) => localStorage.getItem(key) !== null,
    );
    const hasOldDrawings = localStorageKeys.some((key) =>
      key.startsWith('nexus-drawings-'),
    );

    return hasOldData || hasOldDrawings;
  }

  /**
   * Clean up migration flags and any remaining old localStorage data
   */
  cleanupMigrationData(): {
    removedKeys: string[];
    keptKeys: string[];
  } {
    const localStorageKeys = Object.keys(localStorage);
    const removedKeys: string[] = [];
    const keptKeys: string[] = [];

    // Keys that should be removed after migration
    const keysToRemove = [
      'nexus-session',
      'nexus-game-state',
      'nexus-browser-id',
      'nexus-characters',
      'nexus-scenes',
    ];

    // Remove drawing keys
    const drawingKeys = localStorageKeys.filter((key) =>
      key.startsWith('nexus-drawings-'),
    );
    keysToRemove.push(...drawingKeys);

    // Remove old data
    keysToRemove.forEach((key) => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        removedKeys.push(key);
      }
    });

    // Keep these keys (they're still used)
    const keysToKeep = [
      'nexus-app-flow', // Zustand persistence
      'nexus-migration-complete', // Migration flag
    ];

    keysToKeep.forEach((key) => {
      if (localStorage.getItem(key) !== null) {
        keptKeys.push(key);
      }
    });

    console.log('🧹 Migration cleanup complete:', {
      removed: removedKeys.length,
      kept: keptKeys.length,
    });

    return { removedKeys, keptKeys };
  }

  // =============================================================================
  // BACKUP/RESTORE (Ogres-style)
  // =============================================================================

  /**
   * Export entire campaign as backup file
   */
  async exportCampaign(): Promise<Uint8Array> {
    return await this.store.exportBackup();
  }

  /**
   * Import campaign from backup file
   */
  async importCampaign(backupFile: Uint8Array): Promise<void> {
    await this.store.importBackup(backupFile);
  }

  /**
   * Download backup file (for user)
   */
  downloadBackup(filename?: string): void {
    this.exportCampaign().then((backupData) => {
      const blob = new Blob([backupData as BlobPart], {
        type: 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download =
        filename ||
        `nexus-campaign-${new Date().toISOString().split('T')[0]}.nexus`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('📥 Campaign backup downloaded');
    });
  }

  /**
   * Upload and restore from backup file
   */
  uploadBackup(): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.nexus';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          const backupData = new Uint8Array(arrayBuffer);
          await this.importCampaign(backupData);
          console.log('📤 Campaign backup restored');
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      input.click();
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private getBrowserId(): string {
    // Check IndexedDB first (new system)
    const browserIdEntity = this.store.get('browser-id') as {
      value: string;
    } | null;

    if (browserIdEntity) {
      return browserIdEntity.value;
    }

    // Check localStorage for migration (old system)
    let browserId = localStorage.getItem('nexus-browser-id');
    if (browserId) {
      // Migrate to IndexedDB
      this.store.create('browser-id', { value: browserId });
      localStorage.removeItem('nexus-browser-id');
      console.log('🔄 Migrated browser ID from localStorage to IndexedDB');
      return browserId;
    }

    // Generate new ID
    browserId = crypto.randomUUID();
    this.store.create('browser-id', { value: browserId });
    console.log('🆔 Generated new browser ID and saved to IndexedDB');
    return browserId;
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return this.store.getStats();
  }

  /**
   * Force immediate save (for critical operations)
   */
  async forceSave(): Promise<void> {
    await this.store.forceSave();
  }

  /**
   * Sync scenes from entity store to gameStore (for UI)
   */
  async syncScenesWithGameStore(): Promise<{
    synced: number;
    errors: string[];
  }> {
    try {
      // Dynamic import to avoid circular dependencies
      const { useGameStore } = await import('@/stores/gameStore');

      const entityScenes = this.getScenes();
      console.log(
        '🔄 Syncing',
        entityScenes.length,
        'scenes from entity store to gameStore',
      );

      // Use the store's update method to modify sceneState.scenes directly
      useGameStore.setState((state) => {
        state.sceneState.scenes = entityScenes;

        // If no active scene is set and we have scenes, set the first one
        if (!state.sceneState.activeSceneId && entityScenes.length > 0) {
          state.sceneState.activeSceneId = entityScenes[0].id;
          console.log('🎯 Set active scene to:', entityScenes[0].name);
        }
      });

      console.log(
        '✅ Synced scenes to gameStore:',
        entityScenes.map((s) => s.name),
      );

      return {
        synced: entityScenes.length,
        errors: [],
      };
    } catch (error) {
      console.error('❌ Failed to sync scenes to gameStore:', error);
      return {
        synced: 0,
        errors: [String(error)],
      };
    }
  }

  /**
   * Clear all data (careful!)
   */
  async clearAllData(): Promise<void> {
    // This is destructive - maybe add confirmation
    console.warn('🗑️ Clearing all campaign data...');

    // For now, just clear the localStorage migration flag
    localStorage.removeItem('nexus-migration-complete');
  }
}

// Global instance
let globalLinearStorage: LinearFlowStorage | null = null;

export function getLinearFlowStorage(): LinearFlowStorage {
  if (!globalLinearStorage) {
    globalLinearStorage = new LinearFlowStorage();
  }
  return globalLinearStorage;
}

// Debug exports for console access
if (typeof window !== 'undefined') {
  (
    window as unknown as { debugStorage: Record<string, unknown> }
  ).debugStorage = {
    resetDatabase: async () => {
      const storage = getLinearFlowStorage();
      await storage.resetDatabase();
    },
    clearGameData: async () => {
      const storage = getLinearFlowStorage();
      await storage.clearGameData();
    },
    getStats: () => {
      const storage = getLinearFlowStorage();
      return storage.getStats();
    },
    forceSave: async () => {
      const storage = getLinearFlowStorage();
      await storage.forceSave();
    },
    createTestData: () => {
      const storage = getLinearFlowStorage();
      storage.createTestData();
    },
    migrateDrawingData: async () => {
      const storage = getLinearFlowStorage();
      return await storage.migrateDrawingData();
    },
    needsDrawingMigration: () => {
      const storage = getLinearFlowStorage();
      return storage.needsDrawingMigration();
    },
    getScenes: () => {
      const storage = getLinearFlowStorage();
      return storage.getScenes();
    },
    getDrawings: (sceneId: string) => {
      const storage = getLinearFlowStorage();
      return storage.getDrawings(sceneId);
    },
    syncToGameStore: async () => {
      const storage = getLinearFlowStorage();
      return await storage.syncScenesWithGameStore();
    },
    getGameStoreScenes: () => {
      // Import gameStore dynamically to avoid circular imports
      return window.__gameStore
        ? window.__gameStore.getState().sceneState.scenes
        : 'GameStore not available';
    },
    // Enhanced migration functions
    migrateFromLocalStorage: async () => {
      const storage = getLinearFlowStorage();
      return await storage.migrateFromLocalStorage();
    },
    needsMigration: () => {
      const storage = getLinearFlowStorage();
      return storage.needsMigration();
    },
    cleanupMigrationData: () => {
      const storage = getLinearFlowStorage();
      return storage.cleanupMigrationData();
    },
    getBrowserId: () => {
      const storage = getLinearFlowStorage();
      return storage['getBrowserId'](); // Access private method for debugging
    },
    loadLegacySessionData: () => {
      const storage = getLinearFlowStorage();
      return storage.loadLegacySessionData();
    },
    downloadBackup: (filename?: string) => {
      const storage = getLinearFlowStorage();
      storage.downloadBackup(filename);
    },
    uploadBackup: async () => {
      const storage = getLinearFlowStorage();
      return await storage.uploadBackup();
    },
  };
}

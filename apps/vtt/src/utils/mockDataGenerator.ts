/**
 * Mock Data Generator for Development Testing
 *
 * Generates realistic test data including scenes, backgrounds, drawings, and tokens
 */

import { v4 as uuidv4 } from 'uuid';
import type { Scene, PlacedToken } from '@/types/game';
import type {
  Drawing,
  LineDrawing,
  RectangleDrawing,
  CircleDrawing,
  TextDrawing,
} from '@/types/drawing';

export interface MockDataConfig {
  userId: string;
  userName: string;
}

export interface MockGameData {
  scenes: Scene[];
  drawings: Map<string, Drawing[]>; // Map of sceneId -> drawings
  tokens: Map<string, PlacedToken[]>; // Map of sceneId -> placed tokens
}

/**
 * Generate comprehensive mock game data
 */
export function generateMockGameData(config: MockDataConfig): MockGameData {
  const now = Date.now();

  // Create two scenes with different themes
  const scene1Id = uuidv4();
  const scene2Id = uuidv4();

  const scenes: Scene[] = [
    {
      id: scene1Id,
      name: 'Bandits Camp',
      description: 'A makeshift camp in a swampy jungle clearing',
      visibility: 'public',
      isEditable: true,
      createdBy: config.userId,
      roomCode: 'TEST_ROOM',
      createdAt: now,
      updatedAt: now,
      backgroundImage: {
        url: '/assets/defaults/base_maps/Shifting Swamp - Jungle',
        width: 3450,
        height: 2400,
        offsetX: 0,
        offsetY: 0,
        scale: 1.0,
      },
      gridSettings: {
        enabled: true,
        type: 'square',
        size: 50,
        color: '#ffffff',
        opacity: 0.15,
        snapToGrid: true,
        showToPlayers: true,
        offsetX: 0,
        offsetY: 0,
      },
      lightingSettings: {
        enabled: true,
        globalIllumination: false,
        ambientLight: 0.5,
        darkness: 0,
      },
      drawings: [],
      placedTokens: [],
      placedProps: [],
      isActive: true,
      playerCount: 0,
    },
    {
      id: scene2Id,
      name: 'Dank Mine',
      description: 'An abandoned mine shaft with mysterious echoes',
      visibility: 'public',
      isEditable: true,
      createdBy: config.userId,
      roomCode: 'TEST_ROOM',
      createdAt: now,
      updatedAt: now,
      backgroundImage: {
        url: '/assets/defaults/base_maps/Mine - Interior',
        width: 3000,
        height: 2200,
        offsetX: 0,
        offsetY: 0,
        scale: 1.0,
      },
      gridSettings: {
        enabled: true,
        type: 'square',
        size: 50,
        color: '#ffffff',
        opacity: 0.15,
        snapToGrid: true,
        showToPlayers: true,
        offsetX: 0,
        offsetY: 0,
      },
      lightingSettings: {
        enabled: true,
        globalIllumination: false,
        ambientLight: 0.3,
        darkness: 0.2,
      },
      drawings: [],
      placedTokens: [],
      placedProps: [],
      isActive: false,
      playerCount: 0,
    },
  ];

  // Generate drawings for each scene
  const drawings = new Map<string, Drawing[]>();

  // Scene 1 drawings - markers and areas
  const scene1Drawings: Drawing[] = [
    {
      id: uuidv4(),
      type: 'circle',
      center: { x: 800, y: 600 },
      radius: 100,
      layer: 'tokens',
      style: {
        fillColor: '#ff000044',
        fillOpacity: 0.3,
        strokeColor: '#ff0000',
        strokeWidth: 3,
        visibleToPlayers: true,
      },
      createdBy: config.userId,
      createdAt: now,
      updatedAt: now,
    } as CircleDrawing,
    {
      id: uuidv4(),
      type: 'rectangle',
      x: 1200,
      y: 800,
      width: 200,
      height: 150,
      layer: 'tokens',
      style: {
        fillColor: '#00ff0044',
        fillOpacity: 0.2,
        strokeColor: '#00ff00',
        strokeWidth: 2,
        strokeDashArray: '5,5',
        visibleToPlayers: true,
      },
      createdBy: config.userId,
      createdAt: now,
      updatedAt: now,
    } as RectangleDrawing,
    {
      id: uuidv4(),
      type: 'text',
      position: { x: 600, y: 400 },
      text: 'Camp Entrance',
      fontSize: 24,
      fontFamily: 'Arial, sans-serif',
      layer: 'overlay',
      style: {
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: '#000000',
        strokeWidth: 1,
        visibleToPlayers: true,
      },
      createdBy: config.userId,
      createdAt: now,
      updatedAt: now,
    } as TextDrawing,
    {
      id: uuidv4(),
      type: 'line',
      start: { x: 500, y: 500 },
      end: { x: 750, y: 700 },
      layer: 'tokens',
      style: {
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: '#ffff00',
        strokeWidth: 4,
        visibleToPlayers: true,
      },
      createdBy: config.userId,
      createdAt: now,
      updatedAt: now,
    } as LineDrawing,
  ];

  // Scene 2 drawings - mine hazards
  const scene2Drawings: Drawing[] = [
    {
      id: uuidv4(),
      type: 'circle',
      center: { x: 1000, y: 700 },
      radius: 80,
      layer: 'tokens',
      style: {
        fillColor: '#ff880044',
        fillOpacity: 0.4,
        strokeColor: '#ff8800',
        strokeWidth: 2,
        visibleToPlayers: true,
      },
      createdBy: config.userId,
      createdAt: now,
      updatedAt: now,
    } as CircleDrawing,
    {
      id: uuidv4(),
      type: 'text',
      position: { x: 1500, y: 900 },
      text: 'Collapsed Tunnel',
      fontSize: 20,
      fontFamily: 'Arial, sans-serif',
      layer: 'overlay',
      style: {
        fillColor: '#ffaa00',
        fillOpacity: 1,
        strokeColor: '#000000',
        strokeWidth: 1,
        visibleToPlayers: true,
      },
      createdBy: config.userId,
      createdAt: now,
      updatedAt: now,
    } as TextDrawing,
    {
      id: uuidv4(),
      type: 'rectangle',
      x: 700,
      y: 500,
      width: 150,
      height: 100,
      layer: 'dm-only',
      style: {
        fillColor: '#8800ff44',
        fillOpacity: 0.3,
        strokeColor: '#8800ff',
        strokeWidth: 3,
        strokeDashArray: '10,5',
        visibleToPlayers: false,
        dmNotesOnly: true,
      },
      createdBy: config.userId,
      createdAt: now,
      updatedAt: now,
    } as RectangleDrawing,
  ];

  drawings.set(scene1Id, scene1Drawings);
  drawings.set(scene2Id, scene2Drawings);

  // Generate tokens for each scene
  const tokens = new Map<string, PlacedToken[]>();

  // Scene 1 tokens - bandits and player characters
  const scene1Tokens: PlacedToken[] = [
    {
      id: uuidv4(),
      tokenId: 'mock-token-goblin-1',
      sceneId: scene1Id,
      roomCode: 'TEST_ROOM',
      x: 900,
      y: 650,
      rotation: 0,
      scale: 1.0,
      layer: 'tokens',
      visibleToPlayers: true,
      dmNotesOnly: false,
      conditions: [],
      placedBy: config.userId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      tokenId: 'mock-token-goblin-2',
      sceneId: scene1Id,
      roomCode: 'TEST_ROOM',
      x: 1100,
      y: 700,
      rotation: 45,
      scale: 1.0,
      layer: 'tokens',
      visibleToPlayers: true,
      dmNotesOnly: false,
      conditions: [],
      placedBy: config.userId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Scene 2 tokens - underground creatures
  const scene2Tokens: PlacedToken[] = [
    {
      id: uuidv4(),
      tokenId: 'mock-token-skeleton-1',
      sceneId: scene2Id,
      roomCode: 'TEST_ROOM',
      x: 1100,
      y: 800,
      rotation: 0,
      scale: 1.2,
      layer: 'tokens',
      visibleToPlayers: true,
      dmNotesOnly: false,
      conditions: [],
      placedBy: config.userId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  tokens.set(scene1Id, scene1Tokens);
  tokens.set(scene2Id, scene2Tokens);

  return {
    scenes,
    drawings,
    tokens,
  };
}

/**
 * Apply mock data to the linearFlowStorage (entity store)
 */
export async function applyMockDataToStorage(
  config: MockDataConfig,
): Promise<void> {
  const { getLinearFlowStorage } = await import('@/services/linearFlowStorage');
  const storage = getLinearFlowStorage();

  console.log('🎭 Generating mock game data...');
  const mockData = generateMockGameData(config);

  // Create scenes
  for (const scene of mockData.scenes) {
    await storage.createScene(scene);
    console.log(`  ✅ Created scene: ${scene.name}`);

    // Add drawings to the scene
    const sceneDrawings = mockData.drawings.get(scene.id) || [];
    for (const drawing of sceneDrawings) {
      storage.addDrawing(scene.id, drawing);
    }
    console.log(`  📐 Added ${sceneDrawings.length} drawings to ${scene.name}`);

    // Note: Tokens would be added via the token system
    // For now, we'll just log them
    const sceneTokens = mockData.tokens.get(scene.id) || [];
    console.log(`  🎯 Prepared ${sceneTokens.length} tokens for ${scene.name}`);
  }

  // Sync to gameStore
  await storage.syncScenesWithGameStore();

  console.log('✅ Mock data applied successfully');
}

/**
 * Clear all mock data from storage
 */
export async function clearMockDataFromStorage(): Promise<void> {
  const { getLinearFlowStorage } = await import('@/services/linearFlowStorage');
  const storage = getLinearFlowStorage();

  console.log('🗑️ Clearing mock game data...');
  await storage.clearGameData();
  console.log('✅ Mock data cleared');
}

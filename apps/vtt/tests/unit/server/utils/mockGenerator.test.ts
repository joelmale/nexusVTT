import { describe, it, expect } from 'vitest';
import {
  generateRandomScene,
  generateRandomCampaign,
  generateRandomCharacter,
} from '../../../../server/utils/mockGenerator';
import type { Scene } from '../../../../src/types/game';

describe('mockGenerator', () => {
  describe('generateRandomScene', () => {
    it('returns a payload assignable to the client createScene() parameter', () => {
      const scene = generateRandomScene('user-1');

      // This assignment is the actual contract check: gameStore.createScene()
      // takes Omit<Scene, 'id' | 'createdAt' | 'updatedAt' | 'roomCode'>, and the
      // server redeclares that shape structurally because tsconfig.server.json
      // excludes src/. If the Scene interface drifts, this fails to compile.
      const asClientPayload: Omit<
        Scene,
        'id' | 'createdAt' | 'updatedAt' | 'roomCode'
      > = scene;

      expect(asClientPayload.name).toBeTruthy();
      expect(asClientPayload.createdBy).toBe('user-1');
    });

    it('enables a snapped, player-visible grid so the canvas is usable immediately', () => {
      const { gridSettings } = generateRandomScene('user-1');

      expect(gridSettings.enabled).toBe(true);
      expect(gridSettings.snapToGrid).toBe(true);
      expect(gridSettings.showToPlayers).toBe(true);
      expect(gridSettings.size).toBeGreaterThan(0);
    });

    it('initialises content arrays so the client never dereferences undefined', () => {
      const scene = generateRandomScene('user-1');

      expect(scene.drawings).toEqual([]);
      expect(scene.placedTokens).toEqual([]);
      expect(scene.placedProps).toEqual([]);
    });

    it('is active and shared, and carries no background image', () => {
      const scene = generateRandomScene('user-1');

      expect(scene.isActive).toBe(true);
      expect(scene.visibility).toBe('shared');
      // A blank gridded canvas is the fastest useful surface; map generation is
      // the generator hub's job.
      expect('backgroundImage' in scene).toBe(false);
    });
  });

  describe('generateRandomCampaign', () => {
    it('attributes the campaign to the requesting user with no scenes', () => {
      const campaign = generateRandomCampaign('dm-9');

      expect(campaign.dmId).toBe('dm-9');
      expect(campaign.name).toBeTruthy();
      expect(campaign.scenes).toEqual([]);
    });
  });

  describe('generateRandomCharacter', () => {
    it('emits both sheet-style and dashboard-style shapes', () => {
      const character = generateRandomCharacter('owner-3');
      const data = character.data as Record<string, unknown>;

      expect(character.ownerId).toBe('owner-3');

      // Sheet-style (character sheet reads these)
      expect(data.abilities).toBeDefined();
      expect(data.hitPoints).toBeDefined();

      // Dashboard-style (Dashboard.tsx + PlayerCharacter read these)
      expect(data.stats).toBeDefined();
      expect(data.hp).toBeDefined();
      expect(data.xp).toBeDefined();
    });

    it('keeps the two HP representations consistent', () => {
      const data = generateRandomCharacter('owner-3').data as {
        maxHitPoints: number;
        hp: { current: number; max: number };
      };

      expect(data.hp.max).toBe(data.maxHitPoints);
      expect(data.hp.current).toBe(data.maxHitPoints);
    });
  });
});

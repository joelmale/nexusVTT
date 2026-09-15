/**
 * @file useQuickStart.ts
 * @description Orchestrates one-click dev seeding: identity -> seeded campaign
 * and character -> live room -> scene -> placed token -> canvas.
 *
 * DEV ONLY. Callers must gate their affordance on `isDevToolsEnabled()`
 * (VITE_ENABLE_DEV_TOOLS, default off).
 *
 * Step order is load-bearing:
 *   - the room must exist before the scene, because `createScene()` throws when
 *     there is no active session and injects the room code itself;
 *   - the scene must exist before the token, because `createScene()` force-
 *     initialises `placedTokens: []`, so tokens cannot be passed inline;
 *   - the character must be in `characterStore` before `autoPlaceCharacterToken`,
 *     which resolves it via `getCharacter(id)`.
 *
 * Each step reports which phase failed. A half-seeded environment (room created,
 * no scene) is more confusing than a clean failure.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyCharacter } from '@nexus/character-contracts';
import type { Character } from '@nexus/character-contracts';
import { useGameStore } from '@/stores/gameStore';
import { useCharacterStore } from '@/stores/characterStore';
import { quickStart } from '@/services/devSeed';
import { isDevToolsEnabled } from '@/utils/devMode';
import type { SeededCharacter } from '@/services/devSeed';

export type QuickStartPhase =
  | 'identity'
  | 'seeding'
  | 'room'
  | 'scene'
  | 'token'
  | 'navigating';

const GUEST_NAMES = [
  'Test DM',
  'Quickstart DM',
  'Smoke Tester',
  'Bench Warden',
];

/**
 * Merges the server's generated character `data` onto a valid empty Character
 * so the store receives a fully-shaped record.
 *
 * `createEmptyCharacter` supplies every required field; the seeded `data`
 * overrides the ones the generator produced (abilities, skills, hitPoints, …).
 */
function toStoreCharacter(seeded: SeededCharacter, playerId: string): Character {
  const base = createEmptyCharacter(playerId);
  return {
    ...base,
    ...(seeded.data as Partial<Character>),
    id: seeded.id,
    name: seeded.name,
    playerId,
  } as Character;
}

export function useQuickStart() {
  const navigate = useNavigate();
  const [isSeeding, setIsSeeding] = useState(false);
  const [phase, setPhase] = useState<QuickStartPhase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!isDevToolsEnabled() || isSeeding) return;

    setIsSeeding(true);
    setError(null);
    let current: QuickStartPhase = 'identity';
    setPhase(current);

    try {
      // 1. Identity — reuse the guest path so no login is required.
      const { isAuthenticated, setUser } = useGameStore.getState();
      if (!isAuthenticated) {
        const name =
          GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
        const response = await fetch('/api/guest-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to create guest user');
        const guestUser = await response.json();
        setUser({ ...guestUser, type: 'host' });
      }

      // 2. Seed campaign + character, and receive the scene payload.
      current = 'seeding';
      setPhase(current);
      const { campaign, character, scene } = await quickStart();

      const userId = useGameStore.getState().user.id;

      // Hydrate the character locally so step 5 can resolve it.
      useCharacterStore.setState((state) => {
        state.characters.push(toStoreCharacter(character, userId));
      });

      // 3. Room — resolves once the server emits session/created.
      current = 'room';
      setPhase(current);
      const roomCode = await useGameStore.getState().createGameRoom(
        {
          name: campaign.name,
          description: campaign.description ?? '',
          estimatedTime: '',
          campaignType: 'campaign',
          maxPlayers: 6,
          campaignId: campaign.id,
        },
        false,
      );

      // 4. Scene — needs the session from step 3.
      //
      // createGameRoom() already creates a default "Scene 1" and marks it
      // active, and createScene() only auto-activates when activeSceneId is
      // null. So the seeded scene must be activated explicitly, or the user
      // lands on the empty default and never sees the placed token.
      current = 'scene';
      setPhase(current);
      const createdScene = useGameStore.getState().createScene(scene);
      useGameStore.getState().setActiveScene(createdScene.id);

      // 5. Token — reuses the existing spawn primitive.
      //
      // Wait for the token library first: autoPlaceCharacterToken resolves the
      // art via tokenAssetManager.getDefaultTokenForCharacter(), which silently
      // falls back to an imageless placeholder when the library has not loaded
      // yet. Quick start fires on page load, so without this the race is the
      // common case and the token renders as nothing. initialize() is
      // idempotent, so this is a no-op once the library is warm.
      current = 'token';
      setPhase(current);
      const { tokenAssetManager } = await import('@/services/tokenAssets');
      await tokenAssetManager.initialize();
      await useGameStore
        .getState()
        .autoPlaceCharacterToken(character.id, createdScene.id);

      // 6. Into the canvas.
      current = 'navigating';
      setPhase(current);
      navigate(`/lobby/game/${roomCode}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Quick start failed during "${current}":`, err);
      setError(`Quick start failed during ${current}: ${message}`);
      setPhase(null);
    } finally {
      setIsSeeding(false);
    }
  }, [isSeeding, navigate]);

  return { start, isSeeding, phase, error };
}

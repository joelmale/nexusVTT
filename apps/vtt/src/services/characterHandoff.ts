import type { Character } from '@nexus/character-contracts';
import { useGameStore } from '@/stores/gameStore';
import { sendPlayerIntent } from '@/services/playerIntentClient';
import type { SubmittedCharacter } from '../../shared/events/playerIntent';

export interface CharacterHandoffOutcome {
  status: 'saved' | 'accepted';
  hasToken: boolean;
  message: string;
}

/** Account persistence and session acceptance are separate checkpoints. */
export async function handoffSavedCharacter(
  character: Character,
): Promise<CharacterHandoffOutcome> {
  const { user, session } = useGameStore.getState();
  if (!session)
    return {
      status: 'saved',
      hasToken: false,
      message: 'Character saved. Select it when joining a game.',
    };
  if (user.type !== 'host') {
    const result = await sendPlayerIntent({
      kind: 'submit-character',
      character: character as unknown as SubmittedCharacter,
    });
    if (result.status !== 'applied') {
      throw new Error(
        result.reason === 'host-offline'
          ? 'Character saved, but the DM is unavailable. Your work is retained. Retry to send this saved character to the session.'
          : 'Character saved, but the session did not accept it. Check with the DM, then retry the handoff.',
      );
    }
  }
  const { sceneState } = useGameStore.getState();
  const scene = sceneState.scenes.find(
    (entry) => entry.id === sceneState.activeSceneId,
  );
  const hasToken = Boolean(
    scene?.placedTokens.some(
      (token) => token.characterId === character.id && token.visibleToPlayers,
    ),
  );
  return {
    status: 'accepted',
    hasToken,
    message: hasToken
      ? 'Character accepted into the session. Open your sheet or focus its token.'
      : 'Character accepted into the session. Ask the DM to place a token linked to this character on the active map.',
  };
}

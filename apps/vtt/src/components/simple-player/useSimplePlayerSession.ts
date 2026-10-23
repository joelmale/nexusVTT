import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Character, Weapon } from '@nexus/character-contracts';
import {
  useDiceRoll,
  type RollMode,
} from '@/components/DiceRoller/useDiceRoll';
import {
  useMobileSessionLifecycle,
  type SimpleConnectionState,
} from '@/hooks/useMobileSessionLifecycle';
import { applyPlayerIntent } from '@/services/playerIntentApplier';
import { sendPlayerIntent } from '@/services/playerIntentClient';
import { webSocketService } from '@/services/websocket';
import { useCharacterStore } from '@/stores/characterStore';
import { useActiveScene, useDiceRolls, useGameStore } from '@/stores/gameStore';
import {
  useHandoutFeedStore,
  type RevealedHandout,
} from '@/stores/handoutFeedStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { DiceRoll, Scene } from '@/types/game';
import { getDataManager } from '@/utils/dataManager';
import { toast } from '@/utils/notifications';
import type {
  PlayerIntent,
  PlayerIntentResult,
  SubmittedCharacter,
} from '../../../shared/events/playerIntent';
import { buildSimpleCombatView, type SimpleCombatView } from './combatView';

export type PendingIntent = 'hp' | 'end-turn';

export interface SimplePlayerSession {
  userId: string;
  userName: string;
  isSpectator: boolean;
  scene: Scene | null;
  myCharacter: Character | undefined;
  sessionCharacters: Character[];
  ownedCharacterIds: ReadonlySet<string>;
  combat: SimpleCombatView;
  connectionState: SimpleConnectionState;
  visibleRolls: DiceRoll[];
  handouts: RevealedHandout[];
  spotlight: RevealedHandout | undefined;
  weapons: Weapon[];
  pendingIntent: PendingIntent | undefined;
  hostAway: boolean;
  adjustHp: (delta: number) => Promise<void>;
  endTurn: () => Promise<void>;
  deathSave: (result: 'success' | 'failure') => Promise<void>;
  claimCharacter: (characterId: string) => Promise<PlayerIntentResult>;
  submitCharacter: (character: Character) => Promise<PlayerIntentResult>;
  roll: (expression: string, mode: RollMode, label?: string) => void;
  openHandout: (id: string) => void;
  dismissSpotlight: () => void;
  leave: () => void;
}

const REJECTION_TOASTS: Record<string, string> = {
  'not-owner': "That isn't your character.",
  'not-your-turn': "It's not your turn any more.",
  invalid: 'The DM could not apply that change.',
  spectator: 'Spectators can only watch.',
};

/**
 * Everything Simple Player Mode reads from the stores, plus the player's
 * actions. Changes a player makes go to the DM's client as intents; the UI
 * shows them pending until the DM's next game-state patch arrives.
 */
export function useSimplePlayerSession(): SimplePlayerSession {
  const user = useGameStore((s) => s.user);
  const leave = useGameStore((s) => s.leaveRoom);
  const scene = useActiveScene();
  const diceRolls = useDiceRolls();
  const { roll: dispatchRoll } = useDiceRoll({ isPrivate: false });

  const characters = useCharacterStore((s) => s.characters);
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId);
  const initiative = useInitiativeStore(
    useShallow((s) => ({
      isActive: s.isActive,
      round: s.round,
      entries: s.entries,
      activeEntryId: s.activeEntryId,
    })),
  );
  const { handouts, spotlightId, openSpotlight, dismissSpotlight } =
    useHandoutFeedStore(
      useShallow((s) => ({
        handouts: s.handouts,
        spotlightId: s.spotlightId,
        openSpotlight: s.openSpotlight,
        dismissSpotlight: s.dismissSpotlight,
      })),
    );

  const [pendingIntent, setPendingIntent] = useState<PendingIntent>();
  const [hostAway, setHostAway] = useState(false);

  const userId = user.id;
  const userName = user.name;
  const isHost = user.type === 'host';
  const isSpectator = user.isSpectator ?? false;

  const owned = useMemo(
    () => characters.filter((c) => c.playerId === userId),
    [characters, userId],
  );
  const ownedCharacterIds = useMemo(
    () => new Set(owned.map((c) => c.id)),
    [owned],
  );
  const myCharacter = isSpectator
    ? undefined
    : (owned.find((c) => c.id === activeCharacterId) ?? owned[0]);

  const combat = useMemo(() => {
    const hiddenTokenIds = new Set(
      (scene?.placedTokens ?? [])
        .filter((token) => !token.visibleToPlayers)
        .map((token) => token.id),
    );
    return buildSimpleCombatView({
      ...initiative,
      userId,
      characterOwners: new Map(characters.map((c) => [c.id, c.playerId])),
      hiddenTokenIds,
    });
  }, [initiative, userId, characters, scene?.placedTokens]);

  const visibleRolls = useMemo(
    () => diceRolls.filter((r) => !r.isPrivate || r.userId === userId),
    [diceRolls, userId],
  );

  const weapons = useMemo(() => getDataManager().getWeapons(), []);

  const { connectionState } = useMobileSessionLifecycle({
    wakeLock: true,
    isSocketOpen: () => webSocketService.isConnected(),
    onResumeSession: () => webSocketService.reconnect('resume'),
  });

  const runIntent = useCallback(
    async (
      intent: PlayerIntent,
      pending?: PendingIntent,
    ): Promise<PlayerIntentResult> => {
      if (pending) setPendingIntent(pending);
      // A DM previewing Simple Mode is the host: the server never echoes an
      // intent back to its sender, so apply it locally through the same rules.
      const result = isHost
        ? applyPlayerIntent({
            intentId: `local-${Date.now()}`,
            intent,
            fromUserId: userId,
            fromUserName: userName,
          })
        : await sendPlayerIntent(intent);
      if (pending) setPendingIntent(undefined);
      setHostAway(result.reason === 'host-offline');
      if (result.status === 'rejected' && result.reason !== 'host-offline') {
        toast.error(
          REJECTION_TOASTS[result.reason ?? 'invalid'] ??
            REJECTION_TOASTS.invalid,
        );
      }
      return result;
    },
    [isHost, userId, userName],
  );

  const characterId = myCharacter?.id;
  const myCombatantId = combat.myCombatantId;

  return {
    userId,
    userName,
    isSpectator,
    scene,
    myCharacter,
    sessionCharacters: characters,
    ownedCharacterIds,
    combat,
    connectionState,
    visibleRolls,
    handouts,
    spotlight: handouts.find((h) => h.id === spotlightId),
    weapons,
    pendingIntent,
    hostAway,
    adjustHp: async (delta) => {
      if (!characterId) return;
      await runIntent({ kind: 'hp-adjust', characterId, delta }, 'hp');
    },
    endTurn: async () => {
      if (!myCombatantId) return;
      await runIntent(
        { kind: 'end-turn', combatantId: myCombatantId },
        'end-turn',
      );
    },
    deathSave: async (result) => {
      if (!characterId) return;
      await runIntent({ kind: 'death-save', characterId, result });
    },
    claimCharacter: async (id) => {
      const result = await runIntent({
        kind: 'claim-character',
        characterId: id,
      });
      if (result.status === 'applied') {
        useCharacterStore.getState().setActiveCharacter(id);
      }
      return result;
    },
    submitCharacter: (character) =>
      runIntent({
        kind: 'submit-character',
        character: character as unknown as SubmittedCharacter,
      }),
    roll: (expression, mode, label) => {
      const error = dispatchRoll(expression, mode, label);
      if (error) toast.error(error);
    },
    openHandout: openSpotlight,
    dismissSpotlight,
    leave,
  };
}

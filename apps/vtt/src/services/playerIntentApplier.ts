import type { Character } from '@nexus/character-contracts';
import { useCharacterStore } from '@/stores/characterStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useGameStore } from '@/stores/gameStore';
import { toast } from '@/utils/notifications';
import {
  isForwardedPlayerIntent,
  PLAYER_INTENT_RESULT_EVENT,
  type AddressedPlayerIntentResult,
  type ForwardedPlayerIntent,
  type PlayerIntentResult,
} from '../../shared/events/playerIntent';

/**
 * Host-side application of Simple Player Mode intents.
 *
 * Every change goes through ordinary store actions; the host's existing
 * game-state publish (gameStateSyncRuntime) then commits and broadcasts it, so
 * this module never touches the durability path directly.
 */

function ownsCharacter(character: Character | undefined, userId: string) {
  return character !== undefined && character.playerId === userId;
}

function findCharacter(characterId: string): Character | undefined {
  return useCharacterStore
    .getState()
    .characters.find((c) => c.id === characterId);
}

function linkedEntryIds(characterId: string): string[] {
  return useInitiativeStore
    .getState()
    .entries.filter((entry) => entry.characterId === characterId)
    .map((entry) => entry.id);
}

function applyHpAdjust(character: Character, delta: number): void {
  let temp = character.temporaryHitPoints ?? 0;
  let current = character.hitPoints;
  if (delta < 0) {
    const absorbed = Math.min(temp, -delta);
    temp -= absorbed;
    current += delta + absorbed;
  } else {
    current += delta;
  }
  useCharacterStore.getState().updateCharacterHP(character.id, current, temp);

  const updated = findCharacter(character.id);
  const initiative = useInitiativeStore.getState();
  for (const entryId of linkedEntryIds(character.id)) {
    initiative.updateEntry(entryId, {
      currentHP: updated?.hitPoints ?? current,
      tempHP: updated?.temporaryHitPoints ?? temp,
    });
  }
}

export function applyPlayerIntent(
  forwarded: ForwardedPlayerIntent,
): PlayerIntentResult {
  const { intentId, intent, fromUserId } = forwarded;
  const applied: PlayerIntentResult = { intentId, status: 'applied' };
  const reject = (
    reason: NonNullable<PlayerIntentResult['reason']>,
  ): PlayerIntentResult => ({ intentId, status: 'rejected', reason });

  switch (intent.kind) {
    case 'hp-adjust': {
      const character = findCharacter(intent.characterId);
      if (!ownsCharacter(character, fromUserId)) return reject('not-owner');
      applyHpAdjust(character as Character, intent.delta);
      return applied;
    }
    case 'temp-hp-set': {
      const character = findCharacter(intent.characterId);
      if (!ownsCharacter(character, fromUserId)) return reject('not-owner');
      const owned = character as Character;
      useCharacterStore
        .getState()
        .updateCharacterHP(owned.id, owned.hitPoints, intent.value);
      const initiative = useInitiativeStore.getState();
      for (const entryId of linkedEntryIds(owned.id)) {
        initiative.updateEntry(entryId, { tempHP: intent.value });
      }
      return applied;
    }
    case 'condition-toggle': {
      const character = findCharacter(intent.characterId);
      if (!ownsCharacter(character, fromUserId)) return reject('not-owner');
      const conditions = (character as Character).conditions ?? [];
      const condition = intent.condition.trim();
      const next = conditions.includes(condition)
        ? conditions.filter((c) => c !== condition)
        : [...conditions, condition];
      useCharacterStore
        .getState()
        .updateCharacter(intent.characterId, { conditions: next });
      return applied;
    }
    case 'death-save': {
      const character = findCharacter(intent.characterId);
      if (!ownsCharacter(character, fromUserId)) return reject('not-owner');
      const current = (character as Character).deathSaves ?? {
        successes: 0,
        failures: 0,
      };
      const deathSaves =
        intent.result === 'success'
          ? { ...current, successes: Math.min(3, current.successes + 1) }
          : { ...current, failures: Math.min(3, current.failures + 1) };
      useCharacterStore
        .getState()
        .updateCharacter(intent.characterId, { deathSaves });
      const initiative = useInitiativeStore.getState();
      for (const entryId of linkedEntryIds(intent.characterId)) {
        initiative.updateEntry(entryId, { deathSaves });
      }
      return applied;
    }
    case 'claim-character': {
      const character = findCharacter(intent.characterId);
      if (!character) return reject('invalid');
      if (character.playerId && character.playerId !== fromUserId) {
        return reject('not-owner');
      }
      if (character.playerId !== fromUserId) {
        useCharacterStore
          .getState()
          .updateCharacter(intent.characterId, { playerId: fromUserId });
      }
      return applied;
    }
    case 'submit-character': {
      // A character built on the player's device. It always belongs to the
      // submitter, and may only replace a character they already own.
      const existing = findCharacter(intent.character.id);
      if (existing && existing.playerId !== fromUserId) {
        return reject('not-owner');
      }
      const owned = {
        ...(intent.character as unknown as Character),
        playerId: fromUserId,
      };
      useCharacterStore.setState((state) => {
        const index = state.characters.findIndex((c) => c.id === owned.id);
        if (index >= 0) {
          state.characters[index] = owned;
        } else {
          state.characters.push(owned);
        }
      });
      return applied;
    }
    case 'end-turn': {
      const initiative = useInitiativeStore.getState();
      const entry = initiative.entries.find((e) => e.id === intent.combatantId);
      if (!entry) return reject('invalid');
      const owner =
        entry.playerId === fromUserId ||
        (entry.characterId !== undefined &&
          ownsCharacter(findCharacter(entry.characterId), fromUserId));
      if (!owner) return reject('not-owner');
      if (!initiative.isActive || initiative.activeEntryId !== entry.id) {
        return reject('not-your-turn');
      }
      initiative.nextTurn();
      return applied;
    }
  }
}

function describeIntent(forwarded: ForwardedPlayerIntent): string {
  const who = forwarded.fromUserName || 'A player';
  const { intent } = forwarded;
  switch (intent.kind) {
    case 'hp-adjust':
      return intent.delta < 0
        ? `${who}: ${intent.delta} HP`
        : `${who}: +${intent.delta} HP`;
    case 'temp-hp-set':
      return `${who}: temp HP set to ${intent.value}`;
    case 'condition-toggle':
      return `${who} toggled ${intent.condition}`;
    case 'death-save':
      return `${who}: death save ${intent.result}`;
    case 'claim-character':
      return `${who} claimed a character`;
    case 'submit-character':
      return `${who} joined as ${intent.character.name}`;
    case 'end-turn':
      return `${who} ended their turn`;
  }
}

/**
 * Entry point for a forwarded `player/intent` event. Non-hosts ignore it (the
 * server fans intents out to the whole room so it works across replicas).
 */
export async function handleForwardedPlayerIntent(
  data: unknown,
): Promise<void> {
  const { user } = useGameStore.getState();
  if (user.type !== 'host') return;
  if (!isForwardedPlayerIntent(data)) return;

  const result = applyPlayerIntent(data);
  const addressed: AddressedPlayerIntentResult = {
    ...result,
    targetUserId: data.fromUserId,
  };

  const { webSocketService } = await import('@/services/websocket');
  webSocketService.sendEvent({
    type: PLAYER_INTENT_RESULT_EVENT,
    data: addressed,
  });

  if (result.status === 'applied') {
    toast.info(describeIntent(data));
  }
}

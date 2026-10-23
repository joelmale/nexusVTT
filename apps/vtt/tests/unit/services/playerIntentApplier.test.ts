import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';

const gameState = vi.hoisted(() => ({
  user: { id: 'host1', type: 'host' as 'host' | 'player' },
}));
vi.mock('@/stores/gameStore', () => ({
  useGameStore: { getState: () => gameState },
}));

const sendEvent = vi.hoisted(() => vi.fn());
vi.mock('@/services/websocket', () => ({
  webSocketService: { sendEvent },
}));

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock('@/utils/notifications', () => ({
  toast: { info: toastInfo },
}));

vi.mock('@/services/characterSyncService', () => ({
  characterSyncService: { syncStats: vi.fn() },
}));

import { useCharacterStore } from '@/stores/characterStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import {
  applyPlayerIntent,
  handleForwardedPlayerIntent,
} from '@/services/playerIntentApplier';
import type {
  ForwardedPlayerIntent,
  PlayerIntent,
} from '../../../shared/events/playerIntent';

function character(overrides: Partial<Character>): Character {
  return {
    id: 'c1',
    name: 'Aria',
    hitPoints: 20,
    maxHitPoints: 30,
    temporaryHitPoints: 0,
    playerId: 'p1',
    ...overrides,
  } as Character;
}

function forward(
  intent: PlayerIntent,
  fromUserId = 'p1',
): ForwardedPlayerIntent {
  return { intentId: 'i1', intent, fromUserId, fromUserName: 'Mia' };
}

function getCharacter(id = 'c1') {
  return useCharacterStore.getState().characters.find((c) => c.id === id);
}

function addEntry(characterId: string, playerId?: string) {
  return useInitiativeStore.getState().addEntry({
    name: 'Aria',
    type: 'player',
    initiative: 15,
    maxHP: 30,
    currentHP: 20,
    tempHP: 0,
    armorClass: 14,
    conditions: [],
    isActive: false,
    isReady: false,
    isDelayed: false,
    characterId,
    playerId,
    notes: '',
    deathSaves: { successes: 0, failures: 0 },
    initiativeModifier: 2,
    dexterityModifier: 2,
  });
}

describe('playerIntentApplier', () => {
  beforeEach(() => {
    useInitiativeStore.getState().reset();
    useCharacterStore.setState({
      characters: [
        character({}),
        character({ id: 'c2', name: 'Bram', playerId: 'p2' }),
        character({ id: 'c3', name: 'Unclaimed', playerId: undefined }),
      ],
    });
    gameState.user = { id: 'host1', type: 'host' };
    sendEvent.mockReset();
    toastInfo.mockReset();
  });

  describe('hp-adjust', () => {
    it('applies damage to the owner and syncs linked initiative entries', () => {
      const entryId = addEntry('c1');
      const result = applyPlayerIntent(
        forward({ kind: 'hp-adjust', characterId: 'c1', delta: -5 }),
      );
      expect(result).toEqual({ intentId: 'i1', status: 'applied' });
      expect(getCharacter()?.hitPoints).toBe(15);
      const entry = useInitiativeStore
        .getState()
        .entries.find((e) => e.id === entryId);
      expect(entry?.currentHP).toBe(15);
    });

    it('drains temporary HP before current HP', () => {
      useCharacterStore.getState().updateCharacterHP('c1', 20, 4);
      applyPlayerIntent(
        forward({ kind: 'hp-adjust', characterId: 'c1', delta: -6 }),
      );
      expect(getCharacter()?.temporaryHitPoints).toBe(0);
      expect(getCharacter()?.hitPoints).toBe(18);
    });

    it('heals up to max HP', () => {
      applyPlayerIntent(
        forward({ kind: 'hp-adjust', characterId: 'c1', delta: 50 }),
      );
      expect(getCharacter()?.hitPoints).toBe(30);
    });

    it("rejects another player's character", () => {
      const result = applyPlayerIntent(
        forward({ kind: 'hp-adjust', characterId: 'c2', delta: -5 }),
      );
      expect(result).toMatchObject({ status: 'rejected', reason: 'not-owner' });
      expect(getCharacter('c2')?.hitPoints).toBe(20);
    });
  });

  it('sets temporary HP', () => {
    addEntry('c1');
    applyPlayerIntent(
      forward({ kind: 'temp-hp-set', characterId: 'c1', value: 7 }),
    );
    expect(getCharacter()?.temporaryHitPoints).toBe(7);
    expect(useInitiativeStore.getState().entries[0].tempHP).toBe(7);
  });

  it('rejects temp HP for a non-owner', () => {
    expect(
      applyPlayerIntent(
        forward({ kind: 'temp-hp-set', characterId: 'c2', value: 7 }),
      ).reason,
    ).toBe('not-owner');
  });

  it('toggles conditions on and off', () => {
    const toggle = forward({
      kind: 'condition-toggle',
      characterId: 'c1',
      condition: 'Prone',
    });
    applyPlayerIntent(toggle);
    expect(getCharacter()?.conditions).toEqual(['Prone']);
    applyPlayerIntent(toggle);
    expect(getCharacter()?.conditions).toEqual([]);
    expect(
      applyPlayerIntent(
        forward({
          kind: 'condition-toggle',
          characterId: 'c2',
          condition: 'Prone',
        }),
      ).reason,
    ).toBe('not-owner');
  });

  it('records death saves, capped at three', () => {
    addEntry('c1');
    for (let i = 0; i < 4; i += 1) {
      applyPlayerIntent(
        forward({ kind: 'death-save', characterId: 'c1', result: 'failure' }),
      );
    }
    applyPlayerIntent(
      forward({ kind: 'death-save', characterId: 'c1', result: 'success' }),
    );
    expect(getCharacter()?.deathSaves).toEqual({ successes: 1, failures: 3 });
    expect(useInitiativeStore.getState().entries[0].deathSaves).toEqual({
      successes: 1,
      failures: 3,
    });
    expect(
      applyPlayerIntent(
        forward({ kind: 'death-save', characterId: 'c2', result: 'success' }),
      ).reason,
    ).toBe('not-owner');
  });

  describe('claim-character', () => {
    it('claims an unassigned character', () => {
      const result = applyPlayerIntent(
        forward({ kind: 'claim-character', characterId: 'c3' }),
      );
      expect(result.status).toBe('applied');
      expect(getCharacter('c3')?.playerId).toBe('p1');
    });

    it('is a no-op for an already-owned character', () => {
      expect(
        applyPlayerIntent(
          forward({ kind: 'claim-character', characterId: 'c1' }),
        ).status,
      ).toBe('applied');
    });

    it("rejects claiming another player's character", () => {
      const result = applyPlayerIntent(
        forward({ kind: 'claim-character', characterId: 'c2' }),
      );
      expect(result.reason).toBe('not-owner');
      expect(getCharacter('c2')?.playerId).toBe('p2');
    });

    it('rejects an unknown character', () => {
      expect(
        applyPlayerIntent(
          forward({ kind: 'claim-character', characterId: 'missing' }),
        ).reason,
      ).toBe('invalid');
    });
  });

  describe('submit-character', () => {
    const submitted = {
      id: 'new-1',
      name: 'Pip',
      hitPoints: 9,
      abilities: {},
      playerId: 'someone-else',
    };

    it('adopts a new character, owned by the submitter', () => {
      const result = applyPlayerIntent(
        forward({ kind: 'submit-character', character: submitted }),
      );
      expect(result.status).toBe('applied');
      expect(getCharacter('new-1')).toMatchObject({
        name: 'Pip',
        playerId: 'p1',
      });
    });

    it('replaces a character the submitter already owns', () => {
      applyPlayerIntent(
        forward({
          kind: 'submit-character',
          character: { ...submitted, id: 'c1', name: 'Aria II' },
        }),
      );
      expect(getCharacter('c1')?.name).toBe('Aria II');
      expect(useCharacterStore.getState().characters).toHaveLength(3);
    });

    it("refuses to overwrite another player's character", () => {
      const result = applyPlayerIntent(
        forward({
          kind: 'submit-character',
          character: { ...submitted, id: 'c2' },
        }),
      );
      expect(result.reason).toBe('not-owner');
      expect(getCharacter('c2')?.name).toBe('Bram');
    });

    it('describes the submission to the DM', async () => {
      await handleForwardedPlayerIntent(
        forward({ kind: 'submit-character', character: submitted }),
      );
      expect(toastInfo).toHaveBeenCalledWith('Mia joined as Pip');
    });
  });

  describe('end-turn', () => {
    it('advances the turn when it is the owner’s turn', () => {
      const mine = addEntry('c1');
      const theirs = addEntry('c2');
      useInitiativeStore.getState().startCombat();
      useInitiativeStore.getState().setActiveEntry(mine);

      const result = applyPlayerIntent(
        forward({ kind: 'end-turn', combatantId: mine }),
      );
      expect(result.status).toBe('applied');
      expect(useInitiativeStore.getState().activeEntryId).toBe(theirs);
    });

    it('accepts entries owned directly by playerId', () => {
      const mine = addEntry('c-other', 'p1');
      addEntry('c2');
      useInitiativeStore.getState().startCombat();
      useInitiativeStore.getState().setActiveEntry(mine);
      expect(
        applyPlayerIntent(forward({ kind: 'end-turn', combatantId: mine }))
          .status,
      ).toBe('applied');
    });

    it('rejects when it is not the sender’s turn', () => {
      const mine = addEntry('c1');
      const theirs = addEntry('c2');
      useInitiativeStore.getState().startCombat();
      useInitiativeStore.getState().setActiveEntry(theirs);
      expect(
        applyPlayerIntent(forward({ kind: 'end-turn', combatantId: mine }))
          .reason,
      ).toBe('not-your-turn');
    });

    it('rejects ending someone else’s turn', () => {
      addEntry('c1');
      const theirs = addEntry('c2');
      useInitiativeStore.getState().startCombat();
      useInitiativeStore.getState().setActiveEntry(theirs);
      expect(
        applyPlayerIntent(forward({ kind: 'end-turn', combatantId: theirs }))
          .reason,
      ).toBe('not-owner');
    });

    it('rejects an unknown combatant', () => {
      expect(
        applyPlayerIntent(forward({ kind: 'end-turn', combatantId: 'nope' }))
          .reason,
      ).toBe('invalid');
    });
  });

  describe('handleForwardedPlayerIntent', () => {
    it('applies, replies to the sender, and notifies the DM', async () => {
      await handleForwardedPlayerIntent(
        forward({ kind: 'hp-adjust', characterId: 'c1', delta: -5 }),
      );
      expect(sendEvent).toHaveBeenCalledWith({
        type: 'player/intent-result',
        data: {
          intentId: 'i1',
          status: 'applied',
          targetUserId: 'p1',
        },
      });
      expect(toastInfo).toHaveBeenCalledWith('Mia: -5 HP');
    });

    it('replies with a rejection and no toast', async () => {
      await handleForwardedPlayerIntent(
        forward({ kind: 'hp-adjust', characterId: 'c2', delta: 3 }),
      );
      expect(sendEvent.mock.calls[0][0].data).toMatchObject({
        status: 'rejected',
        reason: 'not-owner',
      });
      expect(toastInfo).not.toHaveBeenCalled();
    });

    it.each([
      [{ kind: 'hp-adjust', characterId: 'c1', delta: 4 }, 'Mia: +4 HP'],
      [
        { kind: 'temp-hp-set', characterId: 'c1', value: 3 },
        'Mia: temp HP set to 3',
      ],
      [
        { kind: 'condition-toggle', characterId: 'c1', condition: 'Prone' },
        'Mia toggled Prone',
      ],
      [
        { kind: 'death-save', characterId: 'c1', result: 'success' },
        'Mia: death save success',
      ],
      [
        { kind: 'claim-character', characterId: 'c3' },
        'Mia claimed a character',
      ],
    ] as Array<[PlayerIntent, string]>)(
      'describes %o',
      async (intent, text) => {
        await handleForwardedPlayerIntent(forward(intent));
        expect(toastInfo).toHaveBeenCalledWith(text);
      },
    );

    it('describes an ended turn', async () => {
      const mine = addEntry('c1');
      addEntry('c2');
      useInitiativeStore.getState().startCombat();
      useInitiativeStore.getState().setActiveEntry(mine);
      await handleForwardedPlayerIntent(
        forward({ kind: 'end-turn', combatantId: mine }),
      );
      expect(toastInfo).toHaveBeenCalledWith('Mia ended their turn');
    });

    it('is ignored by non-hosts', async () => {
      gameState.user = { id: 'p2', type: 'player' };
      await handleForwardedPlayerIntent(
        forward({ kind: 'hp-adjust', characterId: 'c1', delta: -5 }),
      );
      expect(sendEvent).not.toHaveBeenCalled();
      expect(getCharacter()?.hitPoints).toBe(20);
    });

    it('ignores malformed payloads', async () => {
      await handleForwardedPlayerIntent({ intentId: 'i1' });
      expect(sendEvent).not.toHaveBeenCalled();
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  isAddressedPlayerIntentResult,
  isForwardedPlayerIntent,
  isPlayerIntent,
  isPlayerIntentMessage,
  isSubmittedCharacter,
  MAX_SUBMITTED_CHARACTER_BYTES,
  MAX_HP_DELTA,
} from '../../../shared/events/playerIntent';

describe('player intent contract', () => {
  it.each([
    { kind: 'hp-adjust', characterId: 'c1', delta: -5 },
    { kind: 'temp-hp-set', characterId: 'c1', value: 0 },
    { kind: 'condition-toggle', characterId: 'c1', condition: 'Prone' },
    { kind: 'end-turn', combatantId: 'e1' },
    { kind: 'claim-character', characterId: 'c1' },
    { kind: 'death-save', characterId: 'c1', result: 'failure' },
  ])('accepts a valid $kind intent', (intent) => {
    expect(isPlayerIntent(intent)).toBe(true);
  });

  it.each([
    null,
    'hp-adjust',
    { kind: 'unknown' },
    { kind: 'hp-adjust', characterId: 'c1', delta: 0 },
    { kind: 'hp-adjust', characterId: 'c1', delta: 1.5 },
    { kind: 'hp-adjust', characterId: 'c1', delta: MAX_HP_DELTA + 1 },
    { kind: 'hp-adjust', characterId: '', delta: 1 },
    { kind: 'hp-adjust', characterId: 'x'.repeat(129), delta: 1 },
    { kind: 'temp-hp-set', characterId: 'c1', value: -1 },
    { kind: 'condition-toggle', characterId: 'c1', condition: '  ' },
    { kind: 'condition-toggle', characterId: 'c1', condition: 'x'.repeat(65) },
    { kind: 'end-turn' },
    { kind: 'death-save', characterId: 'c1', result: 'maybe' },
  ])('rejects malformed intent %#', (intent) => {
    expect(isPlayerIntent(intent)).toBe(false);
  });

  describe('submitted characters', () => {
    const base = { id: 'c9', name: 'Pip', hitPoints: 9, abilities: {} };

    it('accepts a well-formed character', () => {
      expect(isSubmittedCharacter(base)).toBe(true);
      expect(
        isPlayerIntent({ kind: 'submit-character', character: base }),
      ).toBe(true);
    });

    it.each([
      null,
      { ...base, id: '' },
      { ...base, name: ' ' },
      { ...base, name: 'x'.repeat(101) },
      { ...base, hitPoints: -1 },
      { ...base, abilities: null },
      { ...base, notes: 'x'.repeat(MAX_SUBMITTED_CHARACTER_BYTES) },
    ])('rejects malformed character %#', (character) => {
      expect(isSubmittedCharacter(character)).toBe(false);
    });

    it('rejects values that cannot be serialized', () => {
      const cyclic: Record<string, unknown> = { ...base };
      cyclic.self = cyclic;
      expect(isSubmittedCharacter(cyclic)).toBe(false);
    });
  });

  it('requires an intent id on messages', () => {
    const intent = { kind: 'end-turn', combatantId: 'e1' };
    expect(isPlayerIntentMessage({ intentId: 'i1', intent })).toBe(true);
    expect(isPlayerIntentMessage({ intent })).toBe(false);
  });

  it('requires sender identity on forwarded intents', () => {
    const base = {
      intentId: 'i1',
      intent: { kind: 'end-turn', combatantId: 'e1' },
    };
    expect(
      isForwardedPlayerIntent({
        ...base,
        fromUserId: 'u1',
        fromUserName: 'Mia',
      }),
    ).toBe(true);
    expect(isForwardedPlayerIntent({ ...base, fromUserName: 'Mia' })).toBe(
      false,
    );
  });

  it('validates addressed results', () => {
    expect(
      isAddressedPlayerIntentResult({
        intentId: 'i1',
        targetUserId: 'u1',
        status: 'applied',
      }),
    ).toBe(true);
    expect(
      isAddressedPlayerIntentResult({
        intentId: 'i1',
        targetUserId: 'u1',
        status: 'rejected',
        reason: 'not-owner',
      }),
    ).toBe(true);
    expect(
      isAddressedPlayerIntentResult({
        intentId: 'i1',
        targetUserId: 'u1',
        status: 'applied',
        reason: 'not-owner',
      }),
    ).toBe(false);
    expect(
      isAddressedPlayerIntentResult({
        intentId: 'i1',
        targetUserId: 'u1',
        status: 'rejected',
        reason: 'bogus',
      }),
    ).toBe(false);
    expect(isAddressedPlayerIntentResult({ intentId: 'i1' })).toBe(false);
    expect(isAddressedPlayerIntentResult(null)).toBe(false);
  });
});

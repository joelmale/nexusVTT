import { describe, expect, it } from 'vitest';
import {
  getRecommendation,
  intentToClass,
} from './recommendationService';

describe('recommendationService (CC-302, CC-303)', () => {
  it('maps intents to canonical classes predictably', () => {
    expect(intentToClass('close_combat')).toBe('fighter');
    expect(intentToClass('archery')).toBe('fighter');
    expect(intentToClass('sneak')).toBe('rogue');
    expect(intentToClass('cast')).toBe('wizard');
    expect(intentToClass('support')).toBe('cleric');
  });

  it('generates a valid, complete Fighter build (2024) with first-turn guidance', () => {
    const rec = getRecommendation({
      intent: 'close_combat',
      edition: '2024',
      name: 'Valerius',
    });

    expect(rec.draft.classSlug).toBe('fighter');
    expect(rec.draft.edition).toBe('2024');
    expect(rec.draft.backgroundSlug).toBe('soldier-2024');
    expect(rec.draft.abilityBonuses).toEqual({
      method: '2/1',
      bonuses: { STR: 2, CON: 1 },
    });
    expect(rec.draft.fightingStyle).toBe('Defense');

    // Skills should not duplicate Soldier (Athletics, Intimidation)
    expect(rec.draft.skills).not.toContain('Athletics');
    expect(rec.draft.skills).not.toContain('Intimidation');
    expect(rec.draft.skills.length).toBe(2);

    // Evaluation check
    expect(rec.evaluation.isValid).toBe(true);
    expect(rec.evaluation.issues.filter(i => i.severity === 'error')).toHaveLength(0);

    // First-turn guidance check
    expect(rec.firstTurnGuidance.standardAction).toContain('Attack with your primary weapon');
    expect(rec.firstTurnGuidance.bonusAction).toContain('Second Wind');
    expect(rec.firstTurnGuidance.reaction).toContain('Opportunity Attack');
  });

  it('generates a valid stealth archer Rogue (2024 & 2014) preserving Elf and ranged weapons', () => {
    const rec24 = getRecommendation({
      intent: 'sneak',
      edition: '2024',
      name: 'Vesper',
    });

    expect(rec24.draft.classSlug).toBe('rogue');
    expect(rec24.draft.speciesSlug).toContain('elf');
    expect(rec24.draft.backgroundSlug).toBe('criminal-2024');
    expect(rec24.draft.expertise).toEqual(['Stealth', 'Sleight of Hand']);

    // Criminal skills (Sleight of Hand, Stealth) must not be duplicated in class skills
    expect(rec24.draft.skills).not.toContain('Stealth');
    expect(rec24.draft.skills).not.toContain('Sleight of Hand');
    expect(rec24.draft.skills.length).toBe(4);

    expect(rec24.evaluation.isValid).toBe(true);
    expect(rec24.firstTurnGuidance.standardAction).toContain('Shortbow');

    // 2014 Rogue
    const rec14 = getRecommendation({
      intent: 'sneak',
      edition: '2014',
      name: 'Shadow',
    });
    expect(rec14.draft.classSlug).toBe('rogue');
    expect(rec14.draft.backgroundSlug).toBe('criminal-2014');
    expect(rec14.evaluation.isValid).toBe(true);
  });

  it('generates a valid Wizard build (2024 & 2014) with starter spell package', () => {
    const rec24 = getRecommendation({
      intent: 'cast',
      edition: '2024',
      name: 'Albus',
    });

    expect(rec24.draft.classSlug).toBe('wizard');
    expect(rec24.draft.backgroundSlug).toBe('sage-2024');
    expect(rec24.draft.spells?.cantrips).toEqual([
      'fire-bolt',
      'mage-hand',
      'prestidigitation',
    ]);
    expect(rec24.draft.spells?.prepared).toEqual([
      'magic-missile',
      'shield',
      'mage-armor',
      'detect-magic',
    ]);
    expect(rec24.draft.spells?.knownOrBook).toHaveLength(6);

    expect(rec24.evaluation.isValid).toBe(true);
    expect(rec24.draft.spells?.prepared).toHaveLength(4);
    expect(rec24.firstTurnGuidance.reaction).toContain('Cast Shield');

    // 2014 Wizard
    const rec14 = getRecommendation({
      intent: 'cast',
      edition: '2014',
      name: 'Gandalf',
    });
    expect(rec14.draft.classSlug).toBe('wizard');
    expect(rec14.draft.backgroundSlug).toBe('sage-2014');
    expect(rec14.evaluation.isValid).toBe(true);
    expect(rec14.draft.spells?.prepared).toHaveLength(4);
  });

  it('generates a valid Cleric support build with healing and buffs', () => {
    const rec = getRecommendation({
      intent: 'support',
      edition: '2024',
      name: 'Lyra',
    });

    expect(rec.draft.classSlug).toBe('cleric');
    expect(rec.draft.backgroundSlug).toBe('acolyte-2024');
    expect(rec.draft.spells?.prepared).toContain('cure-wounds');
    expect(rec.draft.spells?.prepared).toContain('bless');
    expect(rec.evaluation.isValid).toBe(true);
    expect(rec.firstTurnGuidance.bonusAction).toContain('Healing Word');
  });

  it('allows explicit class bypass ("Just make a Fighter")', () => {
    const rec = getRecommendation({
      classSlug: 'fighter',
      speciesSlug: 'human-2024',
      edition: '2024',
      name: 'Marcus',
    });

    expect(rec.draft.classSlug).toBe('fighter');
    expect(rec.draft.speciesSlug).toBe('human-2024');
    expect(rec.evaluation.isValid).toBe(true);
    expect(rec.reasons.classReason).toContain('Fighter');
  });
});

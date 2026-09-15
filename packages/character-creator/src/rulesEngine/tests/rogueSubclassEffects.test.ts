/**
 * Rogue Subclass Feature Tests (2024)
 * Ensures subclass tags and level gates apply the correct features.
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import { rogueEffects } from '../content/classes/rogue';
import type { BaseFacts } from '../types/baseFacts';

const baseFacts = (): BaseFacts => ({
  level: 13,
  classSlug: 'rogue',
  classLevel: { rogue: 13 },
  subclassSlug: 'arcane-trickster',
  speciesSlug: 'human',
  lineageSlug: '',
  backgroundSlug: 'sage',
  edition: '2024',
  abilities: {
    STR: 10,
    DEX: 16,
    CON: 12,
    INT: 14,
    WIS: 10,
    CHA: 8,
  },
  choices: {},
  equippedArmor: '',
  equippedWeapons: [],
  equippedItems: [],
  conditions: [],
  tags: [],
  feats: [],
  resourceUsage: {},
});

const hasFeature = (features: { id: string }[], id: string) =>
  features.some(feature => feature.id === id);

describe('Rogue subclass effects', () => {
  it('applies Arcane Trickster features at the right levels', () => {
    const facts = baseFacts();
    facts.tags = ['subclass:arcane-trickster'];

    const derived = evaluateCharacter(facts, rogueEffects);

    expect(hasFeature(derived.features, 'arcane-trickster-spellcasting')).toBe(true);
    expect(hasFeature(derived.features, 'arcane-trickster-mage-hand-legerdemain')).toBe(true);
    expect(hasFeature(derived.features, 'arcane-trickster-magical-ambush')).toBe(true);
    expect(hasFeature(derived.features, 'arcane-trickster-versatile-trickster')).toBe(true);
    expect(hasFeature(derived.features, 'arcane-trickster-spell-thief')).toBe(false);
  });

  it('does not apply subclass features without the subclass tag', () => {
    const facts = baseFacts();
    facts.tags = [];

    const derived = evaluateCharacter(facts, rogueEffects);

    expect(hasFeature(derived.features, 'arcane-trickster-mage-hand-legerdemain')).toBe(false);
  });

  it('does not apply subclass features in 2014 rules', () => {
    const facts = baseFacts();
    facts.tags = ['subclass:arcane-trickster'];
    facts.edition = '2014';

    const derived = evaluateCharacter(facts, rogueEffects);

    expect(hasFeature(derived.features, 'arcane-trickster-mage-hand-legerdemain')).toBe(false);
  });
});

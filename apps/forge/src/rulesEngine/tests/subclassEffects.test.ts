/**
 * Subclass feature integration tests
 * Ensures subclass tags and level gates grant expected features.
 */

import { describe, it, expect } from 'vitest';
import { evaluateCharacter } from '../executors/characterExecutor';
import { bardEffects } from '../content/classes/bard';
import { artificerEffects } from '../content/classes/artificer';
import { warlockEffects } from '../content/classes/warlock';
import type { BaseFacts } from '../types/baseFacts';

const baseFacts = (overrides: Partial<BaseFacts>): BaseFacts => ({
  level: 1,
  classSlug: 'bard',
  classLevel: { bard: 1 },
  subclassSlug: 'valor',
  speciesSlug: 'human',
  lineageSlug: '',
  backgroundSlug: 'sage',
  edition: '2014',
  abilities: {
    STR: 10,
    DEX: 14,
    CON: 12,
    INT: 10,
    WIS: 10,
    CHA: 14,
  },
  choices: {},
  equippedArmor: '',
  equippedWeapons: [],
  equippedItems: [],
  conditions: [],
  tags: [],
  feats: [],
  resourceUsage: {},
  ...overrides,
});

describe('Subclass feature integration', () => {
  it('grants Valor Extra Attack at level 6', () => {
    const facts = baseFacts({
      level: 6,
      classSlug: 'bard',
      classLevel: { bard: 6 },
      subclassSlug: 'valor',
      tags: ['subclass:valor'],
    });

    const derived = evaluateCharacter(facts, bardEffects);

    expect(derived.features.some((feature) => feature.name === 'Extra Attack')).toBe(true);
    expect(derived.tags.includes('extra-attack')).toBe(true);
  });

  it('grants Armorer Extra Attack at level 5', () => {
    const facts = baseFacts({
      level: 5,
      classSlug: 'artificer',
      classLevel: { artificer: 5 },
      subclassSlug: 'armorer',
      tags: ['subclass:armorer'],
    });

    const derived = evaluateCharacter(facts, artificerEffects);

    expect(derived.features.some((feature) => feature.name === 'Extra Attack')).toBe(true);
    expect(derived.tags.includes('extra-attack')).toBe(true);
  });

  it('grants Archfey features at level 1', () => {
    const facts = baseFacts({
      level: 1,
      classSlug: 'warlock',
      classLevel: { warlock: 1 },
      subclassSlug: 'archfey',
      tags: ['subclass:archfey'],
    });

    const derived = evaluateCharacter(facts, warlockEffects);

    expect(derived.features.some((feature) => feature.name === 'Fey Presence')).toBe(true);
  });
});

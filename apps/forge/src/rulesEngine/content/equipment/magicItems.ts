/**
 * Magic Item Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Ring of Protection
 * +1 AC and +1 to all saving throws
 * Requires attunement
 */
export const ringOfProtection: SourcedEffect = {
  sourceId: 'item:ring-of-protection',
  effectId: 'ring-of-protection-effects',
  name: 'Ring of Protection',
  description: 'Grants +1 bonus to AC and saving throws while you wear this ring. Requires attunement.',
  effects: [
    // +1 AC
    {
      kind: 'armorClass',
      value: 1,
      priority: 'flag',
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:ring-of-protection' }],
    },
    // +1 to all saves
    {
      kind: 'saveBonus',
      abilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:ring-of-protection' }],
    },
  ],
};

/**
 * Cloak of Protection
 * +1 AC and +1 to all saving throws
 * Requires attunement
 */
export const cloakOfProtection: SourcedEffect = {
  sourceId: 'item:cloak-of-protection',
  effectId: 'cloak-of-protection-effects',
  name: 'Cloak of Protection',
  description: 'Grants +1 bonus to AC and saving throws while you wear this cloak. Requires attunement.',
  effects: [
    // +1 AC
    {
      kind: 'armorClass',
      value: 1,
      priority: 'flag',
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:cloak-of-protection' }],
    },
    // +1 to all saves
    {
      kind: 'saveBonus',
      abilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:cloak-of-protection' }],
    },
  ],
};

/**
 * Amulet of Health
 * CON becomes 19 if it was lower
 * Requires attunement
 */
export const amuletOfHealth: SourcedEffect = {
  sourceId: 'item:amulet-of-health',
  effectId: 'amulet-of-health-effect',
  name: 'Amulet of Health',
  description: 'Your Constitution score is 19 while you wear this amulet. It has no effect if your Constitution is already 19 or higher. Requires attunement.',
  effects: [
    {
      kind: 'abilityScoreIncrease',
      ability: 'CON',
      value: {
        expression: '19 - @abilities.CON.score',
        variables: ['@abilities.CON.score'],
      },
      priority: 'override',
      predicate: [
        { type: 'hasTag', tag: 'attuned:amulet-of-health' },
        { type: 'not', predicate: { type: 'abilityAtLeast', ability: 'CON', value: 19 } },
      ],
    },
  ],
};

/**
 * Gauntlets of Ogre Power
 * STR becomes 19 if it was lower
 * Requires attunement
 */
export const gauntletsOfOgrePower: SourcedEffect = {
  sourceId: 'item:gauntlets-ogre-power',
  effectId: 'gauntlets-ogre-power-effect',
  name: 'Gauntlets of Ogre Power',
  description: 'Your Strength score is 19 while you wear these gauntlets. They have no effect if your Strength is already 19 or higher. Requires attunement.',
  effects: [
    {
      kind: 'abilityScoreIncrease',
      ability: 'STR',
      value: {
        expression: '19 - @abilities.STR.score',
        variables: ['@abilities.STR.score'],
      },
      priority: 'override',
      predicate: [
        { type: 'hasTag', tag: 'attuned:gauntlets-ogre-power' },
        { type: 'not', predicate: { type: 'abilityAtLeast', ability: 'STR', value: 19 } },
      ],
    },
  ],
};

/**
 * Headband of Intellect
 * INT becomes 19 if it was lower
 * Requires attunement
 */
export const headbandOfIntellect: SourcedEffect = {
  sourceId: 'item:headband-of-intellect',
  effectId: 'headband-of-intellect-effect',
  name: 'Headband of Intellect',
  description: 'Your Intelligence score is 19 while you wear this headband. It has no effect if your Intelligence is already 19 or higher. Requires attunement.',
  effects: [
    {
      kind: 'abilityScoreIncrease',
      ability: 'INT',
      value: {
        expression: '19 - @abilities.INT.score',
        variables: ['@abilities.INT.score'],
      },
      priority: 'override',
      predicate: [
        { type: 'hasTag', tag: 'attuned:headband-of-intellect' },
        { type: 'not', predicate: { type: 'abilityAtLeast', ability: 'INT', value: 19 } },
      ],
    },
  ],
};

/**
 * Boots of Speed
 * Double speed as a bonus action
 * Requires attunement
 */
export const bootsOfSpeed: SourcedEffect = {
  sourceId: 'item:boots-of-speed',
  effectId: 'boots-of-speed-effect',
  name: 'Boots of Speed',
  description: 'While wearing these boots, you can use a bonus action to click your heels together, doubling your walking speed for 10 minutes. Requires attunement.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'boots-of-speed',
      name: 'Boots of Speed',
      description: 'Bonus action to double walking speed for 10 minutes.',
      predicate: [{ type: 'hasTag', tag: 'attuned:boots-of-speed' }],
    },
  ],
};

/**
 * Bracers of Defense
 * +2 AC when not wearing armor
 * Requires attunement
 */
export const bracersOfDefense: SourcedEffect = {
  sourceId: 'item:bracers-of-defense',
  effectId: 'bracers-of-defense-effect',
  name: 'Bracers of Defense',
  description: 'While wearing these bracers, you gain a +2 bonus to AC if you are wearing no armor and using no shield. Requires attunement.',
  effects: [
    {
      kind: 'armorClass',
      value: 2,
      priority: 'flag',
      stacking: 'stack',
      predicate: [
        { type: 'hasTag', tag: 'attuned:bracers-of-defense' },
        { type: 'not', predicate: { type: 'hasTag', tag: 'wearing-armor' } },
        { type: 'not', predicate: { type: 'hasTag', tag: 'wielding-shield' } },
      ],
    },
  ],
};

/**
 * Stone of Good Luck (Luckstone)
 * +1 to ability checks and saving throws
 * Requires attunement
 */
export const luckstone: SourcedEffect = {
  sourceId: 'item:luckstone',
  effectId: 'luckstone-effect',
  name: 'Stone of Good Luck',
  description: 'While this polished agate is on your person, you gain a +1 bonus to ability checks and saving throws. Requires attunement.',
  effects: [
    // +1 to all saves
    {
      kind: 'saveBonus',
      abilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    // +1 to all skills (ability checks)
    {
      kind: 'skillBonus',
      skill: 'Acrobatics',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Animal Handling',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Arcana',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Athletics',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Deception',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'History',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Insight',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Intimidation',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Investigation',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Medicine',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Nature',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Perception',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Performance',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Persuasion',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Religion',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Sleight of Hand',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Stealth',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
    {
      kind: 'skillBonus',
      skill: 'Survival',
      value: 1,
      stacking: 'stack',
      predicate: [{ type: 'hasTag', tag: 'attuned:luckstone' }],
    },
  ],
};

/**
 * Periapt of Health
 * Immunity to disease and advantage on saves against poison
 * No attunement required
 */
export const periaptOfHealth: SourcedEffect = {
  sourceId: 'item:periapt-of-health',
  effectId: 'periapt-of-health-effect',
  name: 'Periapt of Health',
  description: 'You are immune to contracting any disease while you wear this pendant. No attunement required.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'periapt-of-health',
      name: 'Periapt of Health',
      description: 'Immunity to disease.',
    },
    {
      kind: 'tag',
      tags: ['disease-immunity'],
    },
  ],
};

/**
 * All magic items
 */
export const allMagicItems: SourcedEffect[] = [
  ringOfProtection,
  cloakOfProtection,
  amuletOfHealth,
  gauntletsOfOgrePower,
  headbandOfIntellect,
  bootsOfSpeed,
  bracersOfDefense,
  luckstone,
  periaptOfHealth,
];

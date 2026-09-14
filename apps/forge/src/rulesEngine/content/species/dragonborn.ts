/**
 * Dragonborn Species Effects
 * Pure data - no game logic in code
 *
 * Dragonborn have draconic ancestry options:
 * - Chromatic: Black, Blue, Green, Red, White
 * - Metallic: Brass, Bronze, Copper, Gold, Silver
 *
 * Each ancestry grants damage resistance and breath weapon
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Dragonborn Base Traits (2024 edition)
 * Common to all dragonborn ancestries
 */
export const dragonborn2024BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:dragonborn-2024',
    effectId: 'dragonborn-languages',
    name: 'Dragonborn Languages',
    description: 'You can speak, read, and write Common and Draconic.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Draconic'],
      },
    ],
    edition: '2024',
  },

  // Speed
  {
    sourceId: 'species:dragonborn-2024',
    effectId: 'dragonborn-speed',
    name: 'Dragonborn Speed',
    description: 'Your base walking speed is 30 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 30,
      },
    ],
    edition: '2024',
  },
];

/**
 * Dragonborn Base Traits (2014 edition)
 */
export const dragonborn2014BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:dragonborn',
    effectId: 'dragonborn-languages-2014',
    name: 'Dragonborn Languages',
    description: 'You can speak, read, and write Common and Draconic.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Draconic'],
      },
    ],
    edition: '2014',
  },

  // Speed
  {
    sourceId: 'species:dragonborn',
    effectId: 'dragonborn-speed-2014',
    name: 'Dragonborn Speed',
    description: 'Your base walking speed is 30 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 30,
      },
    ],
    edition: '2014',
  },

  // Ability Score Increase (2014)
  {
    sourceId: 'species:dragonborn',
    effectId: 'dragonborn-asi-2014',
    name: 'Dragonborn Ability Score Increase',
    description: 'Your Strength score increases by 2, and your Charisma score increases by 1.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'STR',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'CHA',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * Black Dragon Ancestry
 * Damage Type: Acid
 * Breath Weapon: 5 by 30 ft. line (DEX save)
 */
export const blackDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-black',
    effectId: 'dragonborn-black-resistance',
    name: 'Draconic Resistance (Acid)',
    description: 'You have resistance to acid damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'acid',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-black',
    effectId: 'dragonborn-black-breath',
    name: 'Breath Weapon (Acid)',
    description: 'You can use your action to exhale destructive acid energy. Your draconic ancestry determines the size, shape, and damage type of the exhalation.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-acid',
        name: 'Breath Weapon (Acid)',
        description: '5 by 30 ft. line (DEX save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'acid-breath'],
      },
    ],
  },
];

/**
 * Blue Dragon Ancestry
 * Damage Type: Lightning
 * Breath Weapon: 5 by 30 ft. line (DEX save)
 */
export const blueDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-blue',
    effectId: 'dragonborn-blue-resistance',
    name: 'Draconic Resistance (Lightning)',
    description: 'You have resistance to lightning damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'lightning',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-blue',
    effectId: 'dragonborn-blue-breath',
    name: 'Breath Weapon (Lightning)',
    description: 'You can use your action to exhale destructive lightning energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-lightning',
        name: 'Breath Weapon (Lightning)',
        description: '5 by 30 ft. line (DEX save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'lightning-breath'],
      },
    ],
  },
];

/**
 * Brass Dragon Ancestry
 * Damage Type: Fire
 * Breath Weapon: 5 by 30 ft. line (DEX save)
 */
export const brassDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-brass',
    effectId: 'dragonborn-brass-resistance',
    name: 'Draconic Resistance (Fire)',
    description: 'You have resistance to fire damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'fire',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-brass',
    effectId: 'dragonborn-brass-breath',
    name: 'Breath Weapon (Fire)',
    description: 'You can use your action to exhale destructive fire energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-fire',
        name: 'Breath Weapon (Fire)',
        description: '5 by 30 ft. line (DEX save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'fire-breath'],
      },
    ],
  },
];

/**
 * Bronze Dragon Ancestry
 * Damage Type: Lightning
 * Breath Weapon: 5 by 30 ft. line (DEX save)
 */
export const bronzeDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-bronze',
    effectId: 'dragonborn-bronze-resistance',
    name: 'Draconic Resistance (Lightning)',
    description: 'You have resistance to lightning damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'lightning',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-bronze',
    effectId: 'dragonborn-bronze-breath',
    name: 'Breath Weapon (Lightning)',
    description: 'You can use your action to exhale destructive lightning energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-lightning',
        name: 'Breath Weapon (Lightning)',
        description: '5 by 30 ft. line (DEX save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'lightning-breath'],
      },
    ],
  },
];

/**
 * Copper Dragon Ancestry
 * Damage Type: Acid
 * Breath Weapon: 5 by 30 ft. line (DEX save)
 */
export const copperDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-copper',
    effectId: 'dragonborn-copper-resistance',
    name: 'Draconic Resistance (Acid)',
    description: 'You have resistance to acid damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'acid',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-copper',
    effectId: 'dragonborn-copper-breath',
    name: 'Breath Weapon (Acid)',
    description: 'You can use your action to exhale destructive acid energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-acid',
        name: 'Breath Weapon (Acid)',
        description: '5 by 30 ft. line (DEX save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'acid-breath'],
      },
    ],
  },
];

/**
 * Gold Dragon Ancestry
 * Damage Type: Fire
 * Breath Weapon: 15 ft. cone (DEX save)
 */
export const goldDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-gold',
    effectId: 'dragonborn-gold-resistance',
    name: 'Draconic Resistance (Fire)',
    description: 'You have resistance to fire damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'fire',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-gold',
    effectId: 'dragonborn-gold-breath',
    name: 'Breath Weapon (Fire)',
    description: 'You can use your action to exhale destructive fire energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-fire',
        name: 'Breath Weapon (Fire)',
        description: '15 ft. cone (DEX save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'fire-breath'],
      },
    ],
  },
];

/**
 * Green Dragon Ancestry
 * Damage Type: Poison
 * Breath Weapon: 15 ft. cone (CON save)
 */
export const greenDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-green',
    effectId: 'dragonborn-green-resistance',
    name: 'Draconic Resistance (Poison)',
    description: 'You have resistance to poison damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'poison',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-green',
    effectId: 'dragonborn-green-breath',
    name: 'Breath Weapon (Poison)',
    description: 'You can use your action to exhale destructive poison energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-poison',
        name: 'Breath Weapon (Poison)',
        description: '15 ft. cone (CON save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'poison-breath'],
      },
    ],
  },
];

/**
 * Red Dragon Ancestry
 * Damage Type: Fire
 * Breath Weapon: 15 ft. cone (DEX save)
 */
export const redDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-red',
    effectId: 'dragonborn-red-resistance',
    name: 'Draconic Resistance (Fire)',
    description: 'You have resistance to fire damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'fire',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-red',
    effectId: 'dragonborn-red-breath',
    name: 'Breath Weapon (Fire)',
    description: 'You can use your action to exhale destructive fire energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-fire',
        name: 'Breath Weapon (Fire)',
        description: '15 ft. cone (DEX save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'fire-breath'],
      },
    ],
  },
];

/**
 * Silver Dragon Ancestry
 * Damage Type: Cold
 * Breath Weapon: 15 ft. cone (CON save)
 */
export const silverDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-silver',
    effectId: 'dragonborn-silver-resistance',
    name: 'Draconic Resistance (Cold)',
    description: 'You have resistance to cold damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'cold',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-silver',
    effectId: 'dragonborn-silver-breath',
    name: 'Breath Weapon (Cold)',
    description: 'You can use your action to exhale destructive cold energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-cold',
        name: 'Breath Weapon (Cold)',
        description: '15 ft. cone (CON save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'cold-breath'],
      },
    ],
  },
];

/**
 * White Dragon Ancestry
 * Damage Type: Cold
 * Breath Weapon: 15 ft. cone (CON save)
 */
export const whiteDragonbornEffects: SourcedEffect[] = [
  {
    sourceId: 'species:dragonborn-white',
    effectId: 'dragonborn-white-resistance',
    name: 'Draconic Resistance (Cold)',
    description: 'You have resistance to cold damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'cold',
      },
    ],
  },
  {
    sourceId: 'species:dragonborn-white',
    effectId: 'dragonborn-white-breath',
    name: 'Breath Weapon (Cold)',
    description: 'You can use your action to exhale destructive cold energy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'breath-weapon-cold',
        name: 'Breath Weapon (Cold)',
        description: '15 ft. cone (CON save)',
      },
      {
        kind: 'resource',
        resourceId: 'breath-weapon',
        resourceType: 'perShortRest',
        value: 1,
      },
      {
        kind: 'tag',
        tags: ['breath-weapon', 'cold-breath'],
      },
    ],
  },
];

/**
 * Consolidated dragonborn effects by ancestry
 */
export const dragonbornEffects = {
  // 2024 ancestries
  blackDragonborn2024: [...dragonborn2024BaseEffects, ...blackDragonbornEffects],
  blueDragonborn2024: [...dragonborn2024BaseEffects, ...blueDragonbornEffects],
  brassDragonborn2024: [...dragonborn2024BaseEffects, ...brassDragonbornEffects],
  bronzeDragonborn2024: [...dragonborn2024BaseEffects, ...bronzeDragonbornEffects],
  copperDragonborn2024: [...dragonborn2024BaseEffects, ...copperDragonbornEffects],
  goldDragonborn2024: [...dragonborn2024BaseEffects, ...goldDragonbornEffects],
  greenDragonborn2024: [...dragonborn2024BaseEffects, ...greenDragonbornEffects],
  redDragonborn2024: [...dragonborn2024BaseEffects, ...redDragonbornEffects],
  silverDragonborn2024: [...dragonborn2024BaseEffects, ...silverDragonbornEffects],
  whiteDragonborn2024: [...dragonborn2024BaseEffects, ...whiteDragonbornEffects],

  // 2014 ancestries
  blackDragonborn2014: [...dragonborn2014BaseEffects, ...blackDragonbornEffects],
  blueDragonborn2014: [...dragonborn2014BaseEffects, ...blueDragonbornEffects],
  brassDragonborn2014: [...dragonborn2014BaseEffects, ...brassDragonbornEffects],
  bronzeDragonborn2014: [...dragonborn2014BaseEffects, ...bronzeDragonbornEffects],
  copperDragonborn2014: [...dragonborn2014BaseEffects, ...copperDragonbornEffects],
  goldDragonborn2014: [...dragonborn2014BaseEffects, ...goldDragonbornEffects],
  greenDragonborn2014: [...dragonborn2014BaseEffects, ...greenDragonbornEffects],
  redDragonborn2014: [...dragonborn2014BaseEffects, ...redDragonbornEffects],
  silverDragonborn2014: [...dragonborn2014BaseEffects, ...silverDragonbornEffects],
  whiteDragonborn2014: [...dragonborn2014BaseEffects, ...whiteDragonbornEffects],
};

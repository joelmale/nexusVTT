/**
 * Buff Spells
 * Pure data - no game logic in code
 *
 * Common D&D 5e spells that grant bonuses or advantages
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Bless (1st level spell)
 * +1d4 to attack rolls and saving throws
 * Concentration, up to 1 minute
 * Affects up to 3 creatures
 */
export const blessSpell: SourcedEffect = {
  sourceId: 'spell:bless',
  effectId: 'bless-effects',
  name: 'Bless',
  description: 'You bless up to three creatures of your choice. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.',
  effects: [
    {
      kind: 'saveBonus',
      abilities: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
      value: 2, // Average of 1d4 (2.5 rounded down)
      stacking: 'stack',
    },
    {
      kind: 'tag',
      tags: ['spell:bless', 'concentration'],
    },
  ],
};

/**
 * Shield of Faith (1st level spell)
 * +2 AC bonus
 * Concentration, up to 10 minutes
 */
export const shieldOfFaithSpell: SourcedEffect = {
  sourceId: 'spell:shield-of-faith',
  effectId: 'shield-of-faith-effects',
  name: 'Shield of Faith',
  description: 'A shimmering field appears and surrounds a creature of your choice, granting it a +2 bonus to AC for the duration.',
  effects: [
    {
      kind: 'armorClass',
      value: 2,
      priority: 'flag',
      stacking: 'stack',
    },
    {
      kind: 'tag',
      tags: ['spell:shield-of-faith', 'concentration'],
    },
  ],
};

/**
 * Haste (3rd level spell)
 * Double speed, +2 AC, advantage on DEX saves, extra action
 * Concentration, up to 1 minute
 */
export const hasteSpell: SourcedEffect = {
  sourceId: 'spell:haste',
  effectId: 'haste-effects',
  name: 'Haste',
  description: 'Choose a willing creature that you can see. Until the spell ends, the target\'s speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns.',
  effects: [
    {
      kind: 'speed',
      movementType: 'walk',
      value: {
        expression: '@speed.walk * 2',
        variables: ['@speed.walk'],
      },
    },
    {
      kind: 'armorClass',
      value: 2,
      priority: 'flag',
      stacking: 'stack',
    },
    {
      kind: 'saveAdvantage',
      abilities: ['DEX'],
    },
    {
      kind: 'tag',
      tags: ['spell:haste', 'concentration', 'extra-action'],
    },
  ],
};

/**
 * Mage Armor (1st level spell)
 * Base AC = 13 + DEX modifier
 * Lasts 8 hours, no concentration
 */
export const mageArmorSpell: SourcedEffect = {
  sourceId: 'spell:mage-armor',
  effectId: 'mage-armor-effects',
  name: 'Mage Armor',
  description: 'You touch a willing creature who isn\'t wearing armor, and a protective magical force surrounds it until the spell ends. The target\'s base AC becomes 13 + its Dexterity modifier.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '13 + @abilities.DEX.modifier',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [
        { type: 'not', predicate: { type: 'hasTag', tag: 'wearing-armor' } },
      ],
    },
    {
      kind: 'tag',
      tags: ['spell:mage-armor'],
    },
  ],
};

/**
 * Barkskin (2nd level spell)
 * AC cannot be less than 16
 * Concentration, up to 1 hour
 */
export const barkskinSpell: SourcedEffect = {
  sourceId: 'spell:barkskin',
  effectId: 'barkskin-effects',
  name: 'Barkskin',
  description: 'You touch a willing creature. Until the spell ends, the target\'s skin has a rough, bark-like appearance, and the target\'s AC can\'t be less than 16, regardless of what kind of armor it is wearing.',
  effects: [
    {
      kind: 'armorClass',
      value: 16,
      priority: 'additive',
      stacking: 'max',
    },
    {
      kind: 'tag',
      tags: ['spell:barkskin', 'concentration'],
    },
  ],
};

/**
 * Enlarge/Reduce (2nd level spell - Enlarge version)
 * +1d4 damage, advantage on STR checks/saves, size increase
 * Concentration, up to 1 minute
 */
export const enlargeSpell: SourcedEffect = {
  sourceId: 'spell:enlarge',
  effectId: 'enlarge-effects',
  name: 'Enlarge',
  description: 'You cause a creature to grow larger. The target\'s size doubles, and it has advantage on Strength checks and Strength saving throws. The target\'s weapons also grow, dealing an extra 1d4 damage.',
  effects: [
    {
      kind: 'saveAdvantage',
      abilities: ['STR'],
    },
    {
      kind: 'tag',
      tags: ['spell:enlarge', 'concentration', 'size-increased', 'extra-damage:1d4'],
    },
  ],
};

/**
 * Heroism (1st level spell)
 * Immune to frightened, gain temp HP each turn
 * Concentration, up to 1 minute
 */
export const heroismSpell: SourcedEffect = {
  sourceId: 'spell:heroism',
  effectId: 'heroism-effects',
  name: 'Heroism',
  description: 'A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to being frightened and gains temporary hit points equal to your spellcasting ability modifier at the start of each of its turns.',
  effects: [
    {
      kind: 'tag',
      tags: ['spell:heroism', 'concentration', 'immune:frightened', 'temp-hp-per-turn'],
    },
  ],
};

/**
 * Aid (2nd level spell)
 * +5 HP max and current HP
 * Lasts 8 hours, no concentration
 * Affects up to 3 creatures
 */
export const aidSpell: SourcedEffect = {
  sourceId: 'spell:aid',
  effectId: 'aid-effects',
  name: 'Aid',
  description: 'Your spell bolsters your allies with toughness and resolve. Choose up to three creatures. Each target\'s hit point maximum and current hit points increase by 5 for the duration.',
  effects: [
    {
      kind: 'hitPointMax',
      value: 5,
      stacking: 'stack',
    },
    {
      kind: 'tag',
      tags: ['spell:aid'],
    },
  ],
};

/**
 * Longstrider (1st level spell)
 * +10 feet speed
 * Lasts 1 hour, no concentration
 */
export const longstriderSpell: SourcedEffect = {
  sourceId: 'spell:longstrider',
  effectId: 'longstrider-effects',
  name: 'Longstrider',
  description: 'You touch a creature. The target\'s speed increases by 10 feet until the spell ends.',
  effects: [
    {
      kind: 'speed',
      movementType: 'walk',
      value: {
        expression: '@speed.walk + 10',
        variables: ['@speed.walk'],
      },
    },
    {
      kind: 'tag',
      tags: ['spell:longstrider'],
    },
  ],
};

/**
 * Jump (1st level spell)
 * Triple jump distance
 * Lasts 1 minute, no concentration
 */
export const jumpSpell: SourcedEffect = {
  sourceId: 'spell:jump',
  effectId: 'jump-effects',
  name: 'Jump',
  description: 'You touch a creature. The creature\'s jump distance is tripled until the spell ends.',
  effects: [
    {
      kind: 'tag',
      tags: ['spell:jump', 'triple-jump-distance'],
    },
  ],
};

/**
 * All buff spells
 */
export const allBuffSpells: SourcedEffect[] = [
  blessSpell,
  shieldOfFaithSpell,
  hasteSpell,
  mageArmorSpell,
  barkskinSpell,
  enlargeSpell,
  heroismSpell,
  aidSpell,
  longstriderSpell,
  jumpSpell,
];

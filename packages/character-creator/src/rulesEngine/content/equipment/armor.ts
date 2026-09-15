/**
 * Armor Equipment Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Light Armor - Padded Armor
 * AC = 11 + DEX modifier
 */
export const paddedArmor: SourcedEffect = {
  sourceId: 'item:padded-armor',
  effectId: 'padded-armor-ac',
  name: 'Padded Armor',
  description: 'AC 11 + Dex modifier. Light armor. Disadvantage on Stealth.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '11 + @abilities.DEX.modifier',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Light armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-light-armor', 'stealth-disadvantage'],
    },
  ],
};

/**
 * Light Armor - Leather Armor
 * AC = 11 + DEX modifier
 */
export const leatherArmor: SourcedEffect = {
  sourceId: 'item:leather-armor',
  effectId: 'leather-armor-ac',
  name: 'Leather Armor',
  description: 'AC 11 + Dex modifier. Light armor.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '11 + @abilities.DEX.modifier',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Light armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-light-armor'],
    },
  ],
};

/**
 * Light Armor - Studded Leather
 * AC = 12 + DEX modifier
 */
export const studdedLeatherArmor: SourcedEffect = {
  sourceId: 'item:studded-leather-armor',
  effectId: 'studded-leather-ac',
  name: 'Studded Leather Armor',
  description: 'AC 12 + Dex modifier. Light armor.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '12 + @abilities.DEX.modifier',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Light armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-light-armor'],
    },
  ],
};

/**
 * Medium Armor - Hide Armor
 * AC = 12 + DEX modifier (max 2)
 */
export const hideArmor: SourcedEffect = {
  sourceId: 'item:hide-armor',
  effectId: 'hide-armor-ac',
  name: 'Hide Armor',
  description: 'AC 12 + Dex modifier (max 2). Medium armor.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '12 + min(@abilities.DEX.modifier, 2)',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Medium armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-medium-armor'],
    },
  ],
};

/**
 * Medium Armor - Chain Shirt
 * AC = 13 + DEX modifier (max 2)
 */
export const chainShirt: SourcedEffect = {
  sourceId: 'item:chain-shirt',
  effectId: 'chain-shirt-ac',
  name: 'Chain Shirt',
  description: 'AC 13 + Dex modifier (max 2). Medium armor.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '13 + min(@abilities.DEX.modifier, 2)',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Medium armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-medium-armor'],
    },
  ],
};

/**
 * Medium Armor - Scale Mail
 * AC = 14 + DEX modifier (max 2)
 */
export const scaleMail: SourcedEffect = {
  sourceId: 'item:scale-mail',
  effectId: 'scale-mail-ac',
  name: 'Scale Mail',
  description: 'AC 14 + Dex modifier (max 2). Medium armor. Disadvantage on Stealth.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '14 + min(@abilities.DEX.modifier, 2)',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Medium armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-medium-armor', 'stealth-disadvantage'],
    },
  ],
};

/**
 * Medium Armor - Breastplate
 * AC = 14 + DEX modifier (max 2)
 */
export const breastplate: SourcedEffect = {
  sourceId: 'item:breastplate',
  effectId: 'breastplate-ac',
  name: 'Breastplate',
  description: 'AC 14 + Dex modifier (max 2). Medium armor.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '14 + min(@abilities.DEX.modifier, 2)',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Medium armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-medium-armor'],
    },
  ],
};

/**
 * Medium Armor - Half Plate
 * AC = 15 + DEX modifier (max 2)
 */
export const halfPlate: SourcedEffect = {
  sourceId: 'item:half-plate',
  effectId: 'half-plate-ac',
  name: 'Half Plate',
  description: 'AC 15 + Dex modifier (max 2). Medium armor. Disadvantage on Stealth.',
  effects: [
    {
      kind: 'armorClass',
      value: {
        expression: '15 + min(@abilities.DEX.modifier, 2)',
        variables: ['@abilities.DEX.modifier'],
      },
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Medium armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-medium-armor', 'stealth-disadvantage'],
    },
  ],
};

/**
 * Heavy Armor - Ring Mail
 * AC = 14 (no DEX bonus)
 */
export const ringMail: SourcedEffect = {
  sourceId: 'item:ring-mail',
  effectId: 'ring-mail-ac',
  name: 'Ring Mail',
  description: 'AC 14. Heavy armor. Disadvantage on Stealth.',
  effects: [
    {
      kind: 'armorClass',
      value: 14,
      priority: 'additive',
      stacking: 'max',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Heavy armor' }],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-heavy-armor', 'stealth-disadvantage'],
    },
  ],
};

/**
 * Heavy Armor - Chain Mail
 * AC = 16 (no DEX bonus)
 * Requires STR 13
 */
export const chainMail: SourcedEffect = {
  sourceId: 'item:chain-mail',
  effectId: 'chain-mail-ac',
  name: 'Chain Mail',
  description: 'AC 16. Heavy armor. Requires Str 13. Disadvantage on Stealth.',
  effects: [
    {
      kind: 'armorClass',
      value: 16,
      priority: 'additive',
      stacking: 'max',
      predicate: [
        { type: 'hasProficiency', profType: 'armor', value: 'Heavy armor' },
        { type: 'abilityAtLeast', ability: 'STR', value: 13 },
      ],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-heavy-armor', 'stealth-disadvantage'],
    },
  ],
};

/**
 * Heavy Armor - Splint Armor
 * AC = 17 (no DEX bonus)
 * Requires STR 15
 */
export const splintArmor: SourcedEffect = {
  sourceId: 'item:splint-armor',
  effectId: 'splint-armor-ac',
  name: 'Splint Armor',
  description: 'AC 17. Heavy armor. Requires Str 15. Disadvantage on Stealth.',
  effects: [
    {
      kind: 'armorClass',
      value: 17,
      priority: 'additive',
      stacking: 'max',
      predicate: [
        { type: 'hasProficiency', profType: 'armor', value: 'Heavy armor' },
        { type: 'abilityAtLeast', ability: 'STR', value: 15 },
      ],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-heavy-armor', 'stealth-disadvantage'],
    },
  ],
};

/**
 * Heavy Armor - Plate Armor
 * AC = 18 (no DEX bonus)
 * Requires STR 15
 */
export const plateArmor: SourcedEffect = {
  sourceId: 'item:plate-armor',
  effectId: 'plate-armor-ac',
  name: 'Plate Armor',
  description: 'AC 18. Heavy armor. Requires Str 15. Disadvantage on Stealth.',
  effects: [
    {
      kind: 'armorClass',
      value: 18,
      priority: 'additive',
      stacking: 'max',
      predicate: [
        { type: 'hasProficiency', profType: 'armor', value: 'Heavy armor' },
        { type: 'abilityAtLeast', ability: 'STR', value: 15 },
      ],
    },
    {
      kind: 'tag',
      tags: ['wearing-armor', 'wearing-heavy-armor', 'stealth-disadvantage'],
    },
  ],
};

/**
 * Shield
 * +2 AC bonus
 */
export const shield: SourcedEffect = {
  sourceId: 'item:shield',
  effectId: 'shield-ac-bonus',
  name: 'Shield',
  description: '+2 AC. Requires shield proficiency.',
  effects: [
    {
      kind: 'armorClass',
      value: 2,
      priority: 'flag',
      stacking: 'stack',
      predicate: [{ type: 'hasProficiency', profType: 'armor', value: 'Shields' }],
    },
    {
      kind: 'tag',
      tags: ['wielding-shield'],
    },
  ],
};

/**
 * All armor equipment
 */
export const allArmor: SourcedEffect[] = [
  // Light armor
  paddedArmor,
  leatherArmor,
  studdedLeatherArmor,
  // Medium armor
  hideArmor,
  chainShirt,
  scaleMail,
  breastplate,
  halfPlate,
  // Heavy armor
  ringMail,
  chainMail,
  splintArmor,
  plateArmor,
  // Shield
  shield,
];

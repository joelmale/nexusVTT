/**
 * Spell Slot Progression for all spellcasting classes
 * Pure data - no game logic in code
 *
 * D&D 5e has three spellcasting progression types:
 * - Full Casters (Wizard, Cleric, Druid, Bard, Sorcerer): Spell slots at 1st level
 * - Half Casters (Paladin, Ranger): Spell slots at 2nd level, slower progression
 * - Third Casters (Fighter Eldritch Knight, Rogue Arcane Trickster): Spell slots at 3rd level, slowest progression
 */

import type { SourcedEffect } from '../types/effects';

/**
 * Full caster spell slot progression (Wizard, Cleric, Druid, Bard, Sorcerer)
 * Spell slots by level: 1-9th level spells
 */
export function createFullCasterSpellSlots(classSlug: string): SourcedEffect[] {
  const slots: SourcedEffect[] = [];

  // Level 1: 2x 1st level slots
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L1`,
    name: 'Spell Slots (Level 1)',
    description: '2 first-level spell slots',
    effects: [
      {
        kind: 'spellSlots',
        level: 1,
        value: 2,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 1 }],
      },
    ],
  });

  // Level 2: 3x 1st level slots
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L2`,
    name: 'Spell Slots (Level 2)',
    description: '3 first-level spell slots',
    effects: [
      {
        kind: 'spellSlots',
        level: 1,
        value: 1, // +1 from level 1
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 2 }],
      },
    ],
  });

  // Level 3: 4x 1st, 2x 2nd
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L3`,
    name: 'Spell Slots (Level 3)',
    description: '4 first-level, 2 second-level spell slots',
    effects: [
      {
        kind: 'spellSlots',
        level: 1,
        value: 1, // +1 from level 2
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 3 }],
      },
      {
        kind: 'spellSlots',
        level: 2,
        value: 2,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 3 }],
      },
    ],
  });

  // Level 4: 4x 1st, 3x 2nd
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L4`,
    name: 'Spell Slots (Level 4)',
    description: '+1 second-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 2,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 4 }],
      },
    ],
  });

  // Level 5: 4x 1st, 3x 2nd, 2x 3rd
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L5`,
    name: 'Spell Slots (Level 5)',
    description: '2 third-level spell slots',
    effects: [
      {
        kind: 'spellSlots',
        level: 3,
        value: 2,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 5 }],
      },
    ],
  });

  // Level 6: 4x 1st, 3x 2nd, 3x 3rd
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L6`,
    name: 'Spell Slots (Level 6)',
    description: '+1 third-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 3,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 6 }],
      },
    ],
  });

  // Level 7: 4x 1st, 3x 2nd, 3x 3rd, 1x 4th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L7`,
    name: 'Spell Slots (Level 7)',
    description: '1 fourth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 4,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 7 }],
      },
    ],
  });

  // Level 8: 4x 1st, 3x 2nd, 3x 3rd, 2x 4th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L8`,
    name: 'Spell Slots (Level 8)',
    description: '+1 fourth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 4,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 8 }],
      },
    ],
  });

  // Level 9: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 1x 5th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L9`,
    name: 'Spell Slots (Level 9)',
    description: '+1 fourth-level, 1 fifth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 4,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 9 }],
      },
      {
        kind: 'spellSlots',
        level: 5,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 9 }],
      },
    ],
  });

  // Level 10: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 2x 5th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L10`,
    name: 'Spell Slots (Level 10)',
    description: '+1 fifth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 5,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 10 }],
      },
    ],
  });

  // Level 11: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 2x 5th, 1x 6th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L11`,
    name: 'Spell Slots (Level 11)',
    description: '1 sixth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 6,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 11 }],
      },
    ],
  });

  // Level 13: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 2x 5th, 1x 6th, 1x 7th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L13`,
    name: 'Spell Slots (Level 13)',
    description: '1 seventh-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 7,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 13 }],
      },
    ],
  });

  // Level 15: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 2x 5th, 1x 6th, 1x 7th, 1x 8th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L15`,
    name: 'Spell Slots (Level 15)',
    description: '1 eighth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 8,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 15 }],
      },
    ],
  });

  // Level 17: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 2x 5th, 1x 6th, 1x 7th, 1x 8th, 1x 9th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L17`,
    name: 'Spell Slots (Level 17)',
    description: '1 ninth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 9,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 17 }],
      },
    ],
  });

  // Level 18: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 3x 5th, 1x 6th, 1x 7th, 1x 8th, 1x 9th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L18`,
    name: 'Spell Slots (Level 18)',
    description: '+1 fifth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 5,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 18 }],
      },
    ],
  });

  // Level 19: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 3x 5th, 2x 6th, 1x 7th, 1x 8th, 1x 9th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L19`,
    name: 'Spell Slots (Level 19)',
    description: '+1 sixth-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 6,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 19 }],
      },
    ],
  });

  // Level 20: 4x 1st, 3x 2nd, 3x 3rd, 3x 4th, 3x 5th, 2x 6th, 2x 7th, 1x 8th, 1x 9th
  slots.push({
    sourceId: `class:${classSlug}`,
    effectId: `${classSlug}-slots-L20`,
    name: 'Spell Slots (Level 20)',
    description: '+1 seventh-level spell slot',
    effects: [
      {
        kind: 'spellSlots',
        level: 7,
        value: 1,
        stacking: 'stack',
        predicate: [{ type: 'classLevelAtLeast', classSlug, level: 20 }],
      },
    ],
  });

  return slots;
}

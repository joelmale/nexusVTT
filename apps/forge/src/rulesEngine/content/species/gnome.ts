/**
 * Gnome Species Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Gnome base species effects (both editions)
 */
export const gnomeEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:gnome',
    effectId: 'gnome-languages',
    name: 'Gnome Languages',
    description: 'You can speak, read, and write Common and Gnomish.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Gnomish'],
      },
    ],
    edition: 'both',
  },

  // Speed
  {
    sourceId: 'species:gnome',
    effectId: 'gnome-speed',
    name: 'Gnome Speed',
    description: 'Your base walking speed is 30 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 30,
      },
    ],
    edition: 'both',
  },

  // Darkvision
  {
    sourceId: 'species:gnome',
    effectId: 'gnome-darkvision',
    name: 'Darkvision',
    description: 'You can see in dim light within 60 feet of you as if it were bright light.',
    effects: [
      {
        kind: 'sense',
        senseType: 'darkvision',
        range: 60,
      },
    ],
    edition: 'both',
  },

  // Gnomish Cunning (advantage on INT/WIS/CHA saves)
  {
    sourceId: 'species:gnome',
    effectId: 'gnomish-cunning',
    name: 'Gnome Cunning',
    description:
      'You have advantage on Intelligence, Wisdom, and Charisma saving throws against magic.',
    effects: [
      {
        kind: 'saveAdvantage',
        abilities: ['INT', 'WIS', 'CHA'],
        // Note: Should technically have predicate for "against magic"
        // but that requires condition tracking system from later phases
      },
      {
        kind: 'tag',
        tags: ['gnome-cunning'],
      },
    ],
    edition: 'both',
  },

  // 2014 Edition: Intelligence +2
  {
    sourceId: 'species:gnome',
    effectId: 'gnome-ability-bonus-2014',
    name: 'Gnome Ability Score Increase',
    description: 'Your Intelligence score increases by 2.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'INT',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * Forest Gnome lineage effects
 */
export const forestGnomeEffects: SourcedEffect[] = [
  {
    sourceId: 'lineage:forest-gnome',
    effectId: 'forest-gnome-spells',
    name: 'Forest Gnome Magic',
    description: 'You know the Minor Illusion cantrip and can cast Speak with Animals once per long rest.',
    effects: [
      {
        kind: 'grantSpell',
        spellSlug: 'minor-illusion',
        spellcastingType: 'innate',
        usesSpellSlot: false,
      },
      {
        kind: 'grantSpell',
        spellSlug: 'speak-with-animals',
        spellcastingType: 'innate',
        usesSpellSlot: false,
      },
    ],
    edition: 'both',
  },

  // 2014: Dexterity +1
  {
    sourceId: 'lineage:forest-gnome',
    effectId: 'forest-gnome-ability-2014',
    name: 'Forest Gnome Ability Increase',
    description: 'Your Dexterity score increases by 1.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'DEX',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * Rock Gnome lineage effects
 */
export const rockGnomeEffects: SourcedEffect[] = [
  {
    sourceId: 'lineage:rock-gnome',
    effectId: 'rock-gnome-spells',
    name: 'Rock Gnome Magic',
    description: 'You know the Mending and Prestidigitation cantrips.',
    effects: [
      {
        kind: 'grantSpell',
        spellSlug: 'mending',
        spellcastingType: 'innate',
        usesSpellSlot: false,
      },
      {
        kind: 'grantSpell',
        spellSlug: 'prestidigitation',
        spellcastingType: 'innate',
        usesSpellSlot: false,
      },
    ],
    edition: 'both',
  },

  {
    sourceId: 'lineage:rock-gnome',
    effectId: 'rock-gnome-clockwork',
    name: 'Clockwork Devices',
    description: 'You can create tiny mechanical devices.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'clockwork-devices',
        name: 'Clockwork Devices',
        description:
          'You can create tiny mechanical devices. These devices work for 24 hours, after which they fall apart.',
      },
      {
        kind: 'tag',
        tags: ['artificer-flavor'],
      },
    ],
    edition: 'both',
  },

  // 2014: Constitution +1
  {
    sourceId: 'lineage:rock-gnome',
    effectId: 'rock-gnome-ability-2014',
    name: 'Rock Gnome Ability Increase',
    description: 'Your Constitution score increases by 1.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'CON',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

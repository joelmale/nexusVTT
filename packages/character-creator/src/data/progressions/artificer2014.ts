import type { ClassProgression } from '../classProgression';

/** User-supplied legacy reference, accessed 2026-10-27:
 * https://dnd5e.wikidot.com/artificer
 * Numeric progression and feature identities; no revised/UA substitutions. */
export const ARTIFICER_LEGACY_INFUSIONS = [
  0, 4, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12,
];
export const ARTIFICER_LEGACY_ITEMS = [
  0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6,
];
export const ARTIFICER_LEGACY_CANTRIPS = [
  2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4,
];
const features: Array<[number, string]> = [
  [1, 'Magical Tinkering'],
  [1, 'Spellcasting'],
  [2, 'Infuse Item'],
  [3, 'Artificer Specialist'],
  [3, 'The Right Tool for the Job'],
  [5, 'Artificer Specialist Feature'],
  [6, 'Tool Expertise'],
  [7, 'Flash of Genius'],
  [9, 'Artificer Specialist Feature'],
  [10, 'Magic Item Adept'],
  [11, 'Spell-Storing Item'],
  [14, 'Magic Item Savant'],
  [15, 'Artificer Specialist Feature'],
  [18, 'Magic Item Master'],
  [20, 'Soul of Artifice'],
];
export const artificer2014Progression: ClassProgression = {
  classSlug: 'artificer',
  className: 'Artificer',
  edition: '2014',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    ...features.map(([level, name]) => ({
      level,
      name,
      description:
        'Legacy Artificer feature; use its source-defined choices and conditional effects.',
      automatic: name !== 'Artificer Specialist',
      choices:
        name === 'Artificer Specialist'
          ? [
              {
                type: 'subclass' as const,
                count: 1,
                description: 'Choose a legacy Artificer specialist.',
              },
            ]
          : undefined,
    })),
    ...[4, 8, 12, 16, 19].map((level) => ({
      level,
      name: 'Ability Score Improvement',
      description: 'Choose an ability increase or eligible feat.',
      automatic: false,
      choices: [
        {
          type: 'asi' as const,
          count: 2,
          description: 'Allocate two ability points or choose a feat.',
        },
      ],
    })),
  ].sort((a, b) => a.level - b.level),
};

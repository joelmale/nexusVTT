import type { ClassLevelFeature, ClassProgression } from '../classProgression';
import { invocationCount } from '../../services/invocations';

// SRD 5.2.1 pp71–72. These are additional choices gained at each class level.
const invocationFeatures: ClassLevelFeature[] = Array.from(
  { length: 20 },
  (_, index) => {
    const level = index + 1;
    const count = invocationCount(level) - invocationCount(level - 1);
    return count > 0
      ? [
          {
            level,
            name: 'Eldritch Invocations',
            description: `Gain ${count} invocation choices.`,
            automatic: false,
            choices: [
              {
                type: 'invocation' as const,
                description: 'Choose eligible invocations.',
                count,
              },
            ],
          },
        ]
      : [];
  },
).flat();

const asiFeatures: ClassLevelFeature[] = [4, 8, 12, 16].map((level) => ({
  level,
  name: 'Ability Score Improvement',
  description: 'Choose an eligible feat or ability increase.',
  automatic: false,
  choices: [
    {
      type: 'asi',
      description:
        'Assign two ability increase points or choose an eligible feat.',
      count: 2,
    },
  ],
}));

export const warlock2024Progression: ClassProgression = {
  classSlug: 'warlock',
  className: 'Warlock',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: (
    [
      ...invocationFeatures,
      ...asiFeatures,
      {
        level: 1,
        name: 'Pact Magic',
        description: 'Charisma-based casting with Pact Magic slots.',
        automatic: true,
      },
      {
        level: 2,
        name: 'Magical Cunning',
        description:
          'Recover up to half your Pact Magic slots, rounded up, through a one-minute rite.',
        automatic: true,
        resources: [
          {
            id: 'magical-cunning',
            name: 'Magical Cunning',
            description: 'One-minute Pact Magic recovery rite',
            maxUses: 1,
            rechargeType: 'long-rest',
          },
        ],
      },
      {
        level: 3,
        name: 'Warlock Subclass',
        description: 'Choose your patron subclass.',
        automatic: false,
        choices: [
          {
            type: 'subclass',
            description: 'Choose an available Warlock subclass.',
            count: 1,
          },
        ],
      },
      ...[6, 10, 14].map((level): ClassLevelFeature => ({
        level,
        name: 'Subclass Feature',
        description: 'Apply the feature from your chosen subclass.',
        automatic: true,
      })),
      {
        level: 9,
        name: 'Contact Patron',
        description:
          'Contact Other Plane is always prepared, with one free patron contact per Long Rest.',
        automatic: true,
        resources: [
          {
            id: 'contact-patron',
            name: 'Contact Patron',
            description: 'Free patron contact',
            maxUses: 1,
            rechargeType: 'long-rest',
          },
        ],
      },
      ...[11, 13, 15, 17].map((level, index): ClassLevelFeature => ({
        level,
        name: `Mystic Arcanum (level ${index + 6})`,
        description: `Choose a level ${index + 6} Warlock arcanum.`,
        automatic: false,
        choices: [
          {
            type: 'spell-mastery',
            description: `Choose one level ${index + 6} Warlock spell.`,
            count: 1,
          },
        ],
        resources: [
          {
            id: `mystic-arcanum-${index + 6}`,
            name: `Mystic Arcanum (level ${index + 6})`,
            description: 'Free arcanum casting',
            maxUses: 1,
            rechargeType: 'long-rest',
          },
        ],
      })),
      {
        level: 19,
        name: 'Epic Boon',
        description: 'Choose an eligible Epic Boon or other eligible feat.',
        automatic: false,
        choices: [
          { type: 'feat', description: 'Choose an eligible feat.', count: 1 },
        ],
      },
      {
        level: 20,
        name: 'Eldritch Master',
        description:
          'Magical Cunning now restores all expended Pact Magic slots.',
        automatic: true,
      },
    ] satisfies ClassLevelFeature[]
  ).sort((left, right) => left.level - right.level),
};

import { describe, it, expect } from 'vitest';
import { monsterDefinitionSchema } from '../src';
import { mockGoblinMonster } from './fixtures';

describe('MonsterDefinition Schema', () => {
  it('validates a complete monster definition', () => {
    const parsed = monsterDefinitionSchema.parse(mockGoblinMonster);
    expect(parsed.name).toBe('Goblin Skirmisher');
    expect(parsed.challengeRating).toBe(0.25);
    expect(parsed.armorClass[0].value).toBe(15);
    expect(parsed.actions[0].name).toBe('Scimitar');
    expect(parsed.specialAbilities[0].name).toBe('Nimble Escape');
  });

  it('validates dragons with recharge actions and legendary actions', () => {
    const dragon = {
      ...mockGoblinMonster,
      id: '99999999-9999-4999-8999-999999999999',
      name: 'Young Red Dragon',
      size: 'Large' as const,
      monsterType: 'dragon' as const,
      challengeRating: 10,
      experiencePoints: 5900,
      hitPoints: { average: 178, roll: '17d10 + 85' },
      actions: [
        {
          id: 'fire-breath',
          name: 'Fire Breath',
          description: 'Exhales fire in a 30-foot cone.',
          saveDC: {
            ability: 'DEX' as const,
            dc: 17,
            success: 'half' as const,
          },
          damage: [{ dice: '16d6', type: 'fire' }],
          recharge: {
            minRoll: 5,
            currentCharged: true,
          },
        },
      ],
      legendaryActions: {
        actionsPerRound: 3,
        actions: [
          {
            id: 'wing-attack',
            name: 'Wing Attack',
            description: 'The dragon beats its wings.',
          },
        ],
      },
    };

    const parsed = monsterDefinitionSchema.parse(dragon);
    expect(parsed.actions[0].recharge?.minRoll).toBe(5);
    expect(parsed.legendaryActions?.actionsPerRound).toBe(3);
  });
});

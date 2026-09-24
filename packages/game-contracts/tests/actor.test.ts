import { describe, it, expect } from 'vitest';
import { campaignActorSchema } from '../src';
import { mockCampaignActor, mockGoblinMonster } from './fixtures';

describe('CampaignActor Schema', () => {
  it('validates a complete PC campaign actor', () => {
    const parsed = campaignActorSchema.parse(mockCampaignActor);
    expect(parsed.name).toBe('Valeros the Fighter');
    expect(parsed.actorKind).toBe('pc');
    expect(parsed.stateVersion).toBe(1);
    expect(parsed.hp.current).toBe(49);
    expect(parsed.pcPayload?.level).toBe(5);
  });

  it('validates a Monster campaign actor instance with independent runtime HP', () => {
    const goblinActor = {
      campaignActorId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      campaignId: '99999999-9999-4999-8999-999999999999',
      name: 'Goblin Skirmisher #1',
      actorKind: 'monster' as const,
      sourceRef: {
        kind: 'monster' as const,
        id: mockGoblinMonster.id,
        revision: 1,
      },
      ruleset: mockGoblinMonster.ruleset,
      stateVersion: 1,
      controllerUserIds: ['dm-1'],
      hp: {
        current: 5, // Damaged from original 7
        max: 7,
        temp: 0,
      },
      deathSaves: { successes: 0, failures: 0 },
      conditions: ['poisoned'],
      monsterPayload: {
        size: 'Small',
        monsterType: 'humanoid',
        challengeRating: 0.25,
        armorClass: mockGoblinMonster.armorClass,
        speed: mockGoblinMonster.speed,
        abilities: mockGoblinMonster.abilities,
        actions: mockGoblinMonster.actions,
      },
      createdAt: '2026-09-24T00:00:00Z',
      updatedAt: '2026-09-24T00:00:00Z',
    };

    const parsed = campaignActorSchema.parse(goblinActor);
    expect(parsed.actorKind).toBe('monster');
    expect(parsed.hp.current).toBe(5);
    expect(parsed.conditions).toContain('poisoned');
  });
});

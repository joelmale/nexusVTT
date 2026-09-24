import { describe, it, expect } from 'vitest';
import { encounterTemplateSchema, encounterRunSchema } from '../src';
import { mockEncounterTemplate } from './fixtures';

describe('EncounterTemplate & EncounterRun Schemas', () => {
  it('validates a complete encounter template with grouped monsters', () => {
    const parsed = encounterTemplateSchema.parse(mockEncounterTemplate);
    expect(parsed.name).toBe('Goblin Ambush at Bridge');
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].count).toBe(3);
    expect(parsed.groups[0].faction).toBe('hostile');
  });

  it('validates an encounter run deployed in a campaign session', () => {
    const run = {
      runId: '12121212-1212-4212-8212-121212121212',
      campaignId: mockEncounterTemplate.campaignId!,
      templateRef: {
        kind: 'encounter' as const,
        id: mockEncounterTemplate.id,
        revision: 1,
      },
      stage: 'active' as const,
      deploymentCommandId: '34343434-3434-4434-8434-343434343434',
      currentRound: 2,
      currentTurnIndex: 1,
      activeWaveIndex: 0,
      participants: [
        {
          actorId: '77777777-7777-4777-8777-777777777777',
          initiativeRoll: 18,
          tieBreaker: 14,
          hasActedThisRound: true,
          reactionUsed: false,
        },
        {
          actorId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          initiativeRoll: 12,
          tieBreaker: 14,
          hasActedThisRound: false,
          reactionUsed: true,
        },
      ],
      createdAt: '2026-09-24T00:00:00Z',
      updatedAt: '2026-09-24T00:00:00Z',
    };

    const parsed = encounterRunSchema.parse(run);
    expect(parsed.stage).toBe('active');
    expect(parsed.currentRound).toBe(2);
    expect(parsed.participants).toHaveLength(2);
    expect(parsed.participants[0].hasActedThisRound).toBe(true);
  });
});

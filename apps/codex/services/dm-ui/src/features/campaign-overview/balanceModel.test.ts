import { describe, expect, it } from 'vitest';

import { getFixtureBundle, type CampaignFixtureBundle } from '@/demo/fixture-registry';
import { buildBalanceModel } from './balanceModel';

describe('balanceModel', () => {
  const baseBundle = getFixtureBundle('stars-below-kharad', 'test')!;

  it('builds a balance model for the active session with party levels and encounters', () => {
    const model = buildBalanceModel(baseBundle);

    expect(model.partySize).toBeGreaterThan(0);
    expect(model.averageLevel).toBeGreaterThan(0);
    expect(model.encounters.length).toBeGreaterThan(0);
    expect(model.budgetPerEncounter.high).toBeGreaterThan(0);
    expect(model.dailyXpBudget).toBeGreaterThan(0);
    expect(model.wealth).toBeDefined();
    expect(model.healthStatus).toBeDefined();
  });

  it('generates a warning when an encounter is deadly', () => {
    const deadlyBundle: CampaignFixtureBundle = {
      ...baseBundle,
      encounters: [
        {
          id: 'enc-deadly',
          campaignId: baseBundle.campaignId,
          title: 'Ancient Red Dragon Surprise',
          summary: 'A dragon attacks',
          kind: 'combat',
          difficulty: 'high',
          trigger: 'Immediate',
          locationIds: [],
          npcIds: [],
          factionIds: [],
          sessionIds: [baseBundle.sessions[0].id],
          composition: [
            {
              monsterKey: 'srd:ancient-red-dragon',
              name: 'Ancient Red Dragon',
              count: 1,
              cr: '24',
            },
          ],
        },
      ],
    };

    const model = buildBalanceModel(deadlyBundle, baseBundle.sessions[0].id);

    expect(model.highestRating).toBe('deadly');
    expect(model.healthStatus).toBe('danger');
    expect(
      model.warnings.some((w) => w.includes('High lethal risk') && w.includes('Ancient Red Dragon Surprise')),
    ).toBe(true);
  });

  it('generates a warning when combined encounters exceed daily XP budget', () => {
    const highLoadBundle: CampaignFixtureBundle = {
      ...baseBundle,
      encounters: [
        {
          id: 'enc-1',
          campaignId: baseBundle.campaignId,
          title: 'Wave 1',
          kind: 'combat',
          difficulty: 'high',
          locationIds: [],
          npcIds: [],
          factionIds: [],
          sessionIds: [baseBundle.sessions[0].id],
          composition: [
            {
              name: 'Ogre Brute',
              count: 4,
              cr: '2',
            },
          ],
        },
        {
          id: 'enc-2',
          campaignId: baseBundle.campaignId,
          title: 'Wave 2',
          kind: 'combat',
          difficulty: 'high',
          locationIds: [],
          npcIds: [],
          factionIds: [],
          sessionIds: [baseBundle.sessions[0].id],
          composition: [
            {
              name: 'Troll Vanguard',
              count: 4,
              cr: '5',
            },
          ],
        },
        {
          id: 'enc-3',
          campaignId: baseBundle.campaignId,
          title: 'Wave 3',
          kind: 'combat',
          difficulty: 'high',
          locationIds: [],
          npcIds: [],
          factionIds: [],
          sessionIds: [baseBundle.sessions[0].id],
          composition: [
            {
              name: 'Giant Chief',
              count: 8,
              cr: '7',
            },
            {
              name: 'Troll Vanguard',
              count: 6,
              cr: '5',
            },
          ],
        },
      ],
    };

    const model = buildBalanceModel(highLoadBundle, baseBundle.sessions[0].id);

    expect(model.totalEncounterXp).toBeGreaterThan(model.dailyXpBudget);
    expect(
      model.warnings.some((w) => w.includes('High stamina drain') && w.includes('daily XP budget')),
    ).toBe(true);
  });

  it('evaluates party wealth against expected tier range and warns on deficit', () => {
    const lowWealthBundle: CampaignFixtureBundle = {
      ...baseBundle,
      items: [
        {
          id: 'item-penny',
          campaignId: baseBundle.campaignId,
          name: 'Rusty Spoon',
          itemType: 'other',
          rarity: 'common',
          requiresAttunement: false,
          valueGp: 1,
          quantity: 1,
          description: 'A rusty spoon',
          holder: { kind: 'none' },
          discovered: true,
          identified: true,
          questIds: [],
        },
      ],
    };

    const model = buildBalanceModel(lowWealthBundle);

    expect(model.wealth.totalGp).toBe(1);
    expect(model.wealth.status).toBe('below');
    expect(
      model.warnings.some((w) => w.includes('Treasure deficit')),
    ).toBe(true);
  });

  it('handles fallback bundle with no party gracefully', () => {
    const blankBundle: CampaignFixtureBundle = {
      ...baseBundle,
      campaign: {
        ...baseBundle.campaign,
        playerCharacters: [],
      },
      catalog: {
        ...baseBundle.catalog,
        playerCharacters: [],
      },
      encounters: [],
      items: [],
    };

    const model = buildBalanceModel(blankBundle);

    expect(model.partySize).toBe(4); // Default 4 members
    expect(model.averageLevel).toBe(1);
    expect(model.encounters).toHaveLength(0);
    expect(model.totalEncounterXp).toBe(0);
    expect(model.budgetPerEncounter.high).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';

import { SRD_MONSTERS } from '@/data/srdMonsters';
import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  FALLBACK_SRD_ITEMS_2014,
  FALLBACK_SRD_ITEMS_2024,
} from '@/features/items/srdFallbackCatalog';

import {
  buildCompendiumObjects,
  buildSessionPlanModel,
  findPlannedSession,
} from '../buildSessionPlanModel';

const ASHES = getFixtureBundle('ashes-of-veyra')!;

describe('buildSessionPlanModel', () => {
  it('builds a comprehensive compendium list from SRD monsters, homebrew monsters, SRD fallback items, and campaign items', () => {
    const compendium = buildCompendiumObjects({
      campaign: { ...ASHES.campaign, edition: '2024' },
      catalog: ASHES.catalog,
      homebrewMonsters: [
        {
          id: 'ash-wraith',
          campaignId: ASHES.campaignId,
          name: 'Ash Wraith',
          size: 'Medium',
          type: 'undead',
          cr: '5',
          ac: 15,
          hp: 75,
          speed: 40,
          abilities: [10, 16, 14, 12, 14, 16],
          edition: '2024',
          notes: 'Incorporeal',
        },
        {
          id: 'homebrew-cinder-hound',
          campaignId: ASHES.campaignId,
          name: 'Cinder Hound',
          size: 'Medium',
          type: 'fiend',
          cr: '2',
          ac: 13,
          hp: 38,
          speed: 50,
          abilities: [15, 14, 14, 6, 12, 7],
          edition: '2024',
          notes: 'Pack tactics',
        },
      ],
      items: [
        {
          id: 'item-veyra-signet',
          campaignId: ASHES.campaignId,
          name: 'Signet of Veyra',
          itemType: 'wondrous_item',
          rarity: 'rare',
          requiresAttunement: true,
          quantity: 1,
          description: 'Opens the harbor vault.',
          holder: { kind: 'none' },
          discovered: false,
          identified: true,
          questIds: [],
        },
        {
          id: 'item-iron-spike',
          campaignId: ASHES.campaignId,
          name: 'Iron Spike',
          itemType: 'adventuring_gear',
          rarity: 'none',
          requiresAttunement: false,
          quantity: 5,
          description: 'Simple iron wedge.',
          holder: { kind: 'none' },
          discovered: true,
          identified: true,
          questIds: [],
        },
      ],
    });

    expect(compendium.length).toBe(
      2 + 2 + SRD_MONSTERS.length + FALLBACK_SRD_ITEMS_2024.length,
    );

    expect(compendium.find((item) => item.id === 'homebrew-ash-wraith')).toEqual(
      {
        id: 'homebrew-ash-wraith',
        title: 'Ash Wraith',
        subtitle: 'CR 5 undead',
        type: 'encounter',
      },
    );

    expect(
      compendium.find((item) => item.id === 'homebrew-cinder-hound'),
    ).toEqual({
      id: 'homebrew-cinder-hound',
      title: 'Cinder Hound',
      subtitle: 'CR 2 fiend',
      type: 'encounter',
    });

    expect(compendium.find((item) => item.id === 'item-veyra-signet')).toEqual({
      id: 'item-veyra-signet',
      title: 'Signet of Veyra',
      subtitle: 'Wondrous item · Rare',
      type: 'handout',
    });

    expect(compendium.find((item) => item.id === 'item-iron-spike')).toEqual({
      id: 'item-iron-spike',
      title: 'Iron Spike',
      subtitle: 'Adventuring gear',
      type: 'handout',
    });

    expect(compendium.find((item) => item.id === 'srd-bandit')).toEqual({
      id: 'srd-bandit',
      title: 'Bandit',
      subtitle: 'CR 1/8 humanoid',
      type: 'encounter',
    });

    expect(
      compendium.find((item) => item.id === 'srd-2024-bag-holding'),
    ).toEqual({
      id: 'srd-2024-bag-holding',
      title: 'Bag of Holding',
      subtitle: 'Wondrous item · Uncommon',
      type: 'handout',
    });
  });

  it('uses the 2014 SRD item catalog when the campaign edition is 2014', () => {
    const compendium2014 = buildCompendiumObjects({
      campaign: { ...ASHES.campaign, edition: '5e 2014 (5.1)' },
    });

    expect(compendium2014.length).toBe(
      SRD_MONSTERS.length + FALLBACK_SRD_ITEMS_2014.length,
    );
    expect(
      compendium2014.some((item) => item.id === 'srd-2014-bag-holding'),
    ).toBe(true);
  });

  it('keeps linked player handout contents separate from run-sheet instructions', () => {
    const session = structuredClone(ASHES.sessions[0]);
    const handout = { ...ASHES.handouts[0], body: 'Actual player letter.' };
    session.plan = {
      version: 1,
      revision: 1,
      lastEdited: new Date().toISOString(),
      estimatedMinutes: 5,
      readiness: [],
      dependencies: [],
      notes: [],
      playerFacingSummary: '',
      attachments: [handout.id],
      steps: [
        {
          id: 'handout-step',
          order: 1,
          kind: 'handout',
          track: 'main',
          title: handout.title,
          objectId: handout.id,
          durationMinutes: 5,
          visibility: 'shared',
          body: 'DM ONLY: introduce the letter.',
        },
      ],
    };
    const model = buildSessionPlanModel(
      { ...ASHES, sessions: [session], handouts: [handout] },
      session.id,
    );
    expect(model?.steps[0]?.handoutBody).toBe('Actual player letter.');
    expect(model?.steps[0]?.body).toBe('DM ONLY: introduce the letter.');
    expect(model?.attachments).toHaveLength(1);
    expect(model?.attachments[0]?.id).toBe(handout.id);
  });

  it('findPlannedSession finds any existing session by id in the bundle', () => {
    const plannedSession = findPlannedSession(ASHES, 'session-12');
    expect(plannedSession).toBeDefined();
    expect(plannedSession?.title).toBe('The Glass Harbor');

    const unknownSession = findPlannedSession(ASHES, 'session-999');
    expect(unknownSession).toBeUndefined();
  });

  it('returns undefined when the session does not exist in the bundle', () => {
    const result = buildSessionPlanModel(ASHES, 'session-nonexistent');
    expect(result).toBeUndefined();
  });

  it('builds a rich view model for a session that has a pre-authored plan', () => {
    const result = buildSessionPlanModel(
      ASHES,
      'session-12',
      '/campaigns/ashes-of-veyra',
    );
    expect(result).toBeDefined();
    expect(result?.title).toContain('The Glass Harbor');
    expect(result?.backHref).toBe('/campaigns/ashes-of-veyra/sessions');
    expect(result?.breadcrumb).toContain('Session 12');
    expect(result?.steps.length).toBeGreaterThan(0);
    expect(result?.checklist.length).toBeGreaterThan(0);
    expect(result?.dependencies.length).toBeGreaterThan(0);
    expect(result?.durationLabel).toContain('hours');
    expect(result?.compendiumObjects.length).toBeGreaterThan(
      SRD_MONSTERS.length,
    );
  });

  it('generates a baseline fallback plan for a session that has no pre-authored plan', () => {
    const planlessSession = ASHES.sessions.find((s) => s.id === 'session-11');
    expect(planlessSession).toBeDefined();
    expect(planlessSession?.plan).toBeUndefined();

    const result = buildSessionPlanModel(ASHES, 'session-11');
    expect(result).toBeDefined();
    expect(result?.title).toContain('Session 11');
    expect(result?.steps.length).toBeGreaterThanOrEqual(4);
    expect(result?.steps[0]?.command).toBe('Opening recap');
    expect(result?.steps[result.steps.length - 1]?.command).toBe(
      'Closing beat',
    );
    expect(result?.checklist.length).toBeGreaterThan(0);
    expect(result?.dateLabel).toBeDefined();
  });

  it('handles unformatted dates, missing durationHours, and encounter monsters resolution', () => {
    const session = structuredClone(ASHES.sessions[0]);
    session.plannedDate = 'TBD Next Month';
    session.durationHours = undefined;
    const encounter = {
      ...ASHES.encounters[0],
      id: 'enc-custom',
      composition: [
        {
          name: 'Bandit',
          count: 2,
          ruleset: '2014-srd' as const,
          role: 'Skirmisher',
          monsterKey: 'srd:bandit',
          cr: '1/8',
        },
      ],
    };
    session.plan = {
      version: 1,
      revision: 1,
      lastEdited: ' today',
      estimatedMinutes: 180,
      readiness: [],
      dependencies: [{ objectId: 'unknown-dep-id', status: 'needs-review' }],
      notes: ['Note A'],
      playerFacingSummary: 'Summary',
      attachments: [],
      steps: [
        {
          id: 'step-enc',
          order: 1,
          kind: 'encounter',
          track: 'main',
          title: 'Deploy: Ambush',
          objectId: 'enc-custom',
          durationMinutes: 45,
          visibility: 'dm-only',
        },
        {
          id: 'step-note',
          order: 2,
          kind: 'note',
          track: 'main',
          title: 'Lore Note',
          durationMinutes: 15,
          visibility: 'shared',
          body: 'Typed reference: @Captain Serin',
        },
      ],
    };

    const result = buildSessionPlanModel(
      { ...ASHES, sessions: [session], encounters: [encounter] },
      session.id,
    );

    expect(result?.dateLabel).toBe('TBD Next Month');
    expect(result?.durationLabel).toBe('~3 hours');
    expect(result?.dependencies[0]?.label).toBe('unknown dep id');
    expect(result?.steps[0]?.encounterId).toBe('enc-custom');
    expect(result?.steps[0]?.encounterMonsters?.[0]?.name).toBe('Bandit');
    expect(result?.steps[1]?.referenceLabel).toBe('Captain Serin');
    expect(result?.steps[1]?.body).toBeUndefined();
  });
});

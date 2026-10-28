import { describe, expect, it, vi } from 'vitest';

import type {
  CampaignClue,
  CampaignEncounter,
  CampaignFaction,
  CampaignHandout,
  CampaignLocation,
  CampaignNpc,
  CampaignQuest,
  CampaignSession,
  QuestObjective,
} from '@/demo/ashes-of-veyra/types';

import {
  generateSessionSpine,
  generateSuggestedTitle,
} from '../sessionSpineGenerator';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('sessionSpineGenerator', () => {
  it('generates valid UUID v4 identifiers for all steps and readiness items', () => {
    const spine = generateSessionSpine({
      sessionNumber: 3,
      campaignTitle: 'Crown of Cinders',
    });

    expect(spine.plan.steps.length).toBeGreaterThanOrEqual(4);
    for (const step of spine.plan.steps) {
      expect(step.id).toMatch(UUID_V4_REGEX);
    }
    for (const item of spine.plan.readiness) {
      expect(item.id).toMatch(UUID_V4_REGEX);
    }
  });

  it('falls back to a valid UUID v4 format if crypto.randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);
    try {
      const spine = generateSessionSpine({
        sessionNumber: 1,
      });
      for (const step of spine.plan.steps) {
        expect(step.id).toMatch(UUID_V4_REGEX);
      }
    } finally {
      vi.stubGlobal('crypto', originalCrypto);
    }
  });

  it('generates a clean default session spine with baseline beats and timing', () => {
    const spine = generateSessionSpine({
      sessionNumber: 3,
      campaignTitle: 'Crown of Cinders',
    });

    expect(spine.suggestedTitle).toBe('Session 3 Journey');
    expect(spine.suggestedSummary).toContain('Session #3');
    expect(spine.playerFacingSummary).toContain(
      'Session #3 of Crown of Cinders',
    );

    const { plan } = spine;
    expect(plan.revision).toBe(1);
    expect(plan.steps.length).toBeGreaterThanOrEqual(4);

    expect(plan.steps[0]?.kind).toBe('recap');
    expect(plan.steps[plan.steps.length - 1]?.kind).toBe('closing');
    expect(plan.estimatedMinutes).toBeGreaterThan(0);
    expect(plan.readiness.length).toBeGreaterThan(0);
  });

  it('incorporates previous session highlights into opening recap beat', () => {
    const previousSession: CampaignSession = {
      id: 'session-2',
      campaignId: 'ashes-of-veyra',
      actId: 'act-1',
      number: 2,
      title: 'The Sunken Scriptorium',
      status: 'complete',
      summary:
        'The heroes deciphered the ancient warding glyphs and triggered an alarm.',
      partyLevel: 3,
      tags: [],
      questIds: [],
      npcIds: [],
      factionIds: [],
      locationIds: [],
      encounterIds: [],
      clueIds: [],
      handoutIds: [],
    };

    const spine = generateSessionSpine({
      sessionNumber: 3,
      previousSession,
    });

    const recap = spine.plan.steps.find((s) => s.kind === 'recap');
    expect(recap).toBeDefined();
    expect(recap?.body).toContain('Session #2');
    expect(recap?.body).toContain('The Sunken Scriptorium');
    expect(recap?.body).toContain('deciphered the ancient warding glyphs');
  });

  it('integrates full campaign studio context into narrative beats, dependencies, and readiness', () => {
    const location: CampaignLocation = {
      id: 'loc-temple',
      campaignId: 'ashes',
      name: 'Sunken Temple of Veyra',
      type: 'ruins',
      shortDescription: 'Crumbling aqueducts submerged in mist.',
      description: ['Damp stone corridors echo with chanting.'],
      tags: ['submerged', 'ancient'],
      npcIds: [],
      factionIds: [],
      encounterIds: [],
      questIds: [],
      handoutIds: [],
      notes: '',
    };

    const quest: CampaignQuest = {
      id: 'quest-relic',
      campaignId: 'ashes',
      title: 'The Sunken Scriptorium',
      status: 'active',
      priority: 'high',
      summary: 'Retrieve the Codex of Embers.',
      factionIds: [],
      sessionIds: [],
      locationIds: [],
      objectiveIds: [],
    };

    const objective: QuestObjective = {
      id: 'obj-1',
      questId: 'quest-relic',
      order: 1,
      title: 'Disarm the abyssal ward',
      status: 'active',
      clueIds: [],
      locationIds: [],
    };

    const npc: CampaignNpc = {
      id: 'npc-lyra',
      campaignId: 'ashes',
      name: 'Archivist Lyra',
      role: 'Lorekeeper',
      ancestry: 'Elf',
      factionIds: ['faction-scholars'],
      motivation: 'Protect the sacred scrolls at all costs.',
      relationship: 'Cautiously helpful',
      locationIds: [],
      sessionIds: [],
      portraitFallback: '',
      tags: [],
    };

    const encounter1: CampaignEncounter = {
      id: 'enc-gargoyles',
      campaignId: 'ashes',
      title: 'Gargoyle Ambush',
      kind: 'combat',
      difficulty: 'moderate',
      composition: [
        {
          name: 'Gargoyle',
          count: 3,
          ruleset: '2024',
          role: 'Ambusher',
          cr: '2',
        },
      ],
      trigger: 'Stepping on the stone dais',
      intendedUse: 'Mid-session combat challenge',
      sessionIds: [],
      locationIds: [],
      factionIds: [],
      tactics: 'Dive from rafters to separate squishy spellcasters.',
      rulesetNotes: '',
    };

    const encounter2: CampaignEncounter = {
      id: 'enc-trap',
      campaignId: 'ashes',
      title: 'Crushing Pendulum Hall',
      kind: 'trap',
      difficulty: 'high',
      composition: [],
      trigger: 'Tripwire at threshold',
      intendedUse: 'Lethal hazard',
      sessionIds: [],
      locationIds: [],
      factionIds: [],
      tactics: '',
      rulesetNotes: '',
      trapDetails: {
        complexity: 'complex',
        detectionDc: 15,
        disarmDc: 16,
      },
    };

    const handout: CampaignHandout = {
      id: 'doc-letter',
      campaignId: 'ashes',
      title: 'Torn Journal Page',
      kind: 'handout',
      summary: 'Mentions the command word to halt the pendulums.',
      content: ['"Speak the word Ignis..."'],
      visibility: 'shared',
      sessionIds: [],
      clueIds: [],
      questIds: [],
      locationIds: [],
      factionIds: [],
    };

    const spine = generateSessionSpine({
      sessionNumber: 4,
      quests: [quest],
      objectives: [objective],
      primaryLocation: location,
      encounters: [encounter1, encounter2],
      npcs: [npc],
      handouts: [handout],
      targetDurationMinutes: 240,
    });

    expect(spine.suggestedTitle).toBe(
      'The Sunken Scriptorium: Sunken Temple of Veyra',
    );
    expect(spine.suggestedSummary).toContain('Sunken Temple of Veyra');

    const steps = spine.plan.steps;

    const scene = steps.find(
      (s) => s.kind === 'scene' && s.objectId === location.id,
    );
    expect(scene).toBeDefined();
    expect(scene?.title).toContain('Sunken Temple of Veyra');

    const social = steps.find((s) => s.objectId === npc.id);
    expect(social).toBeDefined();
    expect(social?.body).toContain('Archivist Lyra');
    expect(social?.body).toContain('Disarm the abyssal ward');

    const combat = steps.find(
      (s) => s.kind === 'encounter' && s.objectId === encounter1.id,
    );
    expect(combat).toBeDefined();
    expect(combat?.title).toContain('Gargoyle Ambush');
    expect(combat?.body).toContain('Dive from rafters');

    const trap = steps.find(
      (s) => s.track === 'parallel' && s.objectId === encounter2.id,
    );
    expect(trap).toBeDefined();
    expect(trap?.title).toContain('Crushing Pendulum Hall');

    const docBeat = steps.find(
      (s) => s.kind === 'handout' && s.objectId === handout.id,
    );
    expect(docBeat).toBeDefined();
    expect(spine.plan.attachments).toContain(handout.id);
  });

  it('supports faction-driven social beats and clue-driven handout beats', () => {
    const factions: CampaignFaction[] = [
      {
        id: 'fac-1',
        campaignId: 'ashes',
        name: 'Iron Lanterns',
        publicFace: 'Harbor watch',
        hiddenAgenda: 'Smuggling',
        alliedFactionIds: [],
        rivalFactionIds: [],
        locationIds: [],
        questIds: [],
        status: 'neutral',
      },
      {
        id: 'fac-2',
        campaignId: 'ashes',
        name: 'Veiled Choir',
        publicFace: 'Priests',
        hiddenAgenda: 'Cult',
        alliedFactionIds: [],
        rivalFactionIds: [],
        locationIds: [],
        questIds: [],
        status: 'opposition',
      },
    ];
    const clues: CampaignClue[] = [
      {
        id: 'clue-1',
        campaignId: 'ashes',
        title: 'Salt-Stained Cipher',
        priority: 'high',
        status: 'unresolved',
        meaning: 'Points to the old lighthouse.',
        sourceHandoutIds: [],
        relatedQuestIds: [],
        locationIds: [],
        sessionIds: [],
      },
    ];

    const spine = generateSessionSpine({
      sessionNumber: 2,
      factions,
      clues,
    });

    const factionStep = spine.plan.steps.find((s) => s.objectId === 'fac-1');
    expect(factionStep?.title).toBe('Faction Tension: Iron Lanterns');

    const clueStep = spine.plan.steps.find((s) => s.objectId === 'clue-1');
    expect(clueStep?.title).toBe('Clue Discovery: Salt-Stained Cipher');

    const choiceStep = spine.plan.steps.find(
      (s) => s.title === 'Decision Point: Fork in the Path',
    );
    expect(choiceStep?.body).toContain('Aligning with Iron Lanterns');
  });

  it('scales step durations proportionally based on target duration', () => {
    const spineShort = generateSessionSpine({
      sessionNumber: 1,
      targetDurationMinutes: 120,
    });
    const spineLong = generateSessionSpine({
      sessionNumber: 1,
      targetDurationMinutes: 300,
    });

    expect(spineShort.plan.estimatedMinutes).toBeLessThan(
      spineLong.plan.estimatedMinutes,
    );
  });

  it('correctly handles suggested title fallbacks', () => {
    expect(
      generateSuggestedTitle({
        sessionNumber: 5,
        quests: [{ title: 'Relic Hunt' } as CampaignQuest],
      }),
    ).toBe('Relic Hunt');

    expect(
      generateSuggestedTitle({
        sessionNumber: 5,
        primaryLocation: { name: 'Obsidian Citadel' } as CampaignLocation,
      }),
    ).toBe('Expedition to Obsidian Citadel');

    expect(
      generateSuggestedTitle({
        sessionNumber: 2,
        encounters: [{ title: 'Dragon Hatchery' } as CampaignEncounter],
      }),
    ).toBe('Confrontation: Dragon Hatchery');

    expect(
      generateSuggestedTitle({
        sessionNumber: 7,
      }),
    ).toBe('Session 7 Journey');
  });
});

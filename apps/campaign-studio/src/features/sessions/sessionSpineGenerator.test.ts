import { describe, expect, it } from 'vitest';

import type {
  CampaignEncounter,
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
} from './sessionSpineGenerator';

describe('sessionSpineGenerator', () => {
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

    // Opening recap and closing beats should always be present
    expect(plan.steps[0].kind).toBe('recap');
    expect(plan.steps[plan.steps.length - 1].kind).toBe('closing');
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

    // Check Scene beat
    const scene = steps.find(
      (s) => s.kind === 'scene' && s.objectId === location.id,
    );
    expect(scene).toBeDefined();
    expect(scene?.title).toContain('Sunken Temple of Veyra');

    // Check NPC Social beat
    const social = steps.find((s) => s.objectId === npc.id);
    expect(social).toBeDefined();
    expect(social?.body).toContain('Archivist Lyra');
    expect(social?.body).toContain('Disarm the abyssal ward');

    // Check Primary Encounter
    const combat = steps.find(
      (s) => s.kind === 'encounter' && s.objectId === encounter1.id,
    );
    expect(combat).toBeDefined();
    expect(combat?.title).toContain('Gargoyle Ambush');
    expect(combat?.body).toContain('Dive from rafters');

    // Check Secondary Parallel Encounter
    const trap = steps.find(
      (s) => s.track === 'parallel' && s.objectId === encounter2.id,
    );
    expect(trap).toBeDefined();
    expect(trap?.title).toContain('Crushing Pendulum Hall');

    // Check Handout beat and attachment
    const docBeat = steps.find(
      (s) => s.kind === 'handout' && s.objectId === handout.id,
    );
    expect(docBeat).toBeDefined();
    expect(spine.plan.attachments).toContain(handout.id);

    // Check dependencies
    const depIds = spine.plan.dependencies.map((d) => d.objectId);
    expect(depIds).toContain(location.id);
    expect(depIds).toContain(npc.id);
    expect(depIds).toContain(encounter1.id);
    expect(depIds).toContain(encounter2.id);
    expect(depIds).toContain(handout.id);

    // Check readiness items
    expect(
      spine.plan.readiness.some((r) => r.label.includes('Gargoyle Ambush')),
    ).toBe(true);
    expect(
      spine.plan.readiness.some((r) => r.label.includes('Archivist Lyra')),
    ).toBe(true);
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

import { describe, expect, it } from 'vitest';
import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  generateRunSheetMarkdown,
  generateRunSheetHtml,
} from './runSheetExport';

const baseBundle = getFixtureBundle('ashes-of-veyra')!;
const session = baseBundle.sessions[0]!;

describe('runSheetExport', () => {
  it('generates a complete markdown run sheet with header and summary', () => {
    const md = generateRunSheetMarkdown(session, baseBundle);

    expect(md).toContain(`# Session ${session.number}: ${session.title}`);
    expect(md).toContain(`**Party Level:** ${session.partyLevel}`);
    expect(md).toContain('## Overview & Objectives');
    expect(md).toContain(session.summary);
  });

  it('includes story beats from session plan when present', () => {
    const planSession = {
      ...session,
      plan: {
        revision: 1,
        lastEdited: 'Oct 22, 2026',
        estimatedMinutes: 180,
        readiness: [],
        dependencies: [],
        notes: [],
        playerFacingSummary: 'Find the relic.',
        attachments: [],
        steps: [
          {
            id: 'beat-1',
            order: 1,
            kind: 'recap' as const,
            track: 'main' as const,
            title: 'Recap previous events',
            durationMinutes: 15,
            visibility: 'shared' as const,
            body: 'Remind party of the cave entrance.',
          },
          {
            id: 'beat-2',
            order: 2,
            kind: 'encounter' as const,
            track: 'main' as const,
            title: 'Ambush at the Gate',
            durationMinutes: 45,
            visibility: 'dm-only' as const,
            body: 'Ghouls emerge from the shadows.',
          },
        ],
      },
    };

    const md = generateRunSheetMarkdown(planSession, baseBundle);
    expect(md).toContain('## Story Beats & Timeline');
    expect(md).toContain('Beat 1: Recap previous events');
    expect(md).toContain('Beat 2: Ambush at the Gate');
    expect(md).toContain('[DM Only]');

    // Test filtering DM-only notes
    const publicMd = generateRunSheetMarkdown(planSession, baseBundle, {
      includeDmOnlyNotes: false,
    });
    expect(publicMd).toContain('Beat 1: Recap previous events');
    expect(publicMd).not.toContain('Beat 2: Ambush at the Gate');
  });

  it('includes linked encounters, trap specs, and NPC combat summaries', () => {
    const testBundle = {
      ...baseBundle,
      encounters: [
        {
          id: 'enc-crypt',
          campaignId: baseBundle.campaignId,
          title: 'Crypt Trap',
          kind: 'trap' as const,
          difficulty: 'high' as const,
          trigger: 'Opening the iron sarcophagus',
          intendedUse: 'Boss room guardian',
          sessionIds: [session.id],
          locationIds: [],
          factionIds: [],
          tactics: 'Focus the healer',
          rulesetNotes: 'Advantage on dex saves',
          composition: [{ name: 'Crypt Guardian', count: 2, ruleset: '2024' as const, role: 'Bruiser', cr: '3' }],
          trapDetails: {
            complexity: 'simple' as const,
            detectionDc: 15,
            disarmDc: 16,
            saveOrAttack: 'DC 14 Dex save',
            effect: '3d10 necrotic damage',
          },
        },
      ],
      npcs: [
        {
          ...baseBundle.npcs[0]!,
          id: 'npc-guide',
          name: 'Brom the Scout',
          role: 'Guide',
          ancestry: 'Dwarf',
          relationship: 'Friendly',
          motivation: 'Gold',
          combatSummary: { hp: 45, maxHp: 45, ac: 16, cr: '2' },
        },
      ],
    };

    const testSession = {
      ...session,
      encounterIds: ['enc-crypt'],
      npcIds: ['npc-guide'],
    };

    const md = generateRunSheetMarkdown(testSession, testBundle);
    expect(md).toContain('## Encounters & Challenges');
    expect(md).toContain('Crypt Trap (HIGH · TRAP)');
    expect(md).toContain('**Trigger:** Opening the iron sarcophagus');
    expect(md).toContain('2x Crypt Guardian (CR 3)');
    expect(md).toContain('Detection DC: 15');
    expect(md).toContain('Disarm DC: 16');

    expect(md).toContain('## Key NPCs');
    expect(md).toContain('**Brom the Scout** — *Guide* (Dwarf) (HP 45, AC 16, CR 2)');
    expect(md).toContain('Relationship: Friendly');
  });

  it('includes scheduled loot with player-facing aliases', () => {
    const testBundle = {
      ...baseBundle,
      items: [
        {
          id: 'item-blade',
          campaignId: baseBundle.campaignId,
          name: 'Sun Blade',
          playerName: 'Gleaming Golden Hilt',
          itemType: 'weapon' as const,
          rarity: 'rare' as const,
          requiresAttunement: true,
          valueGp: 5000,
          quantity: 1,
          description: 'A blade of pure radiance.',
          mechanics: '+2 attack and damage; emits daylight.',
          holder: { kind: 'none' as const },
          sessionId: session.id,
          discovered: false,
          identified: false,
          questIds: [],
        },
      ],
    };

    const md = generateRunSheetMarkdown(session, testBundle);
    expect(md).toContain(
      '**Sun Blade** (*RARE* · 5000 gp · Requires Attunement)',
    );
    expect(md).toContain('(Known to players as: "Gleaming Golden Hilt")');
    expect(md).toContain('A blade of pure radiance.');
  });

  it('generates valid self-contained HTML with styling', () => {
    const html = generateRunSheetHtml(session, baseBundle);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(`<title>Run Sheet - Session ${session.number}: ${session.title}</title>`);
    expect(html).toContain('<style>');
    expect(html).toContain('@media print');
    expect(html).toContain('sheet-title');
    expect(html).toContain('</html>');
  });
});

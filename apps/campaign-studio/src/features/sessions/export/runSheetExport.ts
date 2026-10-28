import type {
  CampaignFixtureBundle,
  CampaignSession,
  CampaignEncounter,
  CampaignNpc,
  CampaignLocation,
  CampaignItem,
  CampaignClue,
  CampaignHandout,
  CampaignSecret,
} from '@/demo/fixture-registry';

export interface RunSheetExportOptions {
  /** Include DM-only beats, secret agendas, and concealed clues (default: true) */
  includeDmOnlyNotes?: boolean;
  /** Include monster counts, combat summaries, and trap specs (default: true) */
  includeCombatDetails?: boolean;
  /** Include scheduled loot and item rewards (default: true) */
  includeLoot?: boolean;
  /** Include player handouts (default: true) */
  includeHandouts?: boolean;
  /** Include secrets & clues checklist (default: true) */
  includeSecrets?: boolean;
}

export function generateRunSheetMarkdown(
  session: CampaignSession,
  bundle: CampaignFixtureBundle,
  options: RunSheetExportOptions = {},
): string {
  const {
    includeDmOnlyNotes = true,
    includeCombatDetails = true,
    includeLoot = true,
    includeHandouts = true,
    includeSecrets = true,
  } = options;

  const act = bundle.acts.find((a) => a.id === session.actId);
  const lines: string[] = [];

  // Header
  lines.push(`# Session ${session.number}: ${session.title}`);
  lines.push('');

  // Metadata block
  const meta: string[] = [];
  if (act) meta.push(`**Act:** ${act.title}`);
  if (session.plannedDate) meta.push(`**Planned Date:** ${session.plannedDate}`);
  if (session.durationHours) meta.push(`**Duration:** ~${session.durationHours} hours`);
  if (session.partyLevel) meta.push(`**Party Level:** ${session.partyLevel}`);
  meta.push(`**Status:** ${session.status.toUpperCase()}`);
  lines.push(meta.join(' · '));
  lines.push('');

  // Summary
  if (session.summary) {
    lines.push('## Overview & Objectives');
    lines.push(session.summary);
    lines.push('');
  }

  // Story Beats / Timeline (from session.plan)
  const steps = session.plan?.steps ?? [];
  if (steps.length > 0) {
    lines.push('## Story Beats & Timeline');
    lines.push('');
    steps.forEach((step) => {
      if (!includeDmOnlyNotes && step.visibility === 'dm-only') {
        return;
      }
      const dur = step.durationMinutes ? ` (${step.durationMinutes} min)` : '';
      const vis = step.visibility === 'dm-only' ? ' [DM Only]' : '';
      const track = step.track === 'parallel' ? ' (Parallel Beat)' : '';
      lines.push(`- [ ] **Beat ${step.order}: ${step.title}** — *${step.kind}*${dur}${track}${vis}`);
      if (step.body) {
        lines.push(`  > ${step.body.replace(/\n/g, '\n  > ')}`);
      }
      lines.push('');
    });
  }

  // Encounters & Challenges
  const encounters: CampaignEncounter[] = (session.encounterIds ?? [])
    .map((id) => bundle.encounters.find((e) => e.id === id))
    .filter(Boolean) as CampaignEncounter[];

  if (includeCombatDetails && encounters.length > 0) {
    lines.push('## Encounters & Challenges');
    lines.push('');
    encounters.forEach((enc) => {
      lines.push(`### [ ] ${enc.title} (${enc.difficulty.toUpperCase()} · ${enc.kind.toUpperCase()})`);
      if (enc.trigger) {
        lines.push(`- **Trigger:** ${enc.trigger}`);
      }
      if (enc.composition && enc.composition.length > 0) {
        lines.push('- **Opposition:**');
        enc.composition.forEach((c) => {
          const cr = c.cr ? ` (CR ${c.cr})` : '';
          const role = c.role ? ` — *${c.role}*` : '';
          lines.push(`  - ${c.count}x ${c.name}${cr}${role}`);
        });
      }
      if (enc.trapDetails) {
        const t = enc.trapDetails;
        lines.push('- **Trap Details:**');
        lines.push(`  - Complexity: ${t.complexity.toUpperCase()}`);
        if (t.detectionDc) lines.push(`  - Detection DC: ${t.detectionDc}`);
        if (t.disarmDc) lines.push(`  - Disarm DC: ${t.disarmDc}`);
        if (t.saveOrAttack) lines.push(`  - Save / Attack: ${t.saveOrAttack}`);
        if (t.effect) lines.push(`  - Effect: ${t.effect}`);
        if (t.countermeasures) lines.push(`  - Countermeasures: ${t.countermeasures}`);
      }
      if (enc.tactics) {
        lines.push(`- **Tactics:** ${enc.tactics}`);
      }
      lines.push('');
    });
  }

  // Cast / NPCs
  const npcs: CampaignNpc[] = (session.npcIds ?? [])
    .map((id) => bundle.npcs.find((n) => n.id === id))
    .filter(Boolean) as CampaignNpc[];

  if (npcs.length > 0) {
    lines.push('## Key NPCs');
    lines.push('');
    npcs.forEach((npc) => {
      const combat = npc.combatSummary
        ? ` (HP ${npc.combatSummary.hp}, AC ${npc.combatSummary.ac}${npc.combatSummary.cr ? `, CR ${npc.combatSummary.cr}` : ''})`
        : '';
      lines.push(`- **${npc.name}** — *${npc.role}* (${npc.ancestry})${combat}`);
      if (npc.relationship) lines.push(`  - Relationship: ${npc.relationship}`);
      if (npc.motivation) lines.push(`  - Motivation: ${npc.motivation}`);
      lines.push('');
    });
  }

  // Locations
  const locations: CampaignLocation[] = (session.locationIds ?? [])
    .map((id) => bundle.locations.find((l) => l.id === id))
    .filter(Boolean) as CampaignLocation[];

  if (locations.length > 0) {
    lines.push('## Locations');
    lines.push('');
    locations.forEach((loc) => {
      lines.push(`- **${loc.name}** (*${loc.type}*)`);
      if (loc.shortDescription) lines.push(`  ${loc.shortDescription}`);
      lines.push('');
    });
  }

  // Secrets & Clues
  if (includeSecrets) {
    const clues: CampaignClue[] = (session.clueIds ?? [])
      .map((id) => bundle.clues.find((c) => c.id === id))
      .filter(Boolean) as CampaignClue[];

    // Check bundle secrets if linked
    const secrets = (bundle.secrets ?? []).filter(
      (s: CampaignSecret) =>
        s.revealedInSessionId === session.id ||
        s.attachedTo.some((a) => a.id === session.id),
    );

    if (clues.length > 0 || secrets.length > 0) {
      lines.push('## Secrets & Clues to Reveal');
      lines.push('');
      clues.forEach((clue) => {
        lines.push(
          `- [ ] **${clue.title}** (${clue.priority.toUpperCase()} priority)`,
        );
        lines.push(`  ${clue.meaning}`);
      });
      secrets.forEach((s) => {
        lines.push(`- [ ] **Secret:** ${s.text}`);
      });
      lines.push('');
    }
  }

  // Scheduled Loot
  if (includeLoot) {
    const sessionLoot: CampaignItem[] = (bundle.items ?? []).filter(
      (item) => item.sessionId === session.id,
    );

    // Also collect items held by encounters in this session
    const encounterIds = new Set(session.encounterIds ?? []);
    const encounterLoot: CampaignItem[] = (bundle.items ?? []).filter(
      (item) =>
        item.holder?.kind === 'encounter' &&
        item.holder?.id &&
        encounterIds.has(item.holder.id),
    );

    const allLoot = [...new Map([...sessionLoot, ...encounterLoot].map((i) => [i.id, i])).values()];

    if (allLoot.length > 0) {
      lines.push('## Scheduled Loot & Treasure');
      lines.push('');
      allLoot.forEach((item) => {
        const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
        const playerAlias = item.playerName ? ` (Known to players as: "${item.playerName}")` : '';
        const val = item.valueGp !== undefined ? ` · ${item.valueGp} gp` : '';
        const attune = item.requiresAttunement ? ' · Requires Attunement' : '';
        lines.push(`- [ ] **${qty}${item.name}** (*${item.rarity.toUpperCase()}*${val}${attune})${playerAlias}`);
        if (item.description) {
          lines.push(`  ${item.description}`);
        }
        if (item.mechanics) {
          lines.push(`  *Mechanics:* ${item.mechanics}`);
        }
        lines.push('');
      });
    }
  }

  // Handouts
  if (includeHandouts) {
    const handouts: CampaignHandout[] = (session.handoutIds ?? [])
      .map((id) => bundle.handouts.find((h) => h.id === id))
      .filter(Boolean) as CampaignHandout[];

    if (handouts.length > 0) {
      lines.push('## Handouts & Props');
      lines.push('');
      handouts.forEach((h) => {
        lines.push(`### Handout: ${h.title}`);
        if (h.summary) lines.push(`*${h.summary}*`);
        lines.push('');
        if (h.body) {
          lines.push(h.body);
        } else if (h.content && h.content.length > 0) {
          h.content.forEach((p) => lines.push(p));
        }
        lines.push('');
      });
    }
  }

  return lines.join('\n');
}

export function generateRunSheetHtml(
  session: CampaignSession,
  bundle: CampaignFixtureBundle,
  options: RunSheetExportOptions = {},
): string {
  const md = generateRunSheetMarkdown(session, bundle, options);

  // Simple HTML escaper
  const escape = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Convert basic markdown formatting to clean semantic HTML
  const lines = md.split('\n');
  const htmlParts: string[] = [];

  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith('# ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h1 class="sheet-title">${escape(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h2 class="sheet-section-title">${escape(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h3 class="sheet-sub-title">${escape(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('- [ ] ')) {
      if (!inList) { htmlParts.push('<ul class="sheet-check-list">'); inList = true; }
      const content = trimmed.slice(6);
      htmlParts.push(`<li class="sheet-check-item"><label><input type="checkbox" /> <span>${formatInline(escape(content))}</span></label></li>`);
    } else if (trimmed.startsWith('- ')) {
      if (!inList) { htmlParts.push('<ul class="sheet-bullet-list">'); inList = true; }
      htmlParts.push(`<li>${formatInline(escape(trimmed.slice(2)))}</li>`);
    } else if (trimmed.startsWith('> ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<blockquote>${formatInline(escape(trimmed.slice(2)))}</blockquote>`);
    } else {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<p>${formatInline(escape(trimmed))}</p>`);
    }
  }

  if (inList) htmlParts.push('</ul>');

  function formatInline(str: string): string {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Run Sheet - Session ${session.number}: ${session.title}</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #1a1a1a;
      --text-muted: #555555;
      --border: #d0d0d0;
      --accent: #8b1e1e;
      --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-display: Georgia, "Times New Roman", serif;
    }

    * { box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 14px;
      line-height: 1.5;
      max-width: 860px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .sheet-title {
      font-family: var(--font-display);
      font-size: 2rem;
      margin: 0 0 0.5rem 0;
      color: var(--accent);
      border-bottom: 2px solid var(--accent);
      padding-bottom: 0.35rem;
    }

    .sheet-section-title {
      font-family: var(--font-display);
      font-size: 1.35rem;
      margin: 2rem 0 0.75rem 0;
      color: #2b2b2b;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.25rem;
      page-break-after: avoid;
      break-after: avoid;
    }

    .sheet-sub-title {
      font-size: 1.05rem;
      margin: 1.25rem 0 0.4rem 0;
      color: #333333;
      page-break-after: avoid;
      break-after: avoid;
    }

    p { margin: 0.5rem 0; }
    blockquote {
      margin: 0.5rem 0 0.5rem 1.25rem;
      padding: 0.35rem 0.75rem;
      border-left: 3px solid var(--border);
      color: var(--text-muted);
      font-style: italic;
    }

    ul { margin: 0.5rem 0; padding-left: 1.5rem; }
    .sheet-check-list { list-style: none; padding-left: 0; }
    .sheet-check-item {
      margin: 0.45rem 0;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sheet-check-item label {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      cursor: pointer;
    }
    .sheet-check-item input[type="checkbox"] {
      margin: 0;
      width: 14px;
      height: 14px;
    }

    @media print {
      body {
        padding: 0;
        max-width: none;
        font-size: 11pt;
        color: #000000;
      }
      .sheet-section-title {
        page-break-after: avoid;
      }
      .sheet-check-item {
        page-break-inside: avoid;
      }
      @page {
        margin: 1.5cm;
      }
    }
  </style>
</head>
<body>
  ${htmlParts.join('\n  ')}
</body>
</html>`;
}

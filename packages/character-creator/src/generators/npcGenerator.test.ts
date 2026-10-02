import { describe, it, expect } from 'vitest';
import {
  generateRandomNpc,
  STAT_BLOCK_PRESETS,
  COMMON_OCCUPATIONS,
  DEFAULT_MOTIVATIONS,
  DEFAULT_RELATIONSHIPS,
} from './npcGenerator';

describe('npcGenerator', () => {
  it('generates a complete NPC with valid default attributes', () => {
    const npc = generateRandomNpc();

    expect(npc.name).toBeTruthy();
    expect(npc.ancestry).toBeTruthy();
    expect(npc.role).toBeTruthy();
    expect(COMMON_OCCUPATIONS).toContain(npc.role);
    expect(DEFAULT_MOTIVATIONS).toContain(npc.motivation);
    expect(DEFAULT_RELATIONSHIPS).toContain(npc.relationship);
    expect(npc.alignment).toBeTruthy();
    expect(npc.tags.length).toBeGreaterThanOrEqual(2);
    expect(npc.personalityTraits.length).toBe(2);
    expect(npc.statBlockRef).toBeDefined();
    expect(npc.statBlockRef?.ruleset).toBe('2014');
    expect(npc.combatSummary).toBeDefined();
    expect(npc.combatSummary?.hp).toBeGreaterThan(0);
    expect(npc.combatSummary?.ac).toBeGreaterThan(0);
  });

  it('respects provided options for ancestry, gender, role, alignment, and statBlockPreset', () => {
    const npc = generateRandomNpc({
      ancestry: 'Elf',
      gender: 'female',
      role: 'Town Guard',
      alignment: 'Lawful Good',
      statBlockPreset: 'guard',
    });

    expect(npc.ancestry).toBe('Elf');
    expect(npc.role).toBe('Town Guard');
    expect(npc.alignment).toBe('Lawful Good');
    expect(npc.statBlockRef?.slug).toBe('guard');
    expect(npc.combatSummary?.ac).toBe(16);
    expect(npc.combatSummary?.hp).toBe(16);
  });

  it('resolves appropriate stat block presets based on role keywords', () => {
    const guardNpc = generateRandomNpc({ role: 'City Watch Captain' });
    expect(guardNpc.statBlockRef?.slug).toBe('guard');

    const banditNpc = generateRandomNpc({ role: 'Shadow Bandit' });
    expect(banditNpc.statBlockRef?.slug).toBe('bandit');

    const acolyteNpc = generateRandomNpc({ role: 'Temple Priest' });
    expect(acolyteNpc.statBlockRef?.slug).toBe('acolyte');

    const nobleNpc = generateRandomNpc({ role: 'Town Mayor' });
    expect(nobleNpc.statBlockRef?.slug).toBe('noble');

    const scoutNpc = generateRandomNpc({ role: 'Wilderness Guide' });
    expect(scoutNpc.statBlockRef?.slug).toBe('scout');

    const mageNpc = generateRandomNpc({ role: 'Hedge Wizard' });
    expect(mageNpc.statBlockRef?.slug).toBe('mage');

    const veteranNpc = generateRandomNpc({ role: 'Order Knight' });
    expect(veteranNpc.statBlockRef?.slug).toBe('veteran');

    const commonerNpc = generateRandomNpc({ role: 'Tavern Cook' });
    expect(commonerNpc.statBlockRef?.slug).toBe('commoner');
  });

  it('correctly maps various ancestry inputs to normalized name slugs', () => {
    const dwarvenNpc = generateRandomNpc({ ancestry: 'Mountain Dwarf' });
    expect(dwarvenNpc.ancestry).toBe('Mountain Dwarf');
    expect(dwarvenNpc.name).toBeTruthy();

    const halflingNpc = generateRandomNpc({ ancestry: 'Lightfoot Halfling' });
    expect(halflingNpc.ancestry).toBe('Lightfoot Halfling');

    const tieflingNpc = generateRandomNpc({ ancestry: 'Tiefling' });
    expect(tieflingNpc.ancestry).toBe('Tiefling');

    const orcNpc = generateRandomNpc({ ancestry: 'Half-Orc' });
    expect(orcNpc.ancestry).toBe('Half-Orc');
  });

  it('exports all presets and data tables', () => {
    expect(STAT_BLOCK_PRESETS.commoner.combatSummary.hp).toBe(10);
    expect(COMMON_OCCUPATIONS.length).toBeGreaterThan(10);
    expect(DEFAULT_MOTIVATIONS.length).toBeGreaterThan(5);
    expect(DEFAULT_RELATIONSHIPS.length).toBeGreaterThan(5);
  });
});

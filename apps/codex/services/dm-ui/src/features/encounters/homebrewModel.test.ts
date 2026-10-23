import { describe, expect, it } from 'vitest';
import type { HomebrewMonster } from '@/demo/fixture-registry';
import {
  abilityModifier,
  cloneMonsterDraft,
  filterHomebrewMonsters,
  formatModifier,
  xpForCr,
} from './homebrewModel';

const mockMonsters: HomebrewMonster[] = [
  {
    id: 'hb-1',
    campaignId: 'camp-1',
    name: 'Ash Stalker',
    size: 'Medium',
    type: 'monstrosity',
    cr: '3',
    ac: 14,
    hp: 45,
    speed: 40,
    abilities: [16, 14, 14, 8, 12, 6],
    edition: '2024',
    notes: 'Stealth hunter that melts into ash.',
  },
  {
    id: 'hb-2',
    campaignId: 'camp-1',
    name: 'Cinder Sprite',
    size: 'Tiny',
    type: 'fey',
    cr: '1/4',
    ac: 13,
    hp: 7,
    speed: 30,
    abilities: [4, 16, 10, 10, 12, 14],
    edition: '2024',
    notes: 'Glows like an ember in dark caves.',
  },
];

describe('homebrewModel', () => {
  describe('abilityModifier & formatModifier', () => {
    it('calculates modifiers correctly across score spectrum', () => {
      expect(abilityModifier(10)).toBe(0);
      expect(formatModifier(10)).toBe('+0');

      expect(abilityModifier(11)).toBe(0);
      expect(formatModifier(11)).toBe('+0');

      expect(abilityModifier(16)).toBe(3);
      expect(formatModifier(16)).toBe('+3');

      expect(abilityModifier(8)).toBe(-1);
      expect(formatModifier(8)).toBe('-1');

      expect(abilityModifier(1)).toBe(-5);
      expect(formatModifier(1)).toBe('-5');

      expect(abilityModifier(30)).toBe(10);
      expect(formatModifier(30)).toBe('+10');
    });
  });

  describe('xpForCr', () => {
    it('returns standard 5e XP values for known CRs', () => {
      expect(xpForCr('0')).toBe(10);
      expect(xpForCr('1/4')).toBe(50);
      expect(xpForCr('1')).toBe(200);
      expect(xpForCr('3')).toBe(700);
      expect(xpForCr('20')).toBe(25000);
      expect(xpForCr('30')).toBe(155000);
    });

    it('returns 0 for unknown or empty CR', () => {
      expect(xpForCr('')).toBe(0);
      expect(xpForCr('unknown')).toBe(0);
    });
  });

  describe('filterHomebrewMonsters', () => {
    it('returns all monsters when no filter is provided', () => {
      expect(filterHomebrewMonsters(mockMonsters)).toHaveLength(2);
    });

    it('filters by search query matching name, type, or notes', () => {
      const byName = filterHomebrewMonsters(mockMonsters, { query: 'stalker' });
      expect(byName).toHaveLength(1);
      expect(byName[0].name).toBe('Ash Stalker');

      const byType = filterHomebrewMonsters(mockMonsters, { query: 'fey' });
      expect(byType).toHaveLength(1);
      expect(byType[0].name).toBe('Cinder Sprite');

      const byNotes = filterHomebrewMonsters(mockMonsters, { query: 'ember' });
      expect(byNotes).toHaveLength(1);
      expect(byNotes[0].name).toBe('Cinder Sprite');
    });

    it('filters by type dropdown', () => {
      const fey = filterHomebrewMonsters(mockMonsters, { type: 'fey' });
      expect(fey).toHaveLength(1);
      expect(fey[0].name).toBe('Cinder Sprite');

      const dragons = filterHomebrewMonsters(mockMonsters, { type: 'dragon' });
      expect(dragons).toHaveLength(0);
    });

    it('filters by CR dropdown', () => {
      const cr3 = filterHomebrewMonsters(mockMonsters, { cr: '3' });
      expect(cr3).toHaveLength(1);
      expect(cr3[0].name).toBe('Ash Stalker');

      const cr5 = filterHomebrewMonsters(mockMonsters, { cr: '5' });
      expect(cr5).toHaveLength(0);
    });
  });

  describe('cloneMonsterDraft', () => {
    it('clones monster stats with (Custom) suffix', () => {
      const cloned = cloneMonsterDraft(mockMonsters[0]);
      expect(cloned.name).toBe('Ash Stalker (Custom)');
      expect(cloned.cr).toBe('3');
      expect(cloned.size).toBe('Medium');
      expect(cloned.type).toBe('monstrosity');
      expect(cloned.ac).toBe(14);
      expect(cloned.hp).toBe(45);
      expect(cloned.speed).toBe(40);
      expect(cloned.abilities).toEqual([16, 14, 14, 8, 12, 6]);
      expect(cloned.notes).toBe('Stealth hunter that melts into ash.');
    });

    it('uses defaults when cloning empty or partial source', () => {
      const cloned = cloneMonsterDraft({});
      expect(cloned.name).toBe('New Creature');
      expect(cloned.cr).toBe('1');
      expect(cloned.size).toBe('Medium');
      expect(cloned.type).toBe('humanoid');
      expect(cloned.ac).toBe(12);
      expect(cloned.hp).toBe(20);
      expect(cloned.speed).toBe(30);
      expect(cloned.abilities).toEqual([10, 10, 10, 10, 10, 10]);
    });
  });
});

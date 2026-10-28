import { describe, expect, it } from 'vitest';

import {
  computeDiff,
  formatRevisionDate,
  formatValue,
  generateSyntheticRevisions,
  humanizeFieldName,
  restoreRevisionPatch,
} from './revisionModel';

describe('revisionModel', () => {
  describe('humanizeFieldName', () => {
    it('humanizes camelCase and snake_case field names', () => {
      expect(humanizeFieldName('rulesetNotes')).toBe('Ruleset Notes');
      expect(humanizeFieldName('intended_use')).toBe('Intended Use');
      expect(humanizeFieldName('title')).toBe('Title');
      expect(humanizeFieldName('ac')).toBe('Ac');
    });
  });

  describe('formatValue', () => {
    it('formats null and undefined as (empty)', () => {
      expect(formatValue(null)).toBe('(empty)');
      expect(formatValue(undefined)).toBe('(empty)');
    });

    it('formats booleans, numbers, and strings', () => {
      expect(formatValue(true)).toBe('True');
      expect(formatValue(false)).toBe('False');
      expect(formatValue(42)).toBe('42');
      expect(formatValue('Hello world')).toBe('Hello world');
      expect(formatValue('   ')).toBe('(empty string)');
    });

    it('formats arrays and objects', () => {
      expect(formatValue([])).toBe('(empty list)');
      expect(formatValue(['a', 'b', 'c'])).toBe('a, b, c');
      expect(formatValue({ nested: 'value' })).toBe(
        JSON.stringify({ nested: 'value' }, null, 2),
      );
    });
  });

  describe('computeDiff', () => {
    it('detects modified, added, and unchanged fields', () => {
      const prev = {
        title: 'Original Title',
        notes: 'Old notes',
        ac: 14,
      };
      const curr = {
        title: 'Original Title',
        notes: 'Updated notes with details',
        ac: 16,
        extra: 'Newly added',
      };

      const diffs = computeDiff(prev, curr);

      const modified = diffs.filter((d) => d.changed);
      expect(modified.map((d) => d.key)).toEqual(
        expect.arrayContaining(['notes', 'ac', 'extra']),
      );

      const titleDiff = diffs.find((d) => d.key === 'title');
      expect(titleDiff?.changed).toBe(false);
      expect(titleDiff?.oldValue).toBe('Original Title');
      expect(titleDiff?.newValue).toBe('Original Title');
    });

    it('ignores metadata keys like id, campaignId, createdAt, updatedAt', () => {
      const prev = { id: 'obj-1', campaignId: 'c-1', title: 'A' };
      const curr = { id: 'obj-1', campaignId: 'c-1', title: 'B' };

      const diffs = computeDiff(prev, curr);
      expect(diffs.map((d) => d.key)).toEqual(['title']);
    });
  });

  describe('restoreRevisionPatch', () => {
    it('creates patch to revert currentDraft back to targetSnapshot', () => {
      const target = {
        title: 'Old Title',
        ac: 12,
        notes: 'Old Notes',
      };
      const current = {
        title: 'New Title',
        ac: 12,
        notes: 'Current Notes',
        extraField: 'Will be removed',
      };

      const patch = restoreRevisionPatch(target, current);
      expect(patch).toEqual({
        title: 'Old Title',
        notes: 'Old Notes',
        extraField: '',
      });
      // ac was unchanged, so not in patch
      expect(patch.ac).toBeUndefined();
    });
  });

  describe('generateSyntheticRevisions', () => {
    it('creates 3 revisions for entities without server history', () => {
      const current = {
        title: 'Ancient Lich',
        cr: '21',
        notes: 'Spellcasting tactics',
      };
      const revs = generateSyntheticRevisions('lich-1', current);

      expect(revs).toHaveLength(3);
      expect(revs[0].revision).toBe(3);
      expect(revs[1].revision).toBe(2);
      expect(revs[2].revision).toBe(1);
      expect(revs[0].snapshot.title).toBe('Ancient Lich');
      expect(revs[2].changeSummary).toContain('Ancient Lich');
    });
  });

  describe('formatRevisionDate', () => {
    it('formats ISO timestamps nicely', () => {
      const formatted = formatRevisionDate('2026-10-22T12:00:00.000Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Oct');
    });

    it('returns raw string if invalid date', () => {
      expect(formatRevisionDate('not-a-date')).toBe('not-a-date');
    });
  });
});

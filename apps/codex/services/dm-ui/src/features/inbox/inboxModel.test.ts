import { describe, expect, it } from 'vitest';
import type {
  CampaignFixtureBundle,
  InboxNote,
} from '@/demo/fixture-registry';
import {
  computeInboxStats,
  countUnfiled,
  describeTriageTarget,
  extractFirstLineTitle,
  filterInboxNotes,
  formatInboxDate,
  isUnfiled,
  triageToNoteDraft,
  triageToNpcDraft,
  triageToQuestDraft,
  triageToSecretDraft,
} from './inboxModel';

const sampleNotes: InboxNote[] = [
  {
    id: 'note-1',
    campaignId: 'camp-1',
    text: 'A wandering merchant in the misty woods with a cursed ruby necklace',
    createdAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'note-2',
    campaignId: 'camp-1',
    text: 'Investigate the old watchtower ruins for cult markings',
    createdAt: '2026-10-21T12:00:00Z',
    triagedTo: { kind: 'quest', id: 'quest-99' },
  },
  {
    id: 'note-3',
    campaignId: 'camp-1',
    text: 'The Mayor is secretly sending forged reports to the Duke',
    createdAt: '2026-10-22T08:00:00Z',
  },
  {
    id: 'note-4',
    campaignId: 'camp-1',
    text: 'Old note with empty target',
    createdAt: 'invalid-date',
    triagedTo: { kind: 'npc', id: '' },
  },
];

const mockBundle = {
  npcs: [{ id: 'npc-1', name: 'Lady Eleanor' }],
  quests: [{ id: 'quest-99', title: 'The Silent Tower' }],
  secrets: [
    {
      id: 'secret-1',
      campaignId: 'camp-1',
      text: 'The Duke poisoned his brother twenty years ago',
      revealed: false,
    },
  ],
  notes: [{ id: 'note-anchor', title: 'Session 4 Highlights' }],
  sessions: [{ id: 'sess-1', title: 'Chapter 1: The Gathering Storm' }],
} as unknown as CampaignFixtureBundle;

describe('inboxModel', () => {
  describe('isUnfiled & countUnfiled', () => {
    it('accurately identifies unfiled notes', () => {
      expect(isUnfiled(sampleNotes[0])).toBe(true);
      expect(isUnfiled(sampleNotes[1])).toBe(false);
      expect(isUnfiled(sampleNotes[2])).toBe(true);
      expect(isUnfiled(sampleNotes[3])).toBe(true);
    });

    it('counts unfiled notes properly with fallback defaults', () => {
      expect(countUnfiled(sampleNotes)).toBe(3);
      expect(countUnfiled([])).toBe(0);
      expect(countUnfiled(undefined)).toBe(0);
    });
  });

  describe('computeInboxStats', () => {
    it('computes total, unfiled, and triaged correctly', () => {
      const stats = computeInboxStats(sampleNotes);
      expect(stats).toEqual({
        total: 4,
        unfiled: 3,
        triaged: 1,
      });

      expect(computeInboxStats()).toEqual({
        total: 0,
        unfiled: 0,
        triaged: 0,
      });
    });
  });

  describe('filterInboxNotes', () => {
    it('sorts newest first by createdAt', () => {
      const sorted = filterInboxNotes(sampleNotes);
      expect(sorted.map((n) => n.id)).toEqual([
        'note-3',
        'note-2',
        'note-1',
        'note-4',
      ]);
    });

    it('filters by status: unfiled', () => {
      const unfiled = filterInboxNotes(sampleNotes, { status: 'unfiled' });
      expect(unfiled.map((n) => n.id)).toEqual(['note-3', 'note-1', 'note-4']);
    });

    it('filters by status: triaged', () => {
      const triaged = filterInboxNotes(sampleNotes, { status: 'triaged' });
      expect(triaged.map((n) => n.id)).toEqual(['note-2']);
    });

    it('filters by text search query', () => {
      const result = filterInboxNotes(sampleNotes, { query: 'merchant' });
      expect(result.map((n) => n.id)).toEqual(['note-1']);
    });

    it('handles empty notes list gracefully', () => {
      expect(filterInboxNotes()).toEqual([]);
    });
  });

  describe('extractFirstLineTitle', () => {
    it('returns Untitled on empty or blank input', () => {
      expect(extractFirstLineTitle('')).toBe('Untitled');
      expect(extractFirstLineTitle('   \n  ')).toBe('Untitled');
      expect(extractFirstLineTitle('#   ')).toBe('Untitled');
    });

    it('cleans markdown prefixes and truncates appropriately', () => {
      expect(extractFirstLineTitle('# A Grand Castle\nSome text below')).toBe(
        'A Grand Castle',
      );
      expect(extractFirstLineTitle('* The Lost Artifact', 10)).toBe(
        'The Lost …',
      );
    });
  });

  describe('Triage draft converters', () => {
    it('converts text into an NPC draft', () => {
      const draft = triageToNpcDraft(
        '# Master Corvus\nA brooding raven-keeper who guards the tower',
      );
      expect(draft.name).toBe('Master Corvus');
      expect(draft.role).toBe('Contact');
      expect(draft.notes).toContain('Master Corvus');
      expect(draft.notes).toContain('brooding raven-keeper');
    });

    it('converts text into a Quest draft', () => {
      const draft = triageToQuestDraft(
        'Recover the stolen seal of House Marst\nReward: 500gp',
      );
      expect(draft.title).toBe('Recover the stolen seal of House Marst');
      expect(draft.status).toBe('active');
      expect(draft.description).toContain('Reward: 500gp');
    });

    it('converts text into a Secret draft', () => {
      const draft = triageToSecretDraft(
        'The river gate is left unlocked on moonless nights.',
      );
      expect(draft.revealed).toBe(false);
      expect(draft.text).toBe(
        'The river gate is left unlocked on moonless nights.',
      );
    });

    it('converts text into a Note draft', () => {
      const draft = triageToNoteDraft(
        'Session 5 prep ideas\nRemember to trigger the goblin ambush at the bridge',
      );
      expect(draft.title).toBe('Session 5 prep ideas');
      expect(draft.audience).toBe('none');
      expect(draft.body).toContain('goblin ambush');
    });
  });

  describe('formatInboxDate', () => {
    it('formats ISO dates or falls back gracefully', () => {
      expect(formatInboxDate('')).toBe('Unknown date');
      expect(formatInboxDate('not-a-date')).toBe('Unknown date');
      const formatted = formatInboxDate('2026-10-22T10:00:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Oct');
    });
  });

  describe('describeTriageTarget', () => {
    it('resolves NPC targets', () => {
      expect(
        describeTriageTarget({ kind: 'npc', id: 'npc-1' }, mockBundle),
      ).toBe('NPC: Lady Eleanor');
      expect(
        describeTriageTarget({ kind: 'npc', id: 'npc-missing' }, mockBundle),
      ).toBe('NPC (npc-missing)');
    });

    it('resolves Quest targets', () => {
      expect(
        describeTriageTarget({ kind: 'quest', id: 'quest-99' }, mockBundle),
      ).toBe('Quest: The Silent Tower');
      expect(
        describeTriageTarget({ kind: 'quest', id: 'quest-missing' }, mockBundle),
      ).toBe('Quest (quest-missing)');
    });

    it('resolves Secret targets', () => {
      expect(
        describeTriageTarget({ kind: 'secret', id: 'secret-1' }, mockBundle),
      ).toBe('Secret: The Duke poisoned his brother…');
      expect(
        describeTriageTarget({ kind: 'secret', id: 'secret-missing' }, mockBundle),
      ).toBe('Secret (secret-missing)');
    });

    it('resolves Note targets', () => {
      expect(
        describeTriageTarget({ kind: 'note', id: 'note-anchor' }, mockBundle),
      ).toBe('Note: Session 4 Highlights');
      expect(
        describeTriageTarget({ kind: 'note', id: 'note-missing' }, mockBundle),
      ).toBe('Note (note-missing)');
    });

    it('resolves Session targets', () => {
      expect(
        describeTriageTarget({ kind: 'session', id: 'sess-1' }, mockBundle),
      ).toBe('Session: Chapter 1: The Gathering Storm');
      expect(
        describeTriageTarget({ kind: 'session', id: 'sess-missing' }, mockBundle),
      ).toBe('Session (sess-missing)');
    });

    it('resolves unknown kinds fallback', () => {
      expect(
        describeTriageTarget({ kind: 'encounter', id: 'enc-1' }, mockBundle),
      ).toBe('encounter: enc-1');
    });
  });
});

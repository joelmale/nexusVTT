import { describe, expect, it } from 'vitest';

import type { CampaignHandout } from '@/demo/fixture-registry';

import {
  audienceSummary,
  buildHandoutGroups,
  moveHandoutPatches,
  resolveLoreRoute,
} from './handoutsModels';
import {
  anchorFromKey,
  anchorKey,
  buildNotesBoard,
  moveToTarget,
  moveWithinView,
} from './notesBoardModels';

const note = (id: string, order: number, anchor = 'campaign') => ({
  id,
  campaignId: 'c',
  title: id,
  body: `body ${id}`,
  anchor: anchorFromKey(anchor),
  color: 'yellow' as const,
  size: 'small' as const,
  order,
});

const handout = (
  id: string,
  order: number,
  folderId?: string,
): CampaignHandout => ({
  id,
  campaignId: 'c',
  title: id,
  kind: 'handout',
  summary: '',
  content: [],
  body: '',
  visibility: 'dm-only',
  sessionIds: [],
  clueIds: [],
  questIds: [],
  locationIds: [],
  factionIds: [],
  order,
  folderId,
  audience: 'hidden',
});

describe('notes board models', () => {
  it('orders globally and filters by anchor and search', () => {
    const notes = [
      note('b', 2, 'session:s1'),
      note('a', 1),
      note('c', 3, 'session:s1'),
    ];
    expect(buildNotesBoard({ notes }, '', '').visible.map((n) => n.id)).toEqual(
      ['a', 'b', 'c'],
    );
    expect(
      buildNotesBoard({ notes }, 'session:s1', '').visible.map((n) => n.id),
    ).toEqual(['b', 'c']);
    expect(buildNotesBoard({ notes }, '', 'body c').visible).toHaveLength(1);
  });

  it('round-trips anchor keys', () => {
    expect(anchorKey(anchorFromKey('scene:x'))).toBe('scene:x');
    expect(anchorFromKey('bogus')).toEqual({ type: 'campaign' });
  });

  it('moves within a filtered view keeping hidden notes in place', () => {
    const all = ['a', 'b', 'c', 'd'];
    const visible = ['b', 'd'];
    expect(moveWithinView(all, visible, 'd', -1)).toEqual(['a', 'd', 'c', 'b']);
    expect(moveWithinView(all, visible, 'b', -1)).toEqual(all);
    expect(moveToTarget(all, all, 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('handouts models', () => {
  const folder = (id: string, order: number) => ({
    id,
    title: id,
    actId: '',
    objectIds: [],
    children: [],
    kind: 'handout-folder' as const,
    order,
  });
  const folders = [
    folder('Two', 2),
    folder('One', 1),
    { id: 'act', title: 'Act', actId: 'a', objectIds: [], children: [] },
  ];

  it('groups by folder order with an Unfiled tail', () => {
    const groups = buildHandoutGroups({
      folders,
      handouts: [
        handout('x', 2, 'One'),
        handout('y', 1, 'One'),
        handout('z', 0),
      ],
    });
    expect(groups.map((g) => g.label)).toEqual(['One', 'Two', 'Unfiled']);
    expect(groups[0].items.map((h) => h.id)).toEqual(['y', 'x']);
    expect(groups[2].items.map((h) => h.id)).toEqual(['z']);
  });

  it('renumbers on move so ties resolve', () => {
    const items = [handout('a', 0), handout('b', 0), handout('c', 0)];
    expect(moveHandoutPatches(items, 'c', -1)).toEqual([
      { id: 'c', order: 1 },
      { id: 'b', order: 2 },
    ]);
    expect(moveHandoutPatches(items, 'a', -1)).toEqual([]);
  });

  it('summarizes audiences', () => {
    const pcs = [{ id: 'p1', name: 'Ada' }];
    expect(audienceSummary('all', pcs)).toBe('Shared with all players');
    expect(audienceSummary(['p1'], pcs)).toBe('Shared with Ada');
    expect(audienceSummary([], pcs)).toBe('Hidden from players');
  });

  it('resolves legacy lore links', () => {
    const b = { handouts: [handout('h1', 0)], notes: [note('n1', 0)] };
    expect(resolveLoreRoute('h1', undefined, b)).toEqual({
      tab: 'handouts',
      itemId: 'h1',
    });
    expect(resolveLoreRoute('n1', undefined, b)).toEqual({
      tab: 'notes',
      itemId: 'n1',
    });
    expect(resolveLoreRoute('clue-9', undefined, b)).toEqual({ tab: 'notes' });
    expect(resolveLoreRoute('handouts', 'h1', b)).toEqual({
      tab: 'handouts',
      itemId: 'h1',
    });
  });
});

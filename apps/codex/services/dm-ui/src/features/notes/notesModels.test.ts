import { describe, expect, it } from 'vitest';

import type { CampaignNote } from '@/demo/fixture-registry';

import {
  anchorFromKey,
  anchorKey,
  audienceFromShare,
  audienceSummary,
  bodyPreview,
  buildNotesModel,
  filterOptions,
  noteDraftToPatch,
  noteToDraft,
  shareMode,
} from './notesModels';

const note = (
  id: string,
  order: number,
  extra: Partial<CampaignNote> = {},
): CampaignNote => ({
  id,
  campaignId: 'c',
  title: `Title ${id}`,
  body: `Body of **${id}**`,
  anchor: { type: 'campaign' },
  audience: 'none',
  color: 'yellow',
  size: 'small',
  order,
  ...extra,
});

const bundle = (notes: CampaignNote[]) => ({
  notes,
  sessions: [
    { id: 's1', number: 1, title: 'Opening' },
    { id: 's2', number: 2, title: 'Harbor' },
  ] as never,
  sceneTemplates: [{ id: 'sc1', title: 'Docks' }],
});

describe('anchor keys', () => {
  it('round-trips and falls back to campaign', () => {
    expect(anchorKey({ type: 'session', id: 's1' })).toBe('session:s1');
    expect(anchorFromKey('scene:a:b')).toEqual({ type: 'scene', id: 'a:b' });
    expect(anchorFromKey('nonsense')).toEqual({ type: 'campaign' });
    expect(anchorKey({ type: 'campaign' })).toBe('campaign');
  });
});

describe('buildNotesModel', () => {
  const notes = [
    note('b', 2, { anchor: { type: 'session', id: 's2' } }),
    note('a', 1, { audience: 'all', body: 'find the KEY here' }),
    note('c', 3, { anchor: { type: 'scene', id: 'sc1' } }),
  ];

  it('sorts by order and builds row fields', () => {
    const model = buildNotesModel(bundle(notes));
    expect(model.rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(model.total).toBe(3);
    expect(model.rows[0]).toMatchObject({
      anchorLabel: 'Campaign-wide',
      shared: true,
      preview: 'find the KEY here',
    });
    expect(model.rows[1]).toMatchObject({
      anchorLabel: 'Session 2',
      shared: false,
    });
    expect(model.rows[2].anchorLabel).toBe('Scene: Docks');
  });

  it('filters by anchor and searches title and body', () => {
    const ids = (query: { q?: string; anchor?: string }) =>
      buildNotesModel(bundle(notes), query).rows.map((row) => row.id);
    expect(ids({ anchor: 'session:s2' })).toEqual(['b']);
    expect(ids({ anchor: 'campaign' })).toEqual(['a']);
    expect(ids({ q: 'key' })).toEqual(['a']);
    expect(ids({ q: 'title c' })).toEqual(['c']);
  });

  it('offers Campaign-wide plus only the used sessions and scenes', () => {
    expect(filterOptions(bundle(notes)).map((o) => o.value)).toEqual([
      'campaign',
      'session:s2',
      'scene:sc1',
    ]);
    expect(filterOptions(bundle([])).map((o) => o.value)).toEqual(['campaign']);
  });
});

describe('preview and audience', () => {
  it('flattens markdown and truncates', () => {
    expect(bodyPreview('# Head\n\n- one\n- **two**')).toBe('Head one two');
    expect(bodyPreview('x'.repeat(200))).toHaveLength(90);
  });

  it('maps share modes', () => {
    expect(shareMode('none')).toBe('none');
    expect(shareMode('all')).toBe('all');
    expect(shareMode(['pc'])).toBe('selected');
    expect(audienceFromShare('selected', [])).toBe('none');
    expect(audienceFromShare('selected', ['pc'])).toEqual(['pc']);
    expect(audienceFromShare('all', ['pc'])).toBe('all');
    expect(audienceSummary(['a', 'z'], [{ id: 'a', name: 'Ada' }])).toBe(
      'Shared with Ada, z',
    );
    expect(audienceSummary('all', [])).toBe('Shared with all players');
  });
});

describe('noteDraftToPatch', () => {
  const initial = noteToDraft(note('a', 0));

  it('emits only changed fields', () => {
    expect(noteDraftToPatch(initial, initial)).toEqual({});
    expect(
      noteDraftToPatch(
        {
          ...initial,
          title: 'New',
          anchor: 'session:s1',
          share: 'selected',
          characterIds: ['pc1'],
        },
        initial,
      ),
    ).toEqual({
      title: 'New',
      anchor: { type: 'session', id: 's1' },
      audience: ['pc1'],
    });
  });

  it('treats selected-with-nobody as unchanged private', () => {
    expect(noteDraftToPatch({ ...initial, share: 'selected' }, initial)).toEqual(
      {},
    );
  });
});

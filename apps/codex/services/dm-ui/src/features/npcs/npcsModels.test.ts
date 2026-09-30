import { describe, expect, it } from 'vitest';

import type { CampaignNpc } from '@/demo/ashes-of-veyra/types';
import {
  createEmptyBundle,
  getFixtureBundle,
  listFixtureBundles,
  type CampaignFixtureBundle,
} from '@/demo/fixture-registry';

import {
  buildNpcsModel,
  monogramFor,
  npcFactions,
  npcQuestsGiven,
  resolveSort,
} from './npcsModels';

function fixture(slug: string): CampaignFixtureBundle {
  const bundle = getFixtureBundle(slug, 'test');
  if (!bundle) throw new Error(slug);
  return bundle;
}

function withNpc(
  bundle: CampaignFixtureBundle,
  npc: Partial<CampaignNpc>,
): CampaignFixtureBundle {
  const extra: CampaignNpc = {
    id: 'npc-extra',
    campaignId: bundle.campaignId,
    name: 'Zed Loner',
    role: '',
    ancestry: '',
    factionIds: [],
    motivation: '',
    relationship: '',
    locationIds: [],
    sessionIds: [],
    portraitFallback: '',
    tags: [],
    ...npc,
  };
  return { ...bundle, npcs: [...bundle.npcs, extra] };
}

describe('buildNpcsModel', () => {
  it('groups by primary faction with Unaffiliated last', () => {
    const model = buildNpcsModel(withNpc(fixture('ashes-of-veyra'), {}));
    const labels = model.groups.map((group) => group.label);
    expect(labels.at(-1)).toBe('Unaffiliated');
    expect(labels).toContain('Harbor Watch');
    expect(model.groups.flatMap((g) => g.items)).toHaveLength(model.total);
  });

  it('sorts by last appearance for active campaigns, then name', () => {
    const bundle = fixture('ashes-of-veyra');
    expect(resolveSort(bundle)).toBe('last-appearance');
    const rows = buildNpcsModel(bundle).rows;
    const last = rows.map((row) => row.lastAppearance);
    expect([...last].sort((a, b) => b - a)).toEqual(last);
    const serin = rows.find((row) => row.id === 'npc-captain-serin');
    expect(serin?.lastAppearance).toBe(13);
  });

  it('defaults to name for draft and complete, honors explicit sort', () => {
    expect(resolveSort(fixture('crown-of-cinders'))).toBe('name');
    expect(resolveSort(fixture('stars-below-kharad'))).toBe('name');
    expect(resolveSort(fixture('lanterns-of-mourningfen'))).toBe(
      'last-appearance',
    );
    const rows = buildNpcsModel(fixture('ashes-of-veyra'), {
      sort: 'name',
    }).rows;
    const names = rows.map((row) => row.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('puts the default sort first in sortOptions', () => {
    expect(buildNpcsModel(fixture('ashes-of-veyra')).sortOptions[0].value).toBe(
      'last-appearance',
    );
    expect(
      buildNpcsModel(fixture('crown-of-cinders')).sortOptions[0].value,
    ).toBe('name');
  });

  it('filters by faction, unaffiliated, tag and search', () => {
    const bundle = withNpc(fixture('ashes-of-veyra'), { tags: ['loner'] });
    const faction = buildNpcsModel(bundle, { faction: 'faction-harbor-watch' });
    expect(faction.rows.length).toBeGreaterThan(0);
    expect(
      faction.rows.every((row) => row.factionId === 'faction-harbor-watch'),
    ).toBe(true);
    const none = buildNpcsModel(bundle, { faction: 'none' });
    expect(none.rows.map((row) => row.id)).toContain('npc-extra');
    expect(buildNpcsModel(bundle, { tag: 'loner' }).rows).toHaveLength(1);
    expect(buildNpcsModel(bundle, { q: 'serin' }).rows[0].id).toBe(
      'npc-captain-serin',
    );
    expect(buildNpcsModel(bundle, { q: 'zzzz-nope' }).rows).toHaveLength(0);
  });

  it('marks Unused only in draft campaigns', () => {
    const draft = withNpc(fixture('crown-of-cinders'), {});
    const model = buildNpcsModel(draft);
    expect(model.rows.find((r) => r.id === 'npc-extra')?.unused).toBe(true);
    expect(model.unusedCount).toBeGreaterThanOrEqual(1);
    const active = withNpc(fixture('ashes-of-veyra'), {});
    expect(buildNpcsModel(active).unusedCount).toBe(0);
  });

  it('exposes quests given and led factions', () => {
    const bundle = fixture('ashes-of-veyra');
    expect(
      npcQuestsGiven(bundle, 'npc-captain-serin').map((q) => q.title),
    ).toContain('Find the Ember Key');
    const rook = bundle.npcs.find((npc) => npc.id === 'npc-elian-rook');
    expect(rook).toBeDefined();
    expect(
      npcFactions(bundle, rook as CampaignNpc).some(
        (f) => f.id === 'faction-harbor-watch' && f.leads,
      ),
    ).toBe(true);
  });

  it('is well-formed for every fixture and the empty bundle', () => {
    for (const bundle of listFixtureBundles('test')) {
      const model = buildNpcsModel(bundle);
      expect(model.rows).toHaveLength(bundle.npcs.length);
    }
    const empty = createEmptyBundle({
      id: 'c1',
      name: 'Blank',
      description: '',
      createdAt: '',
      updatedAt: '',
    });
    const model = buildNpcsModel(empty);
    expect(model.total).toBe(0);
    expect(model.groups).toEqual([]);
  });

  it('builds monograms', () => {
    expect(monogramFor({ name: 'Ann Bell', portraitFallback: '' })).toBe('AB');
    expect(monogramFor({ name: 'Ann Bell', portraitFallback: 'X' })).toBe('X');
  });
});

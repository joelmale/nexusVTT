import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';

import {
  buildQuestPatch,
  buildQuestsModel,
  objectiveProgress,
  objectivesFor,
  toQuestDraft,
  toServerObjectives,
} from './questsModels';

const ashes = getFixtureBundle('ashes-of-veyra')!;

describe('questsModels', () => {
  it('groups by status and collapses complete for non-complete campaigns', () => {
    const model = buildQuestsModel(ashes);
    expect(model.groups.map((g) => g.id)).toEqual([
      'active',
      'on-hold',
      'not-started',
      'complete',
    ]);
    const completeCount = ashes.quests.filter(
      (q) => q.status === 'complete',
    ).length;
    expect(model.collapsedCompleteCount).toBe(completeCount);
    const expanded = buildQuestsModel(ashes, { showComplete: true });
    expect(expanded.groups[3].items).toHaveLength(completeCount);
  });

  it('puts complete first and expanded in complete campaigns', () => {
    const bundle = getFixtureBundle('stars-below-kharad')!;
    const model = buildQuestsModel(bundle);
    expect(model.groups[0].id).toBe('complete');
    expect(model.collapsedCompleteCount).toBe(0);
  });

  it('flags open threads only in paused campaigns', () => {
    const paused = getFixtureBundle('lanterns-of-mourningfen')!;
    const rows = buildQuestsModel(paused, { showComplete: true }).groups.flatMap(
      (g) => g.items,
    );
    expect(rows.some((r) => r.openThread)).toBe(true);
    expect(
      rows
        .filter((r) => r.openThread)
        .every((r) => ['active', 'on-hold'].includes(r.quest.status)),
    ).toBe(true);
    expect(
      buildQuestsModel(ashes)
        .groups.flatMap((g) => g.items)
        .some((r) => r.openThread),
    ).toBe(false);
  });

  it('computes objective progress and orders objectives', () => {
    const quest = ashes.quests.find((q) => q.objectiveIds.length > 1)!;
    const objectives = objectivesFor(ashes, quest);
    const orders = objectives.map((o) => o.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(objectiveProgress(objectives).total).toBe(objectives.length);
  });

  it('filters by priority and search', () => {
    const high = buildQuestsModel(ashes, {
      priority: 'high',
      showComplete: true,
    });
    expect(
      high.groups
        .flatMap((g) => g.items)
        .every((r) => r.quest.priority === 'high'),
    ).toBe(true);
    expect(buildQuestsModel(ashes, { q: 'zzzz-nothing' }).filteredCount).toBe(
      0,
    );
  });

  it('builds a minimal patch and reassigns objective order', () => {
    const quest = ashes.quests.find((q) => q.objectiveIds.length > 0)!;
    const initial = toQuestDraft(ashes, quest);
    expect(buildQuestPatch(initial, initial)).toEqual({});
    const edited = {
      ...initial,
      summary: 'New',
      objectives: [
        ...initial.objectives,
        {
          key: 'n',
          title: ' Added ',
          status: 'pending' as const,
          locationIds: [],
        },
        {
          key: 'blank',
          title: '  ',
          status: 'pending' as const,
          locationIds: [],
        },
      ],
    };
    const patch = buildQuestPatch(edited, initial);
    expect(Object.keys(patch).sort()).toEqual(['objectives', 'summary']);
    const objectives = patch.objectives as ReturnType<
      typeof toServerObjectives
    >;
    expect(objectives.at(-1)).toMatchObject({
      title: 'Added',
      order: initial.objectives.length + 1,
    });
    expect(objectives.at(-1)).not.toHaveProperty('id');
  });
});

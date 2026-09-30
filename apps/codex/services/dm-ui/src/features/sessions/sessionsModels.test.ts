import { describe, expect, it } from 'vitest';

import {
  createEmptyBundle,
  getFixtureBundle,
  type CampaignFixtureBundle,
} from '@/demo/fixture-registry';

import {
  buildSessionsModel,
  pickDefaultSessionId,
  readinessOf,
} from './sessionsModels';

const SLUGS = [
  'ashes-of-veyra',
  'crown-of-cinders',
  'lanterns-of-mourningfen',
  'stars-below-kharad',
];

function bundleOf(slug: string): CampaignFixtureBundle {
  const bundle = getFixtureBundle(slug, 'test');
  if (!bundle) throw new Error(slug);
  return bundle;
}

function withLifecycle(
  bundle: CampaignFixtureBundle,
  lifecycle: CampaignFixtureBundle['lifecycle'],
): CampaignFixtureBundle {
  return { ...bundle, lifecycle };
}

describe('sessionsModels', () => {
  it.each(SLUGS)('%s: groups cover every session in number order', (slug) => {
    const bundle = bundleOf(slug);
    const model = buildSessionsModel(bundle);
    const ids = model.groups.flatMap((group) =>
      group.sessions.map((session) => session.id),
    );
    expect([...ids].sort()).toEqual(bundle.sessions.map((s) => s.id).sort());
    expect(model.totalCount).toBe(bundle.sessions.length);
    for (const group of model.groups) {
      const numbers = group.sessions.map((session) => session.number);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    }
    expect(model.timelineLabel).toBe(
      bundle.lifecycle === 'complete' ? 'Chronicle' : 'Timeline',
    );
  });

  it.each(SLUGS)('%s: default session exists', (slug) => {
    const bundle = bundleOf(slug);
    const id = pickDefaultSessionId(bundle);
    expect(bundle.sessions.some((session) => session.id === id)).toBe(true);
  });

  it('active selects the current session', () => {
    const bundle = withLifecycle(bundleOf('ashes-of-veyra'), 'active');
    expect(pickDefaultSessionId(bundle)).toBe(bundle.campaign.currentSessionId);
  });

  it('paused selects the last complete session and complete the last', () => {
    const bundle = bundleOf('ashes-of-veyra');
    const sorted = [...bundle.sessions].sort((a, b) => a.number - b.number);
    const lastComplete = [...sorted]
      .reverse()
      .find((session) => session.status === 'complete');
    expect(pickDefaultSessionId(withLifecycle(bundle, 'paused'))).toBe(
      (lastComplete ?? sorted[0]).id,
    );
    expect(pickDefaultSessionId(withLifecycle(bundle, 'complete'))).toBe(
      sorted[sorted.length - 1].id,
    );
    expect(buildSessionsModel(withLifecycle(bundle, 'complete')).canPlan).toBe(
      false,
    );
  });

  it('draft selects the first planned or draft session', () => {
    const bundle = withLifecycle(bundleOf('ashes-of-veyra'), 'draft');
    const first = [...bundle.sessions]
      .sort((a, b) => a.number - b.number)
      .find((s) => s.status === 'planned' || s.status === 'draft');
    expect(pickDefaultSessionId(bundle)).toBe(first?.id);
  });

  it('filters by status, act and search', () => {
    const bundle = bundleOf('ashes-of-veyra');
    const complete = buildSessionsModel(bundle, { status: 'complete' });
    expect(complete.visibleCount).toBe(
      bundle.sessions.filter((s) => s.status === 'complete').length,
    );
    const act = bundle.acts[0];
    const byAct = buildSessionsModel(bundle, { act: act.id });
    expect(byAct.visibleCount).toBe(
      bundle.sessions.filter((s) => s.actId === act.id).length,
    );
    const first = bundle.sessions[0];
    const search = buildSessionsModel(bundle, { q: first.title });
    expect(
      search.groups.flatMap((g) => g.sessions).map((s) => s.id),
    ).toContain(first.id);
    expect(buildSessionsModel(bundle, { q: 'zzzz-nothing' }).visibleCount).toBe(
      0,
    );
  });

  it('puts sessions with unknown acts in a Sessions group', () => {
    const bundle = bundleOf('ashes-of-veyra');
    const orphaned = {
      ...bundle,
      sessions: bundle.sessions.map((s, i) =>
        i === 0 ? { ...s, actId: 'act-missing' } : s,
      ),
    };
    const groups = buildSessionsModel(orphaned).groups;
    expect(groups[groups.length - 1].label).toBe('Sessions');
    expect(groups[groups.length - 1].sessions).toHaveLength(1);
  });

  it('handles empty bundles and act-less bundles', () => {
    const empty = createEmptyBundle({
      id: 'c1',
      name: 'X',
      createdAt: '',
      updatedAt: '',
    });
    const model = buildSessionsModel(empty);
    expect(model.totalCount).toBe(0);
    expect(model.defaultSessionId).toBeUndefined();
    const ungrouped = buildSessionsModel({
      ...bundleOf('ashes-of-veyra'),
      acts: [],
    });
    expect(ungrouped.groups).toHaveLength(1);
    expect(ungrouped.groups[0].label).toBeUndefined();
  });

  it('computes plan readiness only for sessions with a plan', () => {
    const bundle = bundleOf('ashes-of-veyra');
    const planned = bundle.sessions.find((s) => s.plan);
    const unplanned = bundle.sessions.find((s) => !s.plan);
    expect(planned && readinessOf(planned)?.total).toBeGreaterThan(0);
    if (unplanned) expect(readinessOf(unplanned)).toBeUndefined();
  });
});

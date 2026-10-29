import { describe, expect, it } from 'vitest';

import { ashesOfVeyra, inspectFixtureIntegrity } from './index';

describe('Ashes of Veyra fixtures', () => {
  it('keeps every cross-reference and normalized map coordinate valid', () => {
    expect(inspectFixtureIntegrity()).toEqual([]);
  });

  it('contains the representative campaign breadth used by the prototype', () => {
    expect(ashesOfVeyra.acts).toHaveLength(3);
    expect(ashesOfVeyra.sessions).toHaveLength(13);
    expect(ashesOfVeyra.pins).toHaveLength(6);
    expect(ashesOfVeyra.npcs).toHaveLength(14);
    expect(ashesOfVeyra.factions).toHaveLength(7);
    expect(ashesOfVeyra.quests).toHaveLength(9);
    expect(ashesOfVeyra.encounters).toHaveLength(12);
    expect(ashesOfVeyra.clues).toHaveLength(12);
    expect(ashesOfVeyra.handouts).toHaveLength(17);
    expect(ashesOfVeyra.locations).toHaveLength(14);
    expect(
      ashesOfVeyra.sessions.find((session) => session.number === 12)?.plan,
    ).toBeDefined();
  });

  it('keeps lifecycle consistent: completed history, planned future', () => {
    const byNumber = (n: number) =>
      ashesOfVeyra.sessions.find((session) => session.number === n);
    expect(
      ashesOfVeyra.sessions
        .filter((session) => session.number <= 11)
        .every((session) => session.status === 'complete'),
    ).toBe(true);
    expect(byNumber(12)?.status).toBe('draft');
    expect(byNumber(13)?.status).toBe('planned');
    expect(byNumber(13)?.plan?.steps.length).toBeGreaterThan(5);
    for (const quest of ashesOfVeyra.quests.filter(
      (item) => item.status === 'complete',
    )) {
      expect(quest.resolution).toBeTruthy();
    }
  });
});

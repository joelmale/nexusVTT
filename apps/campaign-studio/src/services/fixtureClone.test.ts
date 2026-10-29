import { describe, expect, it } from 'vitest';

import { listFixtureBundles } from '../demo/fixture-registry/registry';

import { prepareFixtureForClone } from './fixtureClone';

describe('prepareFixtureForClone', () => {
  it.each(listFixtureBundles('test').map((b) => [b.slug, b] as const))(
    '%s keeps the authored world and drops play-state',
    (_slug, example) => {
      const clone = prepareFixtureForClone(example);

      // Authored content survives untouched.
      expect(clone.npcs).toBe(example.npcs);
      expect(clone.locations).toBe(example.locations);
      expect(clone.encounters).toBe(example.encounters);
      expect(clone.sessions.map((s) => s.title)).toEqual(
        example.sessions.map((s) => s.title),
      );
      expect(clone.quests.map((q) => q.title)).toEqual(
        example.quests.map((q) => q.title),
      );

      // Play-state is reset.
      expect(clone.campaign.playerCharacters).toEqual([]);
      for (const session of clone.sessions) {
        expect(session.status).toBe('draft');
        expect(session).not.toHaveProperty('plannedDate');
        expect(session).not.toHaveProperty('durationHours');
        if (session.plan) {
          expect(session.plan.revision).toBe(1);
          expect(session.plan.lastEdited).toBe('');
          expect(session.plan.readiness.every((r) => !r.complete)).toBe(true);
        }
      }
      expect(clone.acts.every((a) => a.status === 'planned')).toBe(true);
      expect(clone.quests.every((q) => q.status === 'not-started')).toBe(true);
      expect(clone.quests.some((q) => 'resolution' in q)).toBe(false);
      expect(clone.objectives.every((o) => o.status === 'pending')).toBe(true);
      expect(clone.clues.every((c) => c.status === 'unresolved')).toBe(true);
      expect(clone.handouts.every((h) => h.audience === 'hidden')).toBe(true);
      expect(clone.notes.every((n) => n.audience === 'none')).toBe(true);
    },
  );

  it('does not mutate the frozen example', () => {
    const [example] = listFixtureBundles('test');
    const before = JSON.stringify(example);
    prepareFixtureForClone(example);
    expect(JSON.stringify(example)).toBe(before);
  });
});

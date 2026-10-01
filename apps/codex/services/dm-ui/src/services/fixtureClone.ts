import type { CampaignFixtureBundle } from '../demo/fixture-registry/types';

/**
 * Strips an example's play-state before it is cloned into a real campaign.
 *
 * Examples describe a campaign at some point in play: a party, dates, played
 * sessions, quest progress, solved clues, handouts already shown to players.
 * None of that is true of a campaign the DM has just created, so a clone keeps
 * the authored world and prep (people, places, factions, quests, encounters,
 * clues, lore, session outlines and plans) and resets everything that only
 * real play or real people can produce:
 *
 * - party: dropped; real players join the new campaign themselves
 * - sessions: unscheduled drafts (no date, duration or completed status)
 * - session plans: revision 1, never edited, every readiness item open
 * - acts: planned
 * - quests: not started, no resolution; objectives pending
 * - clues: unresolved
 * - handouts and notes: hidden from players (nothing has been shared yet)
 *
 * Curated overview data (`nextSession`, `activity`) is never cloned; a real
 * campaign derives it from its own sessions and edit history.
 */
export function prepareFixtureForClone(
  fixture: CampaignFixtureBundle,
): CampaignFixtureBundle {
  return {
    ...fixture,
    campaign: {
      ...fixture.campaign,
      playerCharacters: [],
    },
    acts: fixture.acts.map((act) => ({ ...act, status: 'planned' })),
    sessions: fixture.sessions.map((session) => {
      const rest = { ...session };
      delete rest.plannedDate;
      delete rest.durationHours;
      return {
        ...rest,
        status: 'draft',
        ...(session.plan
          ? {
              plan: {
                ...session.plan,
                revision: 1,
                lastEdited: '',
                readiness: session.plan.readiness.map((item) => ({
                  ...item,
                  complete: false,
                })),
                dependencies: session.plan.dependencies.map((dependency) => ({
                  ...dependency,
                  status: 'needs-review',
                })),
              },
            }
          : {}),
      };
    }),
    quests: fixture.quests.map((quest) => {
      const rest = { ...quest, status: 'not-started' as const };
      delete rest.resolution;
      return rest;
    }),
    objectives: fixture.objectives.map((objective) => ({
      ...objective,
      status: 'pending',
    })),
    clues: fixture.clues.map((clue) => ({ ...clue, status: 'unresolved' })),
    handouts: fixture.handouts.map((handout) => ({
      ...handout,
      visibility: 'dm-only',
      audience: 'hidden',
    })),
    notes: fixture.notes.map((note) => ({ ...note, audience: 'none' })),
  };
}

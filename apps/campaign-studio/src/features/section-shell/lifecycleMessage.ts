import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

/** Highest complete session number, for the paused banner. */
function lastPlayedNumber(bundle: CampaignFixtureBundle): number | undefined {
  const numbers = bundle.sessions
    .filter((session) => session.status === 'complete')
    .map((session) => session.number);
  return numbers.length ? Math.max(...numbers) : undefined;
}

export function lifecycleMessage(
  bundle: CampaignFixtureBundle,
): string | undefined {
  switch (bundle.lifecycle) {
    case 'draft':
      return 'Draft campaign — nothing has been played yet.';
    case 'paused': {
      const last = lastPlayedNumber(bundle);
      return last === undefined
        ? 'Paused.'
        : `Paused — last played Session ${last}.`;
    }
    case 'complete':
      return 'Campaign complete — read as a chronicle.';
    default:
      return undefined;
  }
}

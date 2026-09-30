import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import {
  createEmptyBundle,
  getFixtureBundle,
  type CampaignFixtureBundle,
} from '@/demo/fixture-registry';
import { useCampaignContext } from '@/features/campaigns/CampaignContext';

export type BundleState =
  | { status: 'loading' }
  | {
      status: 'missing';
      reason: 'unknown-slug' | 'campaign-unavailable';
      message?: string;
    }
  | { status: 'ready'; bundle: CampaignFixtureBundle; basePath: string };

/**
 * Resolves the read model for the current route: a fixture bundle under
 * `/demo/:fixtureSlug`, or an honest empty bundle for a real server campaign
 * under `/campaigns/:campaignId`.
 */
export function useCampaignBundle(): BundleState {
  const { fixtureSlug } = useParams();
  const { activeCampaign, error, state } = useCampaignContext();

  const fixtureBundle = useMemo(
    () => (fixtureSlug ? getFixtureBundle(fixtureSlug) : undefined),
    [fixtureSlug],
  );
  const emptyBundle = useMemo(
    () =>
      !fixtureSlug && activeCampaign
        ? createEmptyBundle(activeCampaign)
        : undefined,
    [fixtureSlug, activeCampaign],
  );

  if (fixtureSlug) {
    return fixtureBundle
      ? {
          status: 'ready',
          bundle: fixtureBundle,
          basePath: `/demo/${fixtureSlug}`,
        }
      : { status: 'missing', reason: 'unknown-slug' };
  }
  if (state === 'loading') return { status: 'loading' };
  if (!activeCampaign || !emptyBundle) {
    return {
      status: 'missing',
      reason: 'campaign-unavailable',
      message: error,
    };
  }
  return {
    status: 'ready',
    bundle: emptyBundle,
    basePath: `/campaigns/${encodeURIComponent(activeCampaign.id)}`,
  };
}

import { useCampaignContext } from '@/features/campaigns/CampaignContext';
import { useCapabilityNotice } from '@/features/capability-notice';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';

import styles from './CampaignLandingRoute.module.css';

export function CampaignLandingRoute() {
  const { error, reload, state } = useCampaignContext();
  const { notifyCapability } = useCapabilityNotice();
  const authenticationRequired = state === 'authentication-required';

  return (
    <StudioFrame onCapability={notifyCapability}>
      <main className={styles.main}>
        <div className={styles.card}>
          <h1>
            {authenticationRequired
              ? 'Sign in to load campaigns'
              : state === 'error'
                ? 'Campaigns are unavailable'
                : 'Create your first campaign'}
          </h1>
          <p>
            {error ??
              'Use the campaign switcher to create a blank server-backed campaign, or explore the Ashes of Veyra sample.'}
          </p>
          {(state === 'error' || authenticationRequired) && (
            <button onClick={() => void reload()} type="button">
              Retry
            </button>
          )}
        </div>
      </main>
    </StudioFrame>
  );
}

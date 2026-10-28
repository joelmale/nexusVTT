import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCampaignContext } from '@/features/campaigns/CampaignContext';
import { CampaignSettingsModal } from '@/features/campaigns/CampaignSettingsModal';
import { CreateCampaignDialog } from '@/features/campaigns/CreateCampaignDialog';
import { useCapabilityNotice } from '@/features/capability-notice';
import { MoodPickerModal } from '@/features/moods';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';

import styles from './CampaignLandingRoute.module.css';

export function CampaignLandingRoute() {
  const { activeCampaign, error, reload, state } = useCampaignContext();
  const { notifyCapability } = useCapabilityNotice();
  const navigate = useNavigate();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const authenticationRequired = state === 'authentication-required';

  return (
    <StudioFrame
      onCapability={notifyCapability}
      onSettings={activeCampaign ? () => setSettingsOpen(true) : undefined}
      onTheme={() => setMoodPickerOpen(true)}
    >
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
          {state === 'error' || authenticationRequired ? (
            <button onClick={() => void reload()} type="button">
              Retry
            </button>
          ) : (
            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                onClick={() => setCreateDialogOpen(true)}
                ref={createButtonRef}
                type="button"
              >
                Create campaign
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => navigate('/demo/ashes-of-veyra/overview')}
                type="button"
              >
                Explore Ashes of Veyra
              </button>
            </div>
          )}
        </div>
      </main>

      <CreateCampaignDialog
        onClose={() => setCreateDialogOpen(false)}
        open={createDialogOpen}
        returnFocusRef={createButtonRef}
      />
      <MoodPickerModal
        isOpen={moodPickerOpen}
        onClose={() => setMoodPickerOpen(false)}
      />
      {activeCampaign ? (
        <CampaignSettingsModal
          campaign={activeCampaign}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </StudioFrame>
  );
}

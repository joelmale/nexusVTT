import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useCampaignContext } from '@/features/campaigns/CampaignContext';
import { useCapabilityNotice } from '@/features/capability-notice';

import { useSectionBundle } from './SectionContext';
import { useServerBackend } from './ServerBackendContext';
import styles from './StartFromExample.module.css';

interface StartFromExampleProps {
  /**
   * Overrides the backend's seeding call (resolves the new campaign id). When
   * neither this nor a server backend exists, the capability notice shows.
   */
  seedFromFixture?: (slug: string) => Promise<string>;
}

/**
 * "Start from this example" for example campaigns. Creates a real campaign
 * seeded from the fixture, then opens the same section in it.
 */
export function StartFromExample({ seedFromFixture }: StartFromExampleProps) {
  const { exampleSlug } = useSectionBundle();
  const { backend } = useServerBackend();
  const { reload } = useCampaignContext();
  const { notifyCapability } = useCapabilityNotice();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!exampleSlug) return null;
  const seed = seedFromFixture ?? backend?.seedFromFixture;

  const start = async () => {
    if (!seed) {
      notifyCapability('campaign.example.seed');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const campaignId = await seed(exampleSlug);
      await reload();
      const section = pathname.split('/')[3] || 'overview';
      navigate(`/campaigns/${encodeURIComponent(campaignId)}/${section}`);
    } catch (thrown) {
      setError(
        thrown instanceof Error ? thrown.message : 'Could not create campaign.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <button
        className={styles.button}
        disabled={busy}
        onClick={() => void start()}
        type="button"
      >
        {busy ? 'Creating campaign…' : 'Start from this example'}
      </button>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

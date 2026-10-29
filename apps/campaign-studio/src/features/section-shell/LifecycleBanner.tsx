import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

import { lifecycleMessage } from './lifecycleMessage';
import styles from './LifecycleBanner.module.css';

export function LifecycleBanner({ bundle }: { bundle: CampaignFixtureBundle }) {
  const message = lifecycleMessage(bundle);
  if (!message) return null;
  const tone = bundle.lifecycle === 'draft' ? styles.draft : styles.info;
  return (
    <p className={`${styles.banner} ${tone}`} role="status">
      {message}
    </p>
  );
}

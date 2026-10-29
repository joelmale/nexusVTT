import type { CampaignItemRarity } from '@/demo/fixture-registry';

import { RARITY_LABELS } from './itemsModel';
import styles from './RarityBadge.module.css';

interface RarityBadgeProps {
  rarity: CampaignItemRarity;
  className?: string;
}

export function RarityBadge({ rarity, className }: RarityBadgeProps) {
  if (rarity === 'none') return null;

  const badgeClass = `${styles.badge} ${styles[rarity] ?? ''} ${className ?? ''}`.trim();

  return (
    <span className={badgeClass}>
      {RARITY_LABELS[rarity]}
    </span>
  );
}

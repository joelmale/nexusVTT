import EyeOff from 'lucide-react/dist/esm/icons/eye-off';

import type { CampaignItem } from '@/demo/fixture-registry';

import { getItemTypeLabel } from './itemSearch';
import { getItemTypeIcon } from './itemTypeIcons';
import { RarityBadge } from './RarityBadge';
import styles from './ItemRow.module.css';

export interface ItemRowProps {
  item: CampaignItem;
  heldBy?: string;
}

/**
 * Two-line item row for Treasury lists.
 * Top line: type icon · name (quantity) · rarity badge · undiscovered flag.
 * Bottom line: item type · value gp · weight lb · holder · attunement requirement.
 */
export function ItemRow({ item, heldBy }: ItemRowProps) {
  const Icon = getItemTypeIcon(item.itemType);
  const typeLabel = getItemTypeLabel(item.itemType);

  const metaParts: Array<{ key: string; content: React.ReactNode }> = [
    { key: 'type', content: typeLabel },
  ];

  if (item.valueGp !== undefined) {
    metaParts.push({ key: 'value', content: `${item.valueGp.toLocaleString()} gp` });
  }

  if (item.weightLb !== undefined) {
    metaParts.push({ key: 'weight', content: `${item.weightLb} lb` });
  }

  if (heldBy) {
    metaParts.push({ key: 'holder', content: heldBy });
  }

  if (item.requiresAttunement) {
    metaParts.push({
      key: 'attune',
      content: (
        <span className={styles.attunement}>
          ◇ {item.attunementNote ? `Attune (${item.attunementNote})` : 'Attunement'}
        </span>
      ),
    });
  }

  return (
    <div
      className={`${styles.row} ${!item.discovered ? styles.veiled : ''}`}
      data-rarity={item.rarity}
      data-testid={`item-row-${item.id}`}
    >
      <div className={styles.primaryLine}>
        <Icon aria-hidden="true" className={styles.typeIcon} size={15} />
        <span className={styles.name}>
          {item.name}
          {item.playerName ? ` ("${item.playerName}")` : ''}
        </span>
        {item.quantity > 1 ? (
          <span className={styles.quantity}>x{item.quantity}</span>
        ) : null}
        <div className={styles.badges}>
          <RarityBadge rarity={item.rarity} />
          {!item.discovered ? (
            <span
              aria-label="Undiscovered by players"
              className={styles.veiledBadge}
              role="status"
            >
              <EyeOff aria-hidden="true" size={12} />
              Undiscovered
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.metaLine}>
        {metaParts.map((part, index) => (
          <span key={part.key}>
            {index > 0 ? (
              <span aria-hidden="true" className={styles.separator}>
                ·{' '}
              </span>
            ) : null}
            {part.content}
          </span>
        ))}
      </div>
    </div>
  );
}

import Check from 'lucide-react/dist/esm/icons/check';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle';

import {
  type CampaignFixtureBundle,
  type CampaignItem,
  resolveEntity,
} from '@/demo/fixture-registry';
import { MentionText } from '@/features/mentions/MentionText';
import { EntityChip, EntityLink } from '@/features/section-shell/EntityLink';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { mentionIds } from '@/lib/mentions';

import { formatItemSubtitle } from './itemSearch';
import { RarityBadge } from './RarityBadge';
import styles from './ItemCard.module.css';

export interface ItemCardProps {
  item: CampaignItem;
  bundle: CampaignFixtureBundle;
  heldBy?: string;
  partyHolder?: boolean;
  onQuickUpdate?: (patch: Partial<CampaignItem>) => Promise<void> | void;
  editable?: boolean;
  hideHeaderTitle?: boolean;
}

/**
 * ItemCard renders the detailed view of an item using book-style layout,
 * Fraunces display typography, stats ribbon, and inline quick-toggles.
 */
export function ItemCard({
  item,
  bundle,
  heldBy,
  partyHolder,
  onQuickUpdate,
  editable = false,
  hideHeaderTitle = false,
}: ItemCardProps) {
  const subtitle = formatItemSubtitle(item);

  const cardRarityClass =
    item.rarity === 'legendary'
      ? styles.legendarySheen
      : item.rarity === 'artifact'
        ? styles.artifactSheen
        : '';

  return (
    <div
      className={`${styles.card} ${cardRarityClass}`}
      data-rarity={item.rarity}
      data-testid={`item-card-${item.id}`}
    >
      <header className={styles.header}>
        {!hideHeaderTitle ? (
          <div className={styles.headerTop}>
            <h2 className={styles.title}>{item.name}</h2>
            <div className={styles.headerBadges}>
              <RarityBadge rarity={item.rarity} />
            </div>
          </div>
        ) : null}

        <p className={styles.subtitle}>{subtitle}</p>

        {editable && onQuickUpdate ? (
          <div aria-label="Placement quick toggles" className={styles.quickToggles} role="group">
            <button
              aria-label={`Mark as ${item.discovered ? 'undiscovered' : 'discovered'}`}
              className={`${styles.quickToggleBtn} ${item.discovered ? styles.quickToggleActive : ''}`}
              onClick={() => onQuickUpdate({ discovered: !item.discovered })}
              type="button"
            >
              {item.discovered ? (
                <Eye aria-hidden="true" size={14} />
              ) : (
                <EyeOff aria-hidden="true" size={14} />
              )}
              <span>{item.discovered ? 'Discovered' : 'Undiscovered'}</span>
            </button>

            <button
              aria-label={`Mark as ${item.identified ? 'unidentified' : 'identified'}`}
              className={`${styles.quickToggleBtn} ${item.identified ? styles.quickToggleActive : ''}`}
              onClick={() => onQuickUpdate({ identified: !item.identified })}
              type="button"
            >
              {item.identified ? (
                <Check aria-hidden="true" size={14} />
              ) : (
                <HelpCircle aria-hidden="true" size={14} />
              )}
              <span>{item.identified ? 'Identified' : 'Unidentified'}</span>
            </button>
          </div>
        ) : (
          <div className={styles.quickToggles}>
            <StatusBadge tone={item.discovered ? 'positive' : 'warning'}>
              {item.discovered ? 'Discovered' : 'Undiscovered'}
            </StatusBadge>
            <StatusBadge tone={item.identified ? 'positive' : 'neutral'}>
              {item.identified ? 'Identified' : 'Unidentified'}
            </StatusBadge>
          </div>
        )}
      </header>

      <div aria-label="Item statistics" className={styles.statsRibbon} role="region">
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Value</span>
          <span className={styles.statValue}>
            {item.valueGp !== undefined ? `${item.valueGp.toLocaleString()} gp` : '—'}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Weight</span>
          <span className={styles.statValue}>
            {item.weightLb !== undefined ? `${item.weightLb} lb` : '—'}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Quantity</span>
          <span className={styles.statValue}>{item.quantity || 1}</span>
        </div>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Held by</h3>
        {item.holder.id && heldBy ? (
          partyHolder ? (
            <span>{heldBy} (party)</span>
          ) : (
            <EntityLink id={item.holder.id} />
          )
        ) : (
          <p>Unassigned.</p>
        )}
      </section>

      {item.description ? (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Description</h3>
          <p className={styles.descriptionText}>
            <MentionText text={item.description} />
          </p>
        </section>
      ) : null}

      {item.mechanics ? (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Mechanics</h3>
          <p className={styles.mechanicsText}>{item.mechanics}</p>
        </section>
      ) : null}

      {item.questIds.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Quests</h3>
          <div className={styles.questChips}>
            {item.questIds.map((questId) => {
              const ref = resolveEntity(bundle, questId);
              return ref ? <EntityChip entity={ref} key={questId} /> : null;
            })}
          </div>
        </section>
      ) : null}

      <RelatedGroups
        entityId={item.id}
        exclude={['quest', 'item']}
        forwardIds={mentionIds(`${item.description}\n${item.mechanics ?? ''}`)}
      />
    </div>
  );
}

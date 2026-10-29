import type { ReactNode, MouseEvent } from 'react';
import Pin from 'lucide-react/dist/esm/icons/pin';

import styles from './RichEntityRow.module.css';

export interface RichEntityRowProps {
  /** Entity identifier passed to onTogglePin when available. */
  id?: string;
  /** Left icon, monogram, or category avatar. */
  icon?: ReactNode;
  /** Primary entity title / name. */
  title: ReactNode;
  /** Optional secondary subtitle, role, or alias. */
  subtitle?: ReactNode;
  /** List of metadata elements rendered on the second line with · separators. */
  metaParts?: Array<{ key: string; content: ReactNode }>;
  /** Badges container (rendered right-aligned on the primary line). */
  badges?: ReactNode;
  /** Whether the entity is pinned to the top (alias for isPinned). */
  pinned?: boolean;
  /** Whether the entity is pinned to the top. */
  isPinned?: boolean;
  /** Pin toggle handler. When provided, renders a toggleable pin button. */
  onTogglePin?:
    | ((idOrEvent?: string | MouseEvent<HTMLButtonElement>) => void)
    | (() => void);
  /** Veiled styling for undiscovered or secret entities. */
  veiled?: boolean;
  /** Custom test ID. */
  testId?: string;
}

/**
 * Universal two-line row component providing the consistent visual layout
 * introduced by Treasury across all Campaign Studio section lists (NPCs,
 * Quests, Encounters, Factions, etc.).
 */
export function RichEntityRow({
  id,
  icon,
  title,
  subtitle,
  metaParts = [],
  badges,
  pinned,
  isPinned,
  onTogglePin,
  veiled,
  testId,
}: RichEntityRowProps) {
  const isPinnedState = Boolean(pinned ?? isPinned);

  const handlePinClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (onTogglePin) {
      if (id !== undefined) {
        (onTogglePin as (arg?: string | MouseEvent<HTMLButtonElement>) => void)(id);
      } else {
        (onTogglePin as (arg?: string | MouseEvent<HTMLButtonElement>) => void)(event);
      }
    }
  };

  return (
    <div
      className={`${styles.row} ${veiled ? styles.veiled : ''}`}
      data-pinned={isPinnedState ? 'true' : undefined}
      data-testid={testId}
    >
      <div className={styles.primaryLine}>
        {icon ? <span className={styles.iconWrap}>{icon}</span> : null}

        <span className={styles.titleWrap}>
          <span className={styles.title}>{title}</span>
          {subtitle ? (
            <span className={styles.subtitle}>{subtitle}</span>
          ) : null}
        </span>

        <div className={styles.badges}>
          {badges}
          {onTogglePin ? (
            <button
              aria-label={isPinnedState ? 'Unpin' : 'Pin'}
              aria-pressed={isPinnedState}
              className={`${styles.pinBtn} ${isPinnedState ? styles.pinned : ''}`}
              onClick={handlePinClick}
              title={isPinnedState ? 'Pinned' : 'Pin to top'}
              type="button"
            >
              <Pin size={13} />
            </button>
          ) : isPinnedState ? (
            <span
              aria-label="Pinned"
              className={styles.pinIndicator}
              title="Pinned"
            >
              <Pin size={13} />
            </span>
          ) : null}
        </div>
      </div>

      {metaParts.length > 0 ? (
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
      ) : null}
    </div>
  );
}

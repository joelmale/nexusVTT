import React from 'react';
import styles from './ChoiceCard.module.css';
import { Sigil } from './Sigil';

interface ChoiceCardProps {
  title: string;
  /** Up to two short lines under the title. */
  details?: string[];
  selected: boolean;
  onSelect: () => void;
  /** Show the emblem. Defaults to on. */
  sigil?: boolean;
}

/** A pick-one card. Selection is announced by `aria-pressed`, not colour alone. */
export const ChoiceCard: React.FC<ChoiceCardProps> = ({
  title,
  details = [],
  selected,
  onSelect,
  sigil = true,
}) => (
  <button
    type="button"
    className={styles.card}
    aria-pressed={selected}
    onClick={onSelect}
  >
    {sigil && (
      <span className={styles.sigil}>
        <Sigil name={title} />
      </span>
    )}
    <span className={styles.title}>{title}</span>
    {details.slice(0, 2).map((line) => (
      <span key={line} className={styles.detail}>
        {line}
      </span>
    ))}
    {selected && <span className={styles.check}>✓ Chosen</span>}
  </button>
);

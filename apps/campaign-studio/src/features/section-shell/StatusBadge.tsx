import type { ReactNode } from 'react';

import styles from './StatusBadge.module.css';
import { humanize, toneFor, type Tone } from './statusTones';

interface StatusBadgeProps {
  tone?: Tone;
  /** Domain enum value; picks the tone and default text when set. */
  value?: string;
  children?: ReactNode;
}

export function StatusBadge({ tone, value, children }: StatusBadgeProps) {
  const resolved = tone ?? (value ? toneFor(value) : 'neutral');
  return (
    <span className={`${styles.badge} ${styles[resolved]}`}>
      {children ?? (value ? humanize(value) : null)}
    </span>
  );
}

/** Required marker for any DM-only content. Text, never an icon alone. */
export function DmOnlyBadge() {
  return <StatusBadge tone="neutral">DM only</StatusBadge>;
}

import type { ReactNode } from 'react';

import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Primary call-to-action button or control for the empty section. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

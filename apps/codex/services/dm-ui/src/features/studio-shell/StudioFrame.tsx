import type { ReactNode } from 'react';

import { StudioTopBar } from './StudioTopBar';
import styles from './StudioFrame.module.css';

interface StudioFrameProps {
  children: ReactNode;
  contextLabel?: string;
  onSearch?: () => void;
  onSettings?: () => void;
  onTheme?: () => void;
}

export function StudioFrame({
  children,
  contextLabel,
  onSearch,
  onSettings,
  onTheme,
}: StudioFrameProps) {
  return (
    <div className={styles.frame}>
      <StudioTopBar
        contextLabel={contextLabel}
        onSearch={onSearch}
        onSettings={onSettings}
        onTheme={onTheme}
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import type { DiceRoll } from '@/types/game';
import styles from './LiveRollToast.module.css';

export interface LiveRollToastProps {
  /** Newest first, already filtered to rolls this player may see. */
  rolls: DiceRoll[];
}

export const LIVE_ROLL_TOAST_MS = 3500;

function describe(roll: DiceRoll): string {
  const crit =
    roll.crit === 'success'
      ? ' — critical!'
      : roll.crit === 'failure'
        ? ' — fumble'
        : '';
  return `${roll.userName} rolled ${roll.expression}: ${roll.total}${crit}`;
}

/**
 * Brief banner under the ribbon whenever anyone in the room rolls, so phone
 * players see the table's dice without opening the Rolls tab. Rolls already
 * in history when it mounts are not announced.
 */
export const LiveRollToast: React.FC<LiveRollToastProps> = ({ rolls }) => {
  const latest = rolls[0];
  const [baselineId] = useState(latest?.id);
  const [dismissedId, setDismissedId] = useState<string | undefined>(undefined);

  const visible =
    latest !== undefined &&
    latest.id !== baselineId &&
    latest.id !== dismissedId;

  useEffect(() => {
    if (!visible) return undefined;
    const id = latest.id;
    const timer = setTimeout(() => setDismissedId(id), LIVE_ROLL_TOAST_MS);
    return () => clearTimeout(timer);
  }, [visible, latest]);

  if (!visible) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.text}>🎲 {describe(latest)}</span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss roll"
        onClick={() => setDismissedId(latest.id)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

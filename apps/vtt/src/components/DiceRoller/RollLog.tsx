import React, { useEffect, useRef, useState } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import Lock from 'lucide-react/dist/esm/icons/lock';
import type { DiceRoll } from '@/types/game';
import { formatRollBreakdown } from './diceNotation';
import styles from './DiceRoller.module.css';

export const LOG_COLLAPSED_KEY = 'nexus_dice_log_collapsed';

interface RollLogProps {
  /** Rolls already filtered for the viewer, newest first. */
  rolls: DiceRoll[];
}

const loadCollapsed = (): boolean => {
  try {
    return localStorage.getItem(LOG_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

export const RollLog: React.FC<RollLogProps> = ({ rolls }) => {
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);
  const listRef = useRef<HTMLDivElement>(null);
  const prevRollsCount = useRef(rolls.length);

  // Scroll to the newest entry (top) when a roll is added.
  useEffect(() => {
    if (rolls.length > prevRollsCount.current && listRef.current?.scrollTo) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevRollsCount.current = rolls.length;
  }, [rolls]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LOG_COLLAPSED_KEY, String(next));
      } catch {
        // Persistence is a convenience only.
      }
      return next;
    });
  };

  return (
    <section className={styles.logSection} aria-label="Roll log">
      <button
        type="button"
        className={styles.logHeader}
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls="dice-roll-log-list"
      >
        <span className={styles.sectionHeading}>Roll Log</span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!collapsed && (
        <div
          id="dice-roll-log-list"
          className={styles.logList}
          ref={listRef}
        >
          {rolls.length === 0 && (
            <p className={styles.logEmpty}>No dice rolls yet</p>
          )}
          {rolls.map((roll) => {
            const text = formatRollBreakdown(roll);
            const split = text.lastIndexOf(' = ');
            const head = split >= 0 ? text.slice(0, split) : text;
            const total = split >= 0 ? text.slice(split + 3) : '';
            const critClass =
              roll.crit === 'success'
                ? styles.critSuccess
                : roll.crit === 'failure'
                  ? styles.critFailure
                  : '';
            return (
              <div
                key={roll.id}
                className={styles.logRow}
                data-testid="dice-log-entry"
              >
                <span className={styles.logWho}>
                  <span aria-hidden="true" className={styles.logStar}>
                    ✱
                  </span>
                  {roll.userName}:
                </span>
                <span className={styles.logRoll}>
                  {head} = <span className={critClass}>{total}</span>
                </span>
                {roll.isPrivate && (
                  <Lock
                    size={12}
                    className={styles.logLock}
                    aria-label="Private roll"
                  />
                )}
                <time className={styles.logTime}>
                  {formatTime(roll.timestamp)}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Shield from 'lucide-react/dist/esm/icons/shield';
import type { SimpleCombatantView } from './combatView';
import type { SimpleConnectionState } from '@/hooks/useMobileSessionLifecycle';
import styles from './CompactInitiativeRibbon.module.css';

export interface CompactInitiativeRibbonProps {
  characterName?: string;
  characterAvatarUrl?: string;
  currentHp?: number;
  maxHp?: number;
  tempHp?: number;
  armorClass?: number;
  conditions: string[];
  isInCombat: boolean;
  roundNumber?: number;
  /** Already filtered to combatants players may see. */
  combatants: SimpleCombatantView[];
  activeLabel?: string;
  upNextLabel?: string;
  isMyTurn: boolean;
  connectionState: SimpleConnectionState;
  /** Set while an intent is waiting for the DM's client to apply it. */
  pendingIntent?: 'hp' | 'end-turn';
  /** Shown after an intent comes back rejected because the DM is away. */
  hostAway?: boolean;
  /** Spectators see the turn order only. */
  readOnly?: boolean;
  onAdjustHp: (delta: number) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onOpenSettings: () => void;
}

const QUICK_DELTAS = [-5, -1, 1, 5] as const;
const TURN_VIBRATION = [80, 40, 80];

const CONNECTION_LABEL: Record<SimpleConnectionState, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
};

/**
 * Always-visible top bar for Simple Player Mode: character vitals out of
 * combat, a compact initiative banner in combat.
 */
export const CompactInitiativeRibbon: React.FC<
  CompactInitiativeRibbonProps
> = ({
  characterName,
  characterAvatarUrl,
  currentHp,
  maxHp,
  tempHp = 0,
  armorClass,
  conditions,
  isInCombat,
  roundNumber,
  combatants,
  activeLabel,
  upNextLabel,
  isMyTurn,
  connectionState,
  pendingIntent,
  hostAway = false,
  readOnly = false,
  onAdjustHp,
  onEndTurn,
  onOpenSettings,
}) => {
  const [hpOpen, setHpOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const wasMyTurn = useRef(isMyTurn);

  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) {
      navigator.vibrate?.(TURN_VIBRATION);
    }
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  const hasCharacter =
    characterName !== undefined && currentHp !== undefined && !readOnly;
  const hpBusy = pendingIntent === 'hp';

  const applyCustom = (sign: 1 | -1) => {
    const amount = Number.parseInt(customAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setCustomAmount('');
    void onAdjustHp(sign * amount);
  };

  return (
    <header
      className={`${styles.ribbon} ${isMyTurn ? styles.myTurn : ''}`}
      data-testid="simple-ribbon"
    >
      <div className={styles.row}>
        {hasCharacter ? (
          <div className={styles.vitals}>
            {characterAvatarUrl && (
              <img className={styles.avatar} src={characterAvatarUrl} alt="" />
            )}
            <span className={styles.name}>{characterName}</span>
            <button
              type="button"
              className={styles.hp}
              aria-label={`Hit points ${currentHp} of ${maxHp ?? currentHp}. Adjust`}
              aria-expanded={hpOpen}
              onClick={() => setHpOpen((open) => !open)}
              disabled={hpBusy}
            >
              <Heart size={16} aria-hidden="true" />
              {currentHp}/{maxHp ?? currentHp}
              {tempHp > 0 && <span className={styles.temp}>+{tempHp}</span>}
              {hpBusy && (
                <span className={styles.spinner} aria-label="Saving" />
              )}
            </button>
            {armorClass !== undefined && (
              <span
                className={styles.ac}
                aria-label={`Armor class ${armorClass}`}
              >
                <Shield size={16} aria-hidden="true" />
                {armorClass}
              </span>
            )}
          </div>
        ) : (
          <div className={styles.vitals}>
            <span className={styles.name}>
              {readOnly ? 'Watching' : 'No character yet'}
            </span>
          </div>
        )}

        {isInCombat && (
          <button
            type="button"
            className={styles.combat}
            aria-expanded={orderOpen}
            aria-label="Turn order"
            onClick={() => setOrderOpen((open) => !open)}
          >
            {isMyTurn ? (
              <span className={styles.yourTurn}>YOUR TURN!</span>
            ) : (
              <span className={styles.current}>{activeLabel ?? '—'}</span>
            )}
            {upNextLabel && (
              <span className={styles.upNext}>Up next: {upNextLabel}</span>
            )}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}

        {isMyTurn && !readOnly && (
          <button
            type="button"
            className={styles.endTurn}
            aria-label="End Turn"
            disabled={pendingIntent === 'end-turn'}
            onClick={() => void onEndTurn()}
          >
            {pendingIntent === 'end-turn' ? 'Ending…' : 'End Turn'}
          </button>
        )}

        <span
          className={`${styles.dot} ${styles[connectionState]}`}
          role="status"
          aria-label={CONNECTION_LABEL[connectionState]}
          title={CONNECTION_LABEL[connectionState]}
        />
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      </div>

      {hostAway && (
        <p className={styles.notice} role="status">
          DM is away — changes will wait until they're back.
        </p>
      )}

      {hasCharacter && conditions.length > 0 && (
        <ul className={styles.conditions} aria-label="Conditions">
          {conditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      )}

      {hpOpen && hasCharacter && (
        <div
          className={styles.drawer}
          role="group"
          aria-label="Adjust hit points"
        >
          <div className={styles.quick}>
            {QUICK_DELTAS.map((delta) => (
              <button
                key={delta}
                type="button"
                className={delta < 0 ? styles.damage : styles.heal}
                disabled={hpBusy}
                onClick={() => void onAdjustHp(delta)}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
          <div className={styles.custom}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              aria-label="Amount"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
            <button
              type="button"
              className={styles.damage}
              disabled={hpBusy}
              onClick={() => applyCustom(-1)}
            >
              Damage
            </button>
            <button
              type="button"
              className={styles.heal}
              disabled={hpBusy}
              onClick={() => applyCustom(1)}
            >
              Heal
            </button>
          </div>
        </div>
      )}

      {orderOpen && isInCombat && (
        <ol
          className={styles.drawer}
          aria-label={`Round ${roundNumber ?? 1} turn order`}
        >
          {combatants.map((c) => (
            <li
              key={c.id}
              className={`${styles.combatant} ${c.isActive ? styles.active : ''} ${c.isMine ? styles.mine : ''}`}
              aria-current={c.isActive ? 'step' : undefined}
            >
              <span className={styles.init}>{c.initiative}</span>
              <span className={styles.combatantName}>{c.name}</span>
              {c.hpLabel && <span className={styles.badge}>{c.hpLabel}</span>}
            </li>
          ))}
        </ol>
      )}
    </header>
  );
};

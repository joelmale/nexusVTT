import React, { useState } from 'react';
import type { RollMode } from '@/components/DiceRoller/useDiceRoll';
import type { RevealedHandout } from '@/stores/handoutFeedStore';
import type { DiceRoll } from '@/types/game';
import { formatModifier } from '@/utils/characterRolls';
import {
  buildPoolExpression,
  DICE_SIDES,
  type DicePool,
  type DieSides,
} from './dicePool';
import styles from './SimpleDiceDrawer.module.css';

export interface SimpleDiceDrawerProps {
  /** Newest first, already filtered to rolls this player may see. */
  rolls: DiceRoll[];
  handouts: RevealedHandout[];
  onRoll: (expression: string, mode: RollMode, label?: string) => void;
  onOpenHandout: (id: string) => void;
}

const MIN_MODIFIER = -5;
const MAX_MODIFIER = 15;
const MAX_POOL_DICE = 20;
const HISTORY_LIMIT = 25;

type Pool = DicePool;

/** Quick dice pad, room roll history and revealed handouts. */
export const SimpleDiceDrawer: React.FC<SimpleDiceDrawerProps> = ({
  rolls,
  handouts,
  onRoll,
  onOpenHandout,
}) => {
  const [pool, setPool] = useState<Pool>({});
  const [modifier, setModifier] = useState(0);

  const expression = buildPoolExpression(pool, modifier);
  const totalDice = Object.values(pool).reduce((sum, n) => sum + (n ?? 0), 0);

  const addDie = (sides: DieSides) => {
    if (totalDice >= MAX_POOL_DICE) return;
    setPool({ ...pool, [sides]: (pool[sides] ?? 0) + 1 });
  };

  const rollNow = () => {
    if (!expression) return;
    onRoll(expression, 'none');
    setPool({});
    setModifier(0);
  };

  return (
    <section className={styles.drawer} aria-label="Dice and rolls">
      <div className={styles.pad} role="group" aria-label="Dice pad">
        {DICE_SIDES.map((sides) => (
          <button
            key={sides}
            type="button"
            className={styles.die}
            aria-label={`Add d${sides}`}
            onClick={() => addDie(sides)}
          >
            d{sides}
            {(pool[sides] ?? 0) > 0 && (
              <span className={styles.count}>×{pool[sides]}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.controls}>
        <div className={styles.stepper} role="group" aria-label="Modifier">
          <button
            type="button"
            aria-label="Decrease modifier"
            disabled={modifier <= MIN_MODIFIER}
            onClick={() => setModifier(modifier - 1)}
          >
            −
          </button>
          <output aria-label="Modifier value">
            {formatModifier(modifier)}
          </output>
          <button
            type="button"
            aria-label="Increase modifier"
            disabled={modifier >= MAX_MODIFIER}
            onClick={() => setModifier(modifier + 1)}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className={styles.clear}
          disabled={!expression && modifier === 0}
          onClick={() => {
            setPool({});
            setModifier(0);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className={styles.roll}
          disabled={!expression}
          onClick={rollNow}
        >
          {expression ? `Roll ${expression}` : 'Roll Now'}
        </button>
      </div>

      {handouts.length > 0 && (
        <div className={styles.section}>
          <h3>Handouts</h3>
          <ul className={styles.list}>
            {handouts.map((handout) => (
              <li key={handout.id}>
                {handout.url ? (
                  <button
                    type="button"
                    className={styles.handout}
                    onClick={() => onOpenHandout(handout.id)}
                  >
                    {handout.title}
                  </button>
                ) : (
                  <span className={styles.handout}>{handout.title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.section}>
        <h3>Recent rolls</h3>
        {rolls.length === 0 ? (
          <p className={styles.muted}>No rolls yet.</p>
        ) : (
          <ol className={styles.list} aria-label="Recent rolls">
            {rolls.slice(0, HISTORY_LIMIT).map((roll) => (
              <li
                key={roll.id}
                className={`${styles.rollItem} ${
                  roll.crit === 'success'
                    ? styles.crit
                    : roll.crit === 'failure'
                      ? styles.fumble
                      : ''
                }`}
              >
                <span className={styles.who}>{roll.userName}</span>
                <span className={styles.expr}>
                  {roll.expression} [{roll.results.join(', ')}]
                </span>
                <span className={styles.total}>{roll.total}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

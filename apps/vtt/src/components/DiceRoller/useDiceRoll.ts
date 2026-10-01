import { useTransition } from 'react';
import { useGameStore, useIsHost } from '@/stores/gameStore';
import { createDiceRoll } from '@/utils/dice';
import { webSocketService } from '@/services/websocket';

export type RollMode = 'none' | 'advantage' | 'disadvantage';

/**
 * The single roll pipeline for the Dice Roller panel.
 *
 * Online, the server generates the canonical result and broadcasts
 * `dice/roll-result` (which DiceBox3D animates from `gameStore.diceRolls`).
 * Offline there is no authority to answer, so the local roll is added to the
 * store directly. Either way a `dice-roll` chat message is sent.
 */
export const useDiceRoll = ({ isPrivate }: { isPrivate: boolean }) => {
  const isHost = useIsHost();
  const user = useGameStore((state) => state.user);
  const sendChatMessage = useGameStore((state) => state.sendChatMessage);
  const [, startRollTransition] = useTransition();

  /** Returns an error message, or null when the roll was dispatched. */
  const roll = (expression: string, mode: RollMode = 'none'): string | null => {
    const cleanExpr = expression.replace(/^\/r\s+/i, '').trim();
    if (!cleanExpr) {
      return 'Please provide a dice expression';
    }

    const result = createDiceRoll(
      cleanExpr,
      user.id || 'unknown',
      user.name || 'Player',
      {
        isPrivate: isHost && isPrivate,
        advantage: mode === 'advantage',
        disadvantage: mode === 'disadvantage',
      },
    );

    if (!result) {
      return `Invalid expression: ${cleanExpr}`;
    }

    const isOnline = webSocketService.isConnected();
    if (!isOnline) {
      // Offline mode has no authority to answer, so retain the local fallback.
      useGameStore.getState().addDiceRoll(result);
    }

    startRollTransition(() => {
      const breakdown = `[${result.results.join(', ')}]${
        result.modifier
          ? ` ${result.modifier > 0 ? '+' : ''}${result.modifier}`
          : ''
      } = ${result.total}`;

      const diceData = {
        expression: result.expression,
        results: result.results,
        total: result.total,
        breakdown,
        modifier: result.modifier,
        diceType:
          result.pools.length === 1 ? result.pools[0].sides : undefined,
        diceCount:
          result.pools.length === 1 ? result.pools[0].count : undefined,
        isCrit: result.crit === 'success',
        isCritFail: result.crit === 'failure',
        rollType: mode === 'none' ? ('normal' as const) : mode,
      };

      sendChatMessage(
        `rolled ${result.expression}`,
        'dice-roll',
        undefined,
        diceData,
      );

      // The server generates and broadcasts one canonical result to every
      // participant, including the requester. Sending the client-generated
      // result here would be both forgeable and invisible to DiceHandler.
      if (isOnline) {
        webSocketService.sendEvent({
          type: 'dice/roll-request',
          data: {
            expression: result.expression,
            isPrivate: isHost && isPrivate,
            advantage: mode === 'advantage',
            disadvantage: mode === 'disadvantage',
          },
        });
      }
    });

    return null;
  };

  return { roll };
};

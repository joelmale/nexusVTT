import type { TableRecord } from './types';

export interface TableAction {
  label: string;
  disabled: boolean;
  /** Tooltip explaining a disabled button. */
  hint?: string;
}

/**
 * The main button for a table, shared by TableCard and ContinueBand so the two
 * never disagree. DMs can always open their table; a player can only rejoin
 * while the DM has it open and a room code exists.
 */
export const getTableAction = (
  table: TableRecord,
  context: 'card' | 'band',
): TableAction => {
  if (table.role === 'dm') {
    return {
      label: context === 'band' ? 'Resume' : 'Open Table',
      disabled: false,
    };
  }
  if (table.status !== 'open' || !table.roomCode) {
    return {
      label: 'Waiting for the DM',
      disabled: true,
      hint: 'The DM has not opened this table yet.',
    };
  }
  return { label: 'Rejoin', disabled: false };
};

const plural = (n: number, unit: string): string =>
  `${n} ${unit}${n === 1 ? '' : 's'}`;

/** "4 NPCs · 2 encounters · Next: The Amber Temple"; empty parts are omitted. */
export const getPrepLine = (table: TableRecord): string => {
  const prep = table.prep;
  if (!prep) return '';
  const parts: string[] = [];
  if (prep.npcs > 0) parts.push(plural(prep.npcs, 'NPC'));
  if (prep.encounters > 0) parts.push(plural(prep.encounters, 'encounter'));
  if (prep.nextSession) parts.push(`Next: ${prep.nextSession}`);
  return parts.join(' · ');
};

import type { InitiativeEntry } from '@/types/initiative';

export interface SimpleCombatantView {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
  isMine: boolean;
  isActive: boolean;
  /** Only set for player characters; monsters never expose HP here. */
  hpLabel?: string;
}

export interface SimpleCombatView {
  isInCombat: boolean;
  round: number;
  combatants: SimpleCombatantView[];
  activeCombatantId?: string;
  activeLabel?: string;
  upNextLabel?: string;
  isMyTurn: boolean;
  myCombatantId?: string;
}

export interface BuildSimpleCombatViewInput {
  isActive: boolean;
  round: number;
  entries: InitiativeEntry[];
  activeEntryId: string | null;
  userId: string;
  /** characterId → owning player id */
  characterOwners: ReadonlyMap<string, string | undefined>;
  /** Token ids the DM has hidden from players. */
  hiddenTokenIds: ReadonlySet<string>;
}

export const HIDDEN_TURN_LABEL = 'Enemy activity…';

/**
 * Projects the synced initiative state into the player's turn-order view.
 * Combatants on hidden tokens are left out and an active hidden combatant is
 * shown as "Enemy activity…". This is presentation only: the full state still
 * reaches every client.
 */
export function buildSimpleCombatView({
  isActive,
  round,
  entries,
  activeEntryId,
  userId,
  characterOwners,
  hiddenTokenIds,
}: BuildSimpleCombatViewInput): SimpleCombatView {
  const isVisible = (entry: InitiativeEntry) =>
    !entry.tokenId || !hiddenTokenIds.has(entry.tokenId);
  const isMine = (entry: InitiativeEntry) =>
    entry.playerId === userId ||
    (entry.characterId !== undefined &&
      characterOwners.get(entry.characterId) === userId);

  const combatants: SimpleCombatantView[] = entries
    .filter(isVisible)
    .map((entry) => {
      const isPlayer = entry.type === 'player';
      return {
        id: entry.id,
        name: entry.name,
        initiative: entry.initiative,
        isPlayer,
        isMine: isMine(entry),
        isActive: entry.id === activeEntryId,
        ...(isPlayer ? { hpLabel: `${entry.currentHP}/${entry.maxHP}` } : {}),
      };
    });

  const myEntry = entries.find(isMine);
  if (!isActive) {
    return {
      isInCombat: false,
      round,
      combatants,
      isMyTurn: false,
      myCombatantId: myEntry?.id,
    };
  }

  const activeIndex = entries.findIndex((e) => e.id === activeEntryId);
  const activeEntry = activeIndex >= 0 ? entries[activeIndex] : undefined;

  let upNextLabel: string | undefined;
  if (activeIndex >= 0) {
    for (let step = 1; step < entries.length; step += 1) {
      const candidate = entries[(activeIndex + step) % entries.length];
      if (isVisible(candidate)) {
        upNextLabel = candidate.name;
        break;
      }
    }
  }

  return {
    isInCombat: true,
    round,
    combatants,
    activeCombatantId: activeEntry?.id,
    activeLabel: activeEntry
      ? isVisible(activeEntry)
        ? activeEntry.name
        : HIDDEN_TURN_LABEL
      : undefined,
    upNextLabel,
    isMyTurn: activeEntry !== undefined && isMine(activeEntry),
    myCombatantId: myEntry?.id,
  };
}

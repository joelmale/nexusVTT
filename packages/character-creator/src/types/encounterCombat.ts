export interface Condition {
  name: string;
  duration?: number;
  description: string;
  isCustom?: boolean;
}

export interface InitiativeEntry {
  id: string;
  name: string;
  type: 'monster' | 'player';
  initiative: number;
  instanceId?: string; // "A", "B", "C" for duplicates
  conditions: Condition[];
  currentHp: number;
  maxHp: number;
  isActive: boolean;
  notes?: string;
}

export interface PlayerEntry {
  characterId: string;
  name: string;
  initiative: number;
  ac: number;
  currentHp: number;
  maxHp: number;
  conditions: Condition[];
}

export interface CombatState {
  round: number;
  currentTurn: number;
  initiativeOrder: InitiativeEntry[];
  players: PlayerEntry[];
  savedAt?: number; // Timestamp for mid-session saves
}
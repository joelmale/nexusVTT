import type {
  DashboardRole,
  TableRosterEntry,
  TablePrepSummary,
  TableStatus,
} from '../../../shared/dashboard';

export type { DashboardRole, TableRosterEntry, TablePrepSummary, TableStatus };

/** One table (a campaign the user runs or has joined) as the cards render it. */
export interface TableRecord {
  id: string;
  name: string;
  /** Empty string when the campaign has no description. */
  subtitle: string;
  role: DashboardRole;
  dmName: string;
  roomCode: string | null;
  status: TableStatus;
  lastPlayedAt: string | null;
  roster: TableRosterEntry[];
  /** Player role: the hero this user last played here. */
  myCharacterId?: string;
  /** DM role only. */
  prep?: TablePrepSummary;
}

export interface LastTable {
  campaignId: string;
  role: DashboardRole;
}

export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CharacterRecord {
  id: string;
  name: string;
  level: number;
  /** Optional: absent when the stored character does not record it. */
  klass?: string;
  race?: string;
  hp?: { current: number; max: number };
  stats?: CharacterStats;
  /** Armor class, when the sheet records it. */
  ac?: number;
  /** Passive Perception, when the sheet records it. */
  passivePerception?: number;
  /** Campaign this hero most recently played in, if any. */
  boundCampaignId?: string | null;
  updatedAt: string; // ISO date string
}

export interface DiceRollResult {
  id: string;
  dieType: string; // e.g., 'd6', 'd20'
  rolls: number[];
  modifier: number;
  total: number;
  timestamp: string; // Time string
}

export interface LibraryDocument {
  id: string;
  name: string;
  size: string;
}

export interface ToolbarButton {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
  onClick?: () => void;
  hoverText?: string;
  trailing?: React.ReactNode;
}

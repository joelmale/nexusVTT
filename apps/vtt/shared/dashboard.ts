/**
 * @file shared/dashboard.ts
 * @description Wire types for `GET /api/dashboard`, shared by server and client.
 * The endpoint is read-only: it projects `campaigns`, `sessions`, `players`,
 * `characters` and campaign-prep object counts into one per-user summary.
 */

export type DashboardRole = 'dm' | 'player';

/** `open` = latest session active, `resting` = hibernating, `never` = no session. */
export type TableStatus = 'open' | 'resting' | 'never';

export interface TableRosterEntry {
  userName: string;
  characterName?: string;
  /** `players.isConnected`, only true while the table is open. */
  online: boolean;
}

export interface TablePrepSummary {
  npcs: number;
  encounters: number;
  /** Title of the most recently updated `session` prep object. */
  nextSession?: string;
}

export interface TableSummary {
  id: string;
  name: string;
  description: string | null;
  role: DashboardRole;
  dmName: string;
  /** `campaigns.lastRoomCode`. */
  roomCode: string | null;
  status: TableStatus;
  /** ISO timestamp of the newest `sessions.lastActivity`, or null. */
  lastPlayedAt: string | null;
  /** Players of the latest session (the DM is excluded). */
  roster: TableRosterEntry[];
  /** Player role only: the hero this user most recently played here. */
  myCharacterId?: string;
  /** DM role only. */
  prep?: TablePrepSummary;
}

export interface HeroSummary {
  id: string;
  name: string;
  /** Raw `characters.data`; the client derives race/class/level from it. */
  data: unknown;
  /** Campaign of the hero's most recent `players.characterId` binding. */
  boundCampaignId: string | null;
  updatedAt: string | null;
}

export interface DashboardLastTable {
  campaignId: string;
  role: DashboardRole;
}

export interface DashboardSummary {
  runs: TableSummary[];
  joined: TableSummary[];
  heroes: HeroSummary[];
  lastTable?: DashboardLastTable;
}

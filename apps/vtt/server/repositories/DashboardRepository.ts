import type { Pool } from 'pg';

import type {
  DashboardRole,
  DashboardSummary,
  HeroSummary,
  TableRosterEntry,
  TableStatus,
  TableSummary,
} from '../../shared/dashboard.js';
import { BaseRepository } from './base.js';
import type { CampaignPrepRepository } from './CampaignPrepRepository.js';

interface TableRow {
  id: string;
  name: string;
  description: string | null;
  dmName: string;
  dmId: string;
  roomCode: string | null;
  latestSessionId: string | null;
  latestStatus: string | null;
  lastPlayedAt: Date | null;
  myCharacterId: string | null;
}

interface RosterRow {
  sessionId: string;
  userId: string;
  userName: string;
  characterName: string | null;
  isConnected: boolean | null;
}

interface HeroRow {
  id: string;
  name: string;
  data: unknown;
  updatedAt: Date | null;
  boundCampaignId: string | null;
}

// The latest non-abandoned session decides status and roster; lastPlayedAt
// spans every session of the campaign.
const TABLE_COLUMNS = `
  c.id, c.name, c.description, c."dmId", c."lastRoomCode" AS "roomCode",
  COALESCE(dm."displayName", dm.name) AS "dmName",
  ls.id AS "latestSessionId", ls.status AS "latestStatus",
  (SELECT MAX(s."lastActivity") FROM sessions s WHERE s."campaignId" = c.id)
    AS "lastPlayedAt"`;

const LATEST_SESSION = `
  LEFT JOIN LATERAL (
    SELECT s.id, s.status
    FROM sessions s
    WHERE s."campaignId" = c.id AND s.status <> 'abandoned'
    ORDER BY s."lastActivity" DESC
    LIMIT 1
  ) ls ON TRUE`;

function toStatus(status: string | null): TableStatus {
  if (status === 'active') return 'open';
  if (status === 'hibernating') return 'resting';
  return 'never';
}

/**
 * Read-only projection backing `GET /api/dashboard`. It never writes and never
 * touches the game-state commit path.
 */
export class DashboardRepository extends BaseRepository {
  constructor(
    pool: Pool,
    private readonly campaignPrep: CampaignPrepRepository,
  ) {
    super(pool);
  }

  async getSummary(userId: string): Promise<DashboardSummary> {
    const [runRows, joinedRows, heroRows] = await Promise.all([
      this.pool.query<TableRow>(
        `SELECT ${TABLE_COLUMNS}, NULL::uuid AS "myCharacterId"
         FROM campaigns c
         JOIN users dm ON dm.id = c."dmId"
         ${LATEST_SESSION}
         WHERE c."dmId" = $1`,
        [userId],
      ),
      this.pool.query<TableRow>(
        `SELECT ${TABLE_COLUMNS}, mine."characterId" AS "myCharacterId"
         FROM campaigns c
         JOIN users dm ON dm.id = c."dmId"
         ${LATEST_SESSION}
         JOIN LATERAL (
           SELECT p."characterId"
           FROM players p
           JOIN sessions s ON s.id = p."sessionId"
           WHERE p."userId" = $1 AND s."campaignId" = c.id
           ORDER BY s."lastActivity" DESC
           LIMIT 1
         ) mine ON TRUE
         WHERE c."dmId" <> $1`,
        [userId],
      ),
      this.pool.query<HeroRow>(
        `SELECT ch.id, ch.name, ch.data, ch."updatedAt",
                bound."campaignId" AS "boundCampaignId"
         FROM characters ch
         LEFT JOIN LATERAL (
           SELECT s."campaignId"
           FROM players p
           JOIN sessions s ON s.id = p."sessionId"
           WHERE p."characterId" = ch.id
           ORDER BY s."lastActivity" DESC
           LIMIT 1
         ) bound ON TRUE
         WHERE ch."ownerId" = $1
         ORDER BY ch."createdAt" DESC`,
        [userId],
      ),
    ]);

    const allRows = [...runRows.rows, ...joinedRows.rows];
    const rosters = await this.loadRosters(
      allRows
        .map((row) => row.latestSessionId)
        .filter((id): id is string => id !== null),
    );
    const prep = await this.campaignPrep.getPrepSummaries(
      runRows.rows.map((row) => row.id),
    );

    const runs = runRows.rows.map((row) =>
      this.toTable(row, 'dm', rosters, prep.get(row.id)),
    );
    const joined = joinedRows.rows.map((row) =>
      this.toTable(row, 'player', rosters),
    );

    // Most recent activity wins; ties keep DM tables first.
    let lastTable: DashboardSummary['lastTable'];
    let newest = 0;
    for (const table of [...runs, ...joined]) {
      const at = table.lastPlayedAt ? Date.parse(table.lastPlayedAt) : 0;
      if (at > newest) {
        newest = at;
        lastTable = { campaignId: table.id, role: table.role };
      }
    }

    const sortByRecent = (a: TableSummary, b: TableSummary) =>
      (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? '') ||
      a.name.localeCompare(b.name);

    return {
      runs: runs.sort(sortByRecent),
      joined: joined.sort(sortByRecent),
      heroes: heroRows.rows.map(
        (row): HeroSummary => ({
          id: row.id,
          name: row.name,
          data: row.data,
          boundCampaignId: row.boundCampaignId,
          updatedAt: row.updatedAt?.toISOString() ?? null,
        }),
      ),
      ...(lastTable ? { lastTable } : {}),
    };
  }

  private async loadRosters(
    sessionIds: string[],
  ): Promise<Map<string, RosterRow[]>> {
    const bySession = new Map<string, RosterRow[]>();
    if (sessionIds.length === 0) return bySession;

    const result = await this.pool.query<RosterRow>(
      `SELECT p."sessionId", p."userId",
              COALESCE(u."displayName", u.name) AS "userName",
              ch.name AS "characterName", p."isConnected"
       FROM players p
       JOIN users u ON u.id = p."userId"
       LEFT JOIN characters ch ON ch.id = p."characterId"
       WHERE p."sessionId" = ANY($1::uuid[])
       ORDER BY p."lastSeen" DESC, u.name`,
      [sessionIds],
    );
    for (const row of result.rows) {
      const list = bySession.get(row.sessionId) ?? [];
      list.push(row);
      bySession.set(row.sessionId, list);
    }
    return bySession;
  }

  private toTable(
    row: TableRow,
    role: DashboardRole,
    rosters: Map<string, RosterRow[]>,
    prep?: TableSummary['prep'],
  ): TableSummary {
    const status = toStatus(row.latestStatus);
    const roster: TableRosterEntry[] = (
      row.latestSessionId ? (rosters.get(row.latestSessionId) ?? []) : []
    )
      .filter((entry) => entry.userId !== row.dmId)
      .map((entry) => ({
        userName: entry.userName,
        ...(entry.characterName ? { characterName: entry.characterName } : {}),
        // A resting table has nobody present, whatever isConnected last said.
        online: status === 'open' && entry.isConnected === true,
      }));

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      role,
      dmName: row.dmName,
      roomCode: row.roomCode,
      status,
      lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
      roster,
      ...(role === 'player' && row.myCharacterId
        ? { myCharacterId: row.myCharacterId }
        : {}),
      ...(role === 'dm' ? { prep: prep ?? { npcs: 0, encounters: 0 } } : {}),
    };
  }
}

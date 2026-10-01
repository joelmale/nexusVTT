import crypto from 'crypto';

import type { LibraryObjectRepository } from '../repositories/LibraryObjectRepository.js';
import type { CampaignPrepRepository } from '../repositories/CampaignPrepRepository.js';

/**
 * Turns an authored prep `encounter` into the library definitions the
 * DeployEncounter command reads: one library `encounter` (same id as the prep
 * object) whose groups point at library `monster` stat blocks. Idempotent: a
 * revision is only added when the generated definition changed.
 *
 * Every monster row in the encounter must be linked to a monsterKey and carry
 * complete stats from the client. SRD canonical monsters and homebrew monsters
 * both arrive from the client so deployed encounters always match what the DM
 * saw when publishing.
 */

export type EncounterMaterializationErrorCode =
  | 'not-found'
  | 'not-an-encounter'
  | 'invalid-payload'
  | 'forbidden';

export class EncounterMaterializationError extends Error {
  constructor(
    public readonly code: EncounterMaterializationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EncounterMaterializationError';
  }
}

export interface MonsterStatInput {
  key: string;
  name: string;
  cr: string;
  ac: number;
  hp: number;
  speed: number;
  /** STR, DEX, CON, INT, WIS, CHA. */
  abilities: number[];
}

export interface MaterializeEncounterRequest {
  campaignId: string;
  objectId: string;
  principalId: string;
  monsters: unknown;
}

export interface MaterializedEncounter {
  encounterRef: { kind: 'encounter'; id: string; revision: number };
  monsterCount: number;
  created: boolean;
}

type Repositories = {
  campaignPrep: Pick<CampaignPrepRepository, 'getObject' | 'getRevision'>;
  libraryObjects: Pick<
    LibraryObjectRepository,
    'getObjectById' | 'getRevision' | 'createObject' | 'addRevision'
  >;
};

const MAX_MONSTERS = 100;
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : undefined;
}

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

export function parseMonsterStats(input: unknown): MonsterStatInput[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > MAX_MONSTERS) {
    throw new EncounterMaterializationError(
      'invalid-payload',
      `monsters must be an array of at most ${MAX_MONSTERS} stat blocks`,
    );
  }
  return input.map((raw, index) => {
    const bad = (field: string) =>
      new EncounterMaterializationError(
        'invalid-payload',
        `monsters[${index}].${field} is invalid`,
      );
    if (!isRecord(raw)) throw bad('value');
    const key = typeof raw.key === 'string' ? raw.key.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!key || key.length > 128) throw bad('key');
    if (!name || name.length > 255) throw bad('name');
    const cr = typeof raw.cr === 'string' ? raw.cr.trim() : '';
    if (!/^(\d{1,2}|\d\/\d)$/.test(cr)) throw bad('cr');
    const ac = finite(raw.ac, 0, 40);
    const hp = finite(raw.hp, 1, 100000);
    const speed = finite(raw.speed, 0, 1000);
    if (ac === undefined) throw bad('ac');
    if (hp === undefined) throw bad('hp');
    if (speed === undefined) throw bad('speed');
    const scores = Array.isArray(raw.abilities) ? raw.abilities : [];
    const abilities = ABILITY_KEYS.map((_, at) => finite(scores[at], 1, 30));
    if (abilities.some((score) => score === undefined)) throw bad('abilities');
    return { key, name, cr, ac, hp, speed, abilities: abilities as number[] };
  });
}

/** Stable UUID derived from a seed, so re-materializing reuses objects. */
function stableUuid(seed: string): string {
  const bytes = crypto.createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface CompositionRow {
  name: string;
  count: number;
  monsterKey?: string;
  cr?: string;
}

function readComposition(data: unknown): CompositionRow[] {
  if (!isRecord(data) || !isRecord(data.content)) return [];
  const value = data.content.value;
  if (!isRecord(value) || !isRecord(value.nexusStudio)) return [];
  const fields = value.nexusStudio.fields;
  if (!isRecord(fields) || !Array.isArray(fields.composition)) return [];
  return fields.composition.filter(isRecord).flatMap((row) => {
    const count = finite(row.count, 1, 1000);
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    // Hazards and lair actions are not creatures and are never spawned.
    if (!count || !name || row.nonCreature === true) return [];
    return [
      {
        name,
        count: Math.floor(count),
        ...(typeof row.monsterKey === 'string'
          ? { monsterKey: row.monsterKey }
          : {}),
        ...(typeof row.cr === 'string' ? { cr: row.cr } : {}),
      },
    ];
  });
}

function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function statBlock(stats: MonsterStatInput, row: CompositionRow) {
  const scores = stats.abilities;
  return {
    name: stats.name,
    challengeRating: stats.cr,
    hitPoints: { average: stats.hp },
    armorClass: [{ value: stats.ac }],
    speed: { walk: stats.speed },
    abilities: Object.fromEntries(
      ABILITY_KEYS.map((key, at) => [
        key,
        { score: scores[at], modifier: modifier(scores[at]) },
      ]),
    ),
    source: row.monsterKey?.startsWith('homebrew:') ? 'homebrew' : 'srd',
  };
}

const RULESET = {
  system: 'dnd5e',
  edition: '2014',
  contentPackId: 'campaign-studio',
  contentRevision: '1',
  rulesRevision: '1',
};

/** Key-order independent, because JSONB does not preserve key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sameJson(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

export class EncounterMaterializer {
  constructor(private readonly db: Repositories) {}

  async materialize(
    request: MaterializeEncounterRequest,
  ): Promise<MaterializedEncounter> {
    const monsters = parseMonsterStats(request.monsters);
    const object = await this.db.campaignPrep.getObject(
      request.campaignId,
      request.objectId,
    );
    if (!object) {
      throw new EncounterMaterializationError('not-found', 'Encounter not found');
    }
    if (object.kind !== 'encounter') {
      throw new EncounterMaterializationError(
        'not-an-encounter',
        'Only encounter objects can be materialized',
      );
    }
    const revision = await this.db.campaignPrep.getRevision(
      object.id,
      object.currentRevision,
    );
    const rows = readComposition(revision?.data);
    if (rows.length === 0) {
      throw new EncounterMaterializationError(
        'invalid-payload',
        'The encounter has no monsters to deploy',
      );
    }

    const byKey = new Map(monsters.map((monster) => [monster.key, monster]));

    const unlinked: string[] = [];
    const missingStats: string[] = [];
    for (const row of rows) {
      if (!row.monsterKey) {
        unlinked.push(row.name);
      } else if (!byKey.has(row.monsterKey)) {
        missingStats.push(row.name);
      }
    }
    if (unlinked.length > 0 || missingStats.length > 0) {
      const messages: string[] = [];
      if (unlinked.length > 0) {
        messages.push(
          `Link these monsters to the catalog or a homebrew monster before publishing: ${unlinked.join(', ')}`,
        );
      }
      if (missingStats.length > 0) {
        messages.push(`Stat blocks missing for: ${missingStats.join(', ')}`);
      }
      throw new EncounterMaterializationError(
        'invalid-payload',
        messages.join('; '),
      );
    }

    const groups: {
      id: string;
      monsterRef: { kind: 'monster'; id: string; revision: number };
      count: number;
      faction: 'hostile';
      customName?: string;
    }[] = [];

    for (const [index, row] of rows.entries()) {
      const stats = byKey.get(row.monsterKey!)!;
      const monsterId = stableUuid(
        `monster:${request.campaignId}:${row.monsterKey}`,
      );
      const data = statBlock(stats, row);
      const {
        object: monsterObj,
        revision: initialMonsterRev,
        created: monsterCreated,
      } = await this.createOrLoad(monsterId, () =>
        this.db.libraryObjects.createObject(
          {
            ownerId: request.principalId,
            campaignId: request.campaignId,
            kind: 'monster',
            name: data.name,
            tags: [data.source],
          },
          { ruleset: RULESET, data },
          monsterId,
        ),
      );

      let monsterRevision = initialMonsterRev;
      if (!monsterCreated) {
        this.assertOwned(monsterObj, request);
        const current = await this.db.libraryObjects.getRevision(
          monsterObj.id,
          monsterRevision,
        );
        if (!current || !sameJson(current.data, data)) {
          monsterRevision = (
            await this.db.libraryObjects.addRevision(
              monsterObj.id,
              RULESET,
              data,
            )
          ).revision;
        }
      }
      groups.push({
        id: stableUuid(`group:${request.objectId}:${index}`),
        monsterRef: { kind: 'monster', id: monsterId, revision: monsterRevision },
        count: row.count,
        faction: 'hostile',
      });
    }

    const encounterData = { name: object.title, ruleset: RULESET, groups };
    const {
      object: encounterObj,
      revision: initialEncounterRev,
      created: encounterCreated,
    } = await this.createOrLoad(object.id, () =>
      this.db.libraryObjects.createObject(
        {
          ownerId: request.principalId,
          campaignId: request.campaignId,
          kind: 'encounter',
          name: object.title,
        },
        { ruleset: RULESET, data: encounterData },
        object.id,
      ),
    );

    let encounterRevision = initialEncounterRev;
    if (!encounterCreated) {
      this.assertOwned(encounterObj, request);
      const current = await this.db.libraryObjects.getRevision(
        encounterObj.id,
        encounterRevision,
      );
      if (!current || !sameJson(current.data, encounterData)) {
        encounterRevision = (
          await this.db.libraryObjects.addRevision(
            encounterObj.id,
            RULESET,
            encounterData,
          )
        ).revision;
      }
    }
    return {
      encounterRef: {
        kind: 'encounter',
        id: object.id,
        revision: encounterRevision,
      },
      monsterCount: groups.length,
      created: encounterCreated,
    };
  }

  private async createOrLoad<
    T extends NonNullable<
      Awaited<ReturnType<Repositories['libraryObjects']['getObjectById']>>
    >,
  >(
    id: string,
    create: () => Promise<{ object: T; revision: { revision: number } }>,
  ): Promise<{ object: T; revision: number; created: boolean }> {
    const existing = await this.db.libraryObjects.getObjectById(id);
    if (existing) {
      return {
        object: existing as T,
        revision: (existing as { currentRevision?: number }).currentRevision ?? 1,
        created: false,
      };
    }
    try {
      const created = await create();
      return {
        object: created.object as T,
        revision: created.revision.revision,
        created: true,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const loaded = await this.db.libraryObjects.getObjectById(id);
        if (loaded) {
          return {
            object: loaded as T,
            revision: (loaded as { currentRevision?: number }).currentRevision ?? 1,
            created: false,
          };
        }
      }
      throw error;
    }
  }

  private assertOwned(
    existing: { ownerId: string; campaignId: string | null; isArchived?: boolean },
    request: MaterializeEncounterRequest,
  ): void {
    if (
      existing.campaignId !== request.campaignId ||
      existing.ownerId !== request.principalId
    ) {
      throw new EncounterMaterializationError(
        'forbidden',
        'A library object with this id belongs to another campaign',
      );
    }
  }
}

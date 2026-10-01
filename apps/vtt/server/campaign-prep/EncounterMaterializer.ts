import crypto from 'crypto';

import type { LibraryObjectRepository } from '../repositories/LibraryObjectRepository.js';
import type { CampaignPrepRepository } from '../repositories/CampaignPrepRepository.js';

/**
 * Turns an authored prep `encounter` into the library definitions the
 * DeployEncounter command reads: one library `encounter` (same id as the prep
 * object) whose groups point at library `monster` stat blocks. Idempotent: a
 * revision is only added when the generated definition changed.
 *
 * Stat blocks arrive from the client because canonical SRD monsters are not
 * stored on the server; homebrew monsters travel the same way so a deployed
 * encounter always matches what the DM saw when they published.
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

function statBlock(stats: MonsterStatInput | undefined, row: CompositionRow) {
  const scores = stats?.abilities ?? [10, 10, 10, 10, 10, 10];
  return {
    name: stats?.name ?? row.name,
    challengeRating: stats?.cr ?? row.cr ?? '0',
    hitPoints: { average: stats?.hp ?? 10 },
    armorClass: [{ value: stats?.ac ?? 10 }],
    speed: { walk: stats?.speed ?? 30 },
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
    const groups: {
      id: string;
      monsterRef: { kind: 'monster'; id: string; revision: number };
      count: number;
      faction: 'hostile';
      customName?: string;
    }[] = [];

    for (const [index, row] of rows.entries()) {
      const stats = row.monsterKey ? byKey.get(row.monsterKey) : undefined;
      const monsterId = stableUuid(
        `monster:${request.campaignId}:${row.monsterKey ?? `name:${row.name.toLowerCase()}`}`,
      );
      const data = statBlock(stats, row);
      const existing = await this.db.libraryObjects.getObjectById(monsterId);
      let monsterRevision: number;
      if (!existing) {
        const created = await this.db.libraryObjects.createObject(
          {
            ownerId: request.principalId,
            campaignId: request.campaignId,
            kind: 'monster',
            name: data.name,
            tags: [data.source],
          },
          { ruleset: RULESET, data },
          monsterId,
        );
        monsterRevision = created.revision.revision;
      } else {
        this.assertOwned(existing, request);
        const current = await this.db.libraryObjects.getRevision(
          existing.id,
          existing.currentRevision,
        );
        monsterRevision = existing.currentRevision;
        if (!current || !sameJson(current.data, data)) {
          monsterRevision = (
            await this.db.libraryObjects.addRevision(
              existing.id,
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
    const existingEncounter = await this.db.libraryObjects.getObjectById(
      object.id,
    );
    if (!existingEncounter) {
      const created = await this.db.libraryObjects.createObject(
        {
          ownerId: request.principalId,
          campaignId: request.campaignId,
          kind: 'encounter',
          name: object.title,
        },
        { ruleset: RULESET, data: encounterData },
        object.id,
      );
      return {
        encounterRef: {
          kind: 'encounter',
          id: object.id,
          revision: created.revision.revision,
        },
        monsterCount: groups.length,
        created: true,
      };
    }
    this.assertOwned(existingEncounter, request);
    const current = await this.db.libraryObjects.getRevision(
      existingEncounter.id,
      existingEncounter.currentRevision,
    );
    let encounterRevision = existingEncounter.currentRevision;
    if (!current || !sameJson(current.data, encounterData)) {
      encounterRevision = (
        await this.db.libraryObjects.addRevision(
          existingEncounter.id,
          RULESET,
          encounterData,
        )
      ).revision;
    }
    return {
      encounterRef: {
        kind: 'encounter',
        id: object.id,
        revision: encounterRevision,
      },
      monsterCount: groups.length,
      created: false,
    };
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

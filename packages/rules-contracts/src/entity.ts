import { z } from 'zod';
import {
  RULES_SCHEMA_VERSION,
  RulesEntityTypeSchema,
  RulesetSchema,
  SlugSchema,
  SourceLicenseSchema,
  type RulesEntityType,
  type Ruleset,
} from './common';
import { ItemSchema, type Item } from './item';
import { MonsterSchema, type Monster } from './monster';
import { SpellSchema, type Spell } from './spell';

export interface RulesEntityDataMap {
  spell: Spell;
  item: Item;
  monster: Monster;
}

export type RulesEntityData = RulesEntityDataMap[RulesEntityType];

export const RULES_DATA_SCHEMAS = {
  spell: SpellSchema,
  item: ItemSchema,
  monster: MonsterSchema,
} as const;

/** Schema versions this package can validate, per entity type. */
export const SUPPORTED_SCHEMA_VERSIONS: Readonly<Record<RulesEntityType, readonly number[]>> = {
  spell: [RULES_SCHEMA_VERSION],
  item: [RULES_SCHEMA_VERSION],
  monster: [RULES_SCHEMA_VERSION],
};

export interface RulesValidationIssue {
  /** JSON path within the revision data (or envelope field). */
  path: Array<string | number>;
  code: string;
  message: string;
}

export type RulesDataParseResult<T extends RulesEntityType> =
  | { success: true; data: RulesEntityDataMap[T] }
  | { success: false; issues: RulesValidationIssue[] };

/**
 * Validate `data` against the contract for `entityType` and require that its
 * embedded ruleset matches the entity's ruleset. The returned data is the
 * normalized form (defaults applied) that consumers receive.
 */
export function parseRulesEntityData<T extends RulesEntityType>(
  entityType: T,
  ruleset: Ruleset,
  data: unknown,
): RulesDataParseResult<T> {
  const schema = RULES_DATA_SCHEMAS[entityType] as unknown as z.ZodType<
    RulesEntityDataMap[T],
    z.ZodTypeDef,
    unknown
  >;
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    };
  }
  if (result.data.ruleset !== ruleset) {
    return {
      success: false,
      issues: [
        {
          path: ['ruleset'],
          code: 'ruleset_mismatch',
          message: `data targets ruleset ${result.data.ruleset} but the entity is ${ruleset}`,
        },
      ],
    };
  }
  return { success: true, data: result.data };
}

/**
 * Envelope for one entity revision as it is submitted to, and stored by, the
 * Codex rules registry.
 */
export const RulesEntityRevisionEnvelopeSchema = z
  .object({
    entityType: RulesEntityTypeSchema,
    slug: SlugSchema,
    ruleset: RulesetSchema,
    schemaVersion: z.number().int().positive().default(RULES_SCHEMA_VERSION),
    data: z.unknown(),
    sourceDocumentId: z.string().trim().min(1).optional(),
    sourceLicense: SourceLicenseSchema,
  })
  .strict()
  .superRefine((envelope, ctx) => {
    if (!SUPPORTED_SCHEMA_VERSIONS[envelope.entityType].includes(envelope.schemaVersion)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schemaVersion'],
        message: `unsupported ${envelope.entityType} schema version ${envelope.schemaVersion}`,
      });
      return;
    }
    const parsed = parseRulesEntityData(envelope.entityType, envelope.ruleset, envelope.data);
    if (!parsed.success) {
      for (const issue of parsed.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['data', ...issue.path],
          message: issue.message,
        });
      }
    }
  });
export type RulesEntityRevisionEnvelope = z.infer<typeof RulesEntityRevisionEnvelopeSchema>;

export interface RulesEntityReference {
  entityType: RulesEntityType;
  slug: string;
  /** JSON path of the referencing field inside the revision data. */
  path: Array<string | number>;
}

/** Cross-entity references that must resolve within the same ruleset. */
export function collectRulesReferences(
  entityType: RulesEntityType,
  data: RulesEntityData,
): RulesEntityReference[] {
  const references: RulesEntityReference[] = [];
  if (entityType === 'monster') {
    const monster = data as Monster;
    monster.spellcasting?.forEach((block, blockIndex) => {
      block.spells.forEach((spell, spellIndex) => {
        references.push({
          entityType: 'spell',
          slug: spell.ref,
          path: ['spellcasting', blockIndex, 'spells', spellIndex, 'ref'],
        });
      });
    });
    if (monster.ruleset === '2024') {
      monster.gear?.forEach((slug, index) => {
        references.push({ entityType: 'item', slug, path: ['gear', index] });
      });
    }
  } else if (entityType === 'item') {
    const item = data as Item;
    item.spells?.forEach((spell, index) => {
      references.push({ entityType: 'spell', slug: spell.ref, path: ['spells', index, 'ref'] });
    });
  }
  return references;
}

const ORDINALS = ['cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

function formatCr(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}

/** One-line human summary used by previews and catalog listings. */
export function summarizeRulesEntity(entityType: RulesEntityType, data: RulesEntityData): string {
  switch (entityType) {
    case 'spell': {
      const spell = data as Spell;
      const school = spell.school[0].toUpperCase() + spell.school.slice(1);
      const head = spell.level === 0 ? `${school} cantrip` : `${ORDINALS[spell.level]}-level ${spell.school}`;
      return [head, spell.ritual ? 'ritual' : null, spell.concentration ? 'concentration' : null]
        .filter(Boolean)
        .join(', ');
    }
    case 'item': {
      const item = data as Item;
      const category = item.category.replace(/_/g, ' ');
      const rarity = item.rarity === 'mundane' ? '' : `, ${item.rarity.replace(/_/g, ' ')}`;
      const attunement = item.attunement.required
        ? ` (requires attunement${item.attunement.requirement ? ` ${item.attunement.requirement}` : ''})`
        : '';
      return `${category[0].toUpperCase()}${category.slice(1)}${rarity}${attunement}`;
    }
    case 'monster': {
      const monster = data as Monster;
      const size = monster.size[0].toUpperCase() + monster.size.slice(1);
      const type = monster.swarmOf
        ? `swarm of ${monster.swarmOf} ${monster.type}s`
        : monster.type + (monster.subtype ? ` (${monster.subtype})` : '');
      return `${size} ${type}, ${monster.alignment}; CR ${formatCr(monster.challengeRating)} (${monster.xp} XP)`;
    }
  }
}

/**
 * A published entity as the VTT/Forge catalog adapters consume it. The Codex
 * preview endpoint returns exactly this shape for unpublished revisions too.
 */
export interface CatalogEntity<T extends RulesEntityType = RulesEntityType> {
  id: string;
  entityType: T;
  ruleset: Ruleset;
  slug: string;
  schemaVersion: number;
  revisionId: string;
  revisionNumber: number;
  /** Catalog version at which this revision was published (null in previews). */
  catalogVersion: number | null;
  publishedAt: string | null;
  sourceLicense: string;
  sourceDocumentId: string | null;
  summary: string;
  data: RulesEntityDataMap[T];
}

export interface CatalogEntityMeta {
  id: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
  schemaVersion: number;
  revisionId: string;
  revisionNumber: number;
  catalogVersion: number | null;
  publishedAt: string | null;
  sourceLicense: string;
  sourceDocumentId: string | null;
}

/**
 * Normalize stored revision data into a catalog entity. Throws when the data
 * no longer satisfies the contract, which callers must treat as corruption.
 */
export function toCatalogEntity(meta: CatalogEntityMeta, data: unknown): CatalogEntity {
  const parsed = parseRulesEntityData(meta.entityType, meta.ruleset, data);
  if (!parsed.success) {
    const first = parsed.issues[0];
    throw new Error(
      `${meta.entityType} ${meta.ruleset}/${meta.slug} revision ${meta.revisionNumber} is invalid: ` +
        `${first?.path.join('.') ?? ''} ${first?.message ?? ''}`.trim(),
    );
  }
  return {
    ...meta,
    summary: summarizeRulesEntity(meta.entityType, parsed.data),
    data: parsed.data,
  };
}

/** Catalog tombstone for an entity archived since the requested version. */
export interface CatalogRemovedEntity {
  id: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
  catalogVersion: number;
}

export interface CatalogManifest {
  catalogVersion: number;
  publishedAt: string | null;
  etag: string;
  counts: Record<Ruleset, Record<RulesEntityType, number>>;
}

/**
 * A published revision the server could not normalize against the current
 * contract (e.g. after an incompatible contract change without a data
 * migration). Adapters keep their cached or bundled copy for these.
 */
export interface CatalogSkippedEntity {
  id: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
  revisionId: string;
  reason: string;
}

export interface CatalogEntitiesResponse {
  catalogVersion: number;
  since: number;
  entities: CatalogEntity[];
  removed: CatalogRemovedEntity[];
  skipped: CatalogSkippedEntity[];
}

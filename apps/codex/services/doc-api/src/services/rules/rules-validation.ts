import type { Prisma, PrismaClient, RulesEntityType as DbEntityType } from '@prisma/client';
import {
  SUPPORTED_SCHEMA_VERSIONS,
  collectRulesReferences,
  parseRulesEntityData,
  type RulesEntityType,
  type RulesValidationIssue,
  type Ruleset,
} from '@nexus/rules-contracts';

type Db = PrismaClient | Prisma.TransactionClient;

export interface RulesValidationTarget {
  id: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
}

/**
 * Full publication check for one revision's data:
 *  1. the schema version is supported;
 *  2. the data satisfies the shared contract, including its ruleset;
 *  3. every cross-reference resolves to a published, non-archived entity of
 *     the same ruleset (a reference that only exists in the other ruleset is
 *     reported as a ruleset incompatibility);
 *  4. no other live entity of the same type and ruleset publishes the same
 *     name (slug uniqueness itself is a database constraint).
 */
export async function validateRulesRevision(
  db: Db,
  target: RulesValidationTarget,
  schemaVersion: number,
  data: unknown,
): Promise<RulesValidationIssue[]> {
  if (!SUPPORTED_SCHEMA_VERSIONS[target.entityType].includes(schemaVersion)) {
    return [
      {
        path: ['schemaVersion'],
        code: 'unsupported_schema_version',
        message: `${target.entityType} schema version ${schemaVersion} is not supported`,
      },
    ];
  }

  const parsed = parseRulesEntityData(target.entityType, target.ruleset, data);
  if (!parsed.success) return parsed.issues;

  const issues: RulesValidationIssue[] = [];
  const references = collectRulesReferences(target.entityType, parsed.data);

  const byType = new Map<RulesEntityType, Set<string>>();
  for (const reference of references) {
    const slugs = byType.get(reference.entityType) ?? new Set<string>();
    slugs.add(reference.slug);
    byType.set(reference.entityType, slugs);
  }

  const resolved = new Map<string, Set<Ruleset>>();
  for (const [entityType, slugs] of byType) {
    const rows = await db.rulesEntity.findMany({
      where: {
        entityType: entityType as DbEntityType,
        slug: { in: [...slugs] },
        archivedAt: null,
        currentPublishedRevisionId: { not: null },
      },
      select: { slug: true, ruleset: true },
    });
    for (const row of rows) {
      const key = `${entityType}:${row.slug}`;
      const rulesets = resolved.get(key) ?? new Set<Ruleset>();
      rulesets.add(row.ruleset as Ruleset);
      resolved.set(key, rulesets);
    }
  }

  for (const reference of references) {
    const rulesets = resolved.get(`${reference.entityType}:${reference.slug}`);
    if (rulesets?.has(target.ruleset)) continue;
    const elsewhere = rulesets ? [...rulesets] : [];
    issues.push({
      path: reference.path,
      code: elsewhere.length > 0 ? 'ruleset_incompatible_reference' : 'unresolved_reference',
      message:
        elsewhere.length > 0
          ? `${reference.entityType} "${reference.slug}" is only published for ruleset ${elsewhere.join(', ')}`
          : `${reference.entityType} "${reference.slug}" is not published in ruleset ${target.ruleset}`,
    });
  }

  const duplicates = await db.$queryRaw<Array<{ slug: string }>>`
    SELECT e."slug"
    FROM "rules_entities" e
    JOIN "rules_entity_revisions" r ON r."id" = e."currentPublishedRevisionId"
    WHERE e."entityType"::text = ${target.entityType}
      AND e."ruleset" = ${target.ruleset}
      AND e."id" <> ${target.id}
      AND e."archivedAt" IS NULL
      AND lower(r."data"->>'name') = lower(${parsed.data.name})
    LIMIT 5
  `;
  for (const duplicate of duplicates) {
    issues.push({
      path: ['name'],
      code: 'duplicate_name',
      message: `"${parsed.data.name}" is already published as ${target.entityType} "${duplicate.slug}" in ruleset ${target.ruleset}`,
    });
  }

  return issues;
}

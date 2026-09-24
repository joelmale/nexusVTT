import type {
  PrismaClient,
  Prisma,
  RulesEntityRevision,
  RulesEntityType as DbEntityType,
} from '@prisma/client';
import {
  RulesEntityTypeSchema,
  RulesetSchema,
  toCatalogEntity,
  type CatalogEntity,
  type CatalogEntitiesResponse,
  type CatalogManifest,
  type RulesEntityType,
  type Ruleset,
} from '@nexus/rules-contracts';

export interface CatalogEntitiesInput {
  type?: RulesEntityType;
  ruleset?: Ruleset;
  since: number;
}

export function manifestEtag(catalogVersion: number): string {
  return `W/"rules-catalog-${catalogVersion}"`;
}

export function entitiesEtag(catalogVersion: number, input: CatalogEntitiesInput): string {
  return `W/"rules-catalog-${catalogVersion}-${input.type ?? 'all'}-${input.ruleset ?? 'all'}-${input.since}"`;
}

async function latestCatalogVersion(tx: Prisma.TransactionClient) {
  return tx.rulesCatalogVersion.findFirst({ orderBy: { version: 'desc' } });
}

/**
 * Read-only view of published rules content. Consumers poll the manifest and
 * fetch deltas with `since=<catalogVersion>`. Each read runs in one
 * REPEATABLE READ transaction so the version and the rows always agree.
 */
export class RulesCatalogService {
  constructor(private readonly prisma: PrismaClient) {}

  async manifest(): Promise<CatalogManifest> {
    return this.prisma.$transaction(
      async (tx) => {
        const latest = await latestCatalogVersion(tx);
        const groups = await tx.rulesEntity.groupBy({
          by: ['ruleset', 'entityType'],
          where: { archivedAt: null, currentPublishedRevisionId: { not: null } },
          _count: { _all: true },
        });
        const counts = Object.fromEntries(
          RulesetSchema.options.map((ruleset) => [
            ruleset,
            Object.fromEntries(RulesEntityTypeSchema.options.map((type) => [type, 0])),
          ]),
        ) as CatalogManifest['counts'];
        for (const group of groups) {
          const ruleset = group.ruleset as Ruleset;
          if (counts[ruleset]) counts[ruleset][group.entityType as RulesEntityType] = group._count._all;
        }
        const catalogVersion = latest?.version ?? 0;
        return {
          catalogVersion,
          publishedAt: latest ? latest.publishedAt.toISOString() : null,
          etag: manifestEtag(catalogVersion),
          counts,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async entities(input: CatalogEntitiesInput): Promise<CatalogEntitiesResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        const latest = await latestCatalogVersion(tx);
        const rows = await tx.rulesEntity.findMany({
          where: {
            currentPublishedRevisionId: { not: null },
            ...(input.type && { entityType: input.type as DbEntityType }),
            ...(input.ruleset && { ruleset: input.ruleset }),
            ...(input.since > 0 ? { catalogVersion: { gt: input.since } } : { archivedAt: null }),
          },
          include: { currentPublishedRevision: true },
          orderBy: [{ entityType: 'asc' }, { ruleset: 'asc' }, { slug: 'asc' }],
        });
        const response: CatalogEntitiesResponse = {
          catalogVersion: latest?.version ?? 0,
          since: input.since,
          entities: [],
          removed: [],
          skipped: [],
        };
        for (const row of rows) {
          const entityType = row.entityType as RulesEntityType;
          const ruleset = row.ruleset as Ruleset;
          if (row.archivedAt) {
            response.removed.push({
              id: row.id,
              entityType,
              ruleset,
              slug: row.slug,
              catalogVersion: row.catalogVersion ?? 0,
            });
            continue;
          }
          const revision = row.currentPublishedRevision;
          if (!revision) continue;
          try {
            response.entities.push(this.toEntity(row, revision));
          } catch (error) {
            // One stale row must not take the whole catalog down.
            response.skipped.push({
              id: row.id,
              entityType,
              ruleset,
              slug: row.slug,
              revisionId: revision.id,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }
        return response;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  private toEntity(
    row: { id: string; entityType: DbEntityType; ruleset: string; slug: string },
    revision: RulesEntityRevision,
  ): CatalogEntity {
    return toCatalogEntity(
      {
        id: row.id,
        entityType: row.entityType as RulesEntityType,
        ruleset: row.ruleset as Ruleset,
        slug: row.slug,
        schemaVersion: revision.schemaVersion,
        revisionId: revision.id,
        revisionNumber: revision.revisionNumber,
        catalogVersion: revision.catalogVersion,
        publishedAt: revision.publishedAt ? revision.publishedAt.toISOString() : null,
        sourceLicense: revision.sourceLicense,
        sourceDocumentId: revision.sourceDocumentId,
      },
      revision.data,
    );
  }
}

import {
  Prisma,
  type PrismaClient,
  type RulesEntity as DbRulesEntity,
  type RulesEntityRevision as DbRulesRevision,
  type RulesEntityType as DbEntityType,
  type RulesRevisionStatus as DbRevisionStatus,
} from '@prisma/client';
import {
  SUPPORTED_SCHEMA_VERSIONS,
  diffJson,
  parseRulesEntityData,
  toCatalogEntity,
  type RulesDiffResponse,
  type RulesEntityDetail,
  type RulesEntityListResponse,
  type RulesEntitySummary,
  type RulesEntityType,
  type RulesPreviewResponse,
  type RulesRevision,
  type RulesRevisionStatus,
  type RulesRevisionSummary,
  type RulesValidationIssue,
  type RulesValidationResponse,
  type Ruleset,
} from '@nexus/rules-contracts';
import { RulesError, notFound, revisionConflict } from './rules-errors';
import { validateRulesRevision } from './rules-validation';

type Tx = Prisma.TransactionClient;

/** Arbitrary constant serialising catalog-version allocation across replicas. */
const CATALOG_VERSION_LOCK_KEY = 724_301_004;

export interface CreateEntityInput {
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
  schemaVersion: number;
  data: unknown;
  sourceDocumentId?: string;
  sourceLicense: string;
}

export interface SaveDraftInput {
  schemaVersion?: number;
  data: unknown;
  sourceDocumentId?: string | null;
  sourceLicense?: string;
}

export interface ListEntitiesInput {
  type?: RulesEntityType;
  ruleset?: Ruleset;
  status?: RulesRevisionStatus;
  q?: string;
  archived: 'true' | 'false' | 'all';
  limit: number;
  offset: number;
}

export interface PublishResult {
  catalogVersion: number;
  entity: RulesEntityDetail;
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

export function toRevisionSummary(revision: DbRulesRevision): RulesRevisionSummary {
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    status: revision.status as RulesRevisionStatus,
    schemaVersion: revision.schemaVersion,
    sourceDocumentId: revision.sourceDocumentId,
    sourceLicense: revision.sourceLicense,
    createdBy: revision.createdBy,
    createdAt: revision.createdAt.toISOString(),
    publishedBy: revision.publishedBy,
    publishedAt: iso(revision.publishedAt),
    supersededAt: iso(revision.supersededAt),
    catalogVersion: revision.catalogVersion,
    restoredFromRevisionNumber: revision.restoredFromRevisionNumber,
  };
}

export function toRevision(revision: DbRulesRevision): RulesRevision {
  return { ...toRevisionSummary(revision), data: revision.data };
}

function nameOf(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && typeof (data as { name?: unknown }).name === 'string') {
    return (data as { name: string }).name;
  }
  return null;
}

function toSummary(entity: DbRulesEntity, head: DbRulesRevision): RulesEntitySummary {
  return {
    id: entity.id,
    entityType: entity.entityType as RulesEntityType,
    ruleset: entity.ruleset as Ruleset,
    slug: entity.slug,
    name: nameOf(head.data),
    schemaVersion: entity.schemaVersion,
    currentPublishedRevisionId: entity.currentPublishedRevisionId,
    headRevisionNumber: entity.headRevisionNumber,
    headStatus: head.status as RulesRevisionStatus,
    createdAt: entity.createdAt.toISOString(),
    archivedAt: iso(entity.archivedAt),
  };
}

function assertDataIsObject(data: unknown): void {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new RulesError(400, 'bad_request', 'data must be a JSON object');
  }
}

function assertSupportedSchemaVersion(entityType: RulesEntityType, schemaVersion: number): void {
  if (!SUPPORTED_SCHEMA_VERSIONS[entityType].includes(schemaVersion)) {
    throw new RulesError(400, 'bad_request', `${entityType} schema version ${schemaVersion} is not supported`);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Codex rules registry: draft/validate/publish workflow over immutable,
 * numbered revisions. See apps/docs/codex/rules-registry.md.
 *
 * Concurrency model: every mutation of an existing entity locks the entity
 * row (`SELECT ... FOR UPDATE`) and compares the caller's expected revision
 * number with `headRevisionNumber`. A mismatch is a 409 carrying the current
 * head, never last-write-wins. The (entityId, revisionNumber) unique index is
 * the backstop if a writer ever bypasses the lock.
 */
export class RulesRegistryService {
  constructor(private readonly prisma: PrismaClient) {}

  async listEntities(input: ListEntitiesInput): Promise<RulesEntityListResponse> {
    const where: Prisma.RulesEntityWhereInput = {
      ...(input.type && { entityType: input.type as DbEntityType }),
      ...(input.ruleset && { ruleset: input.ruleset }),
      ...(input.q && { slug: { contains: input.q.toLowerCase() } }),
      ...(input.archived === 'true' && { archivedAt: { not: null } }),
      ...(input.archived === 'false' && { archivedAt: null }),
      // Only the head can be draft/validated and only the current published
      // revision is `published`, so "has a revision in status X" is exact for
      // those statuses.
      ...(input.status && { revisions: { some: { status: input.status as DbRevisionStatus } } }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.rulesEntity.count({ where }),
      this.prisma.rulesEntity.findMany({
        where,
        orderBy: [{ entityType: 'asc' }, { ruleset: 'asc' }, { slug: 'asc' }],
        skip: input.offset,
        take: input.limit,
        include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
      }),
    ]);
    return {
      items: rows.map((row) => toSummary(row, row.revisions[0])),
      total,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async getEntity(id: string, db: PrismaClient | Tx = this.prisma): Promise<RulesEntityDetail> {
    const entity = await db.rulesEntity.findUnique({
      where: { id },
      include: { revisions: { orderBy: { revisionNumber: 'desc' } } },
    });
    if (!entity) throw notFound('rules entity');
    const head = entity.revisions[0];
    const published = entity.revisions.find((r) => r.id === entity.currentPublishedRevisionId) ?? null;
    return {
      ...toSummary(entity, head),
      head: toRevision(head),
      currentPublished: published ? toRevision(published) : null,
      revisions: entity.revisions.map(toRevisionSummary),
    };
  }

  async getRevision(id: string, revisionNumber: number): Promise<RulesRevision> {
    const revision = await this.prisma.rulesEntityRevision.findUnique({
      where: { entityId_revisionNumber: { entityId: id, revisionNumber } },
    });
    if (!revision) throw notFound(`revision ${revisionNumber}`);
    return toRevision(revision);
  }

  async createEntity(input: CreateEntityInput, actor: string): Promise<RulesEntityDetail> {
    assertDataIsObject(input.data);
    assertSupportedSchemaVersion(input.entityType, input.schemaVersion);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const entity = await tx.rulesEntity.create({
          data: {
            entityType: input.entityType as DbEntityType,
            ruleset: input.ruleset,
            slug: input.slug,
            schemaVersion: input.schemaVersion,
            headRevisionNumber: 1,
          },
        });
        await tx.rulesEntityRevision.create({
          data: {
            entityId: entity.id,
            revisionNumber: 1,
            status: 'draft',
            schemaVersion: input.schemaVersion,
            data: input.data as Prisma.InputJsonValue,
            sourceDocumentId: input.sourceDocumentId ?? null,
            sourceLicense: input.sourceLicense,
            createdBy: actor,
          },
        });
        return this.getEntity(entity.id, tx);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new RulesError(
          409,
          'slug_conflict',
          `${input.entityType} "${input.slug}" already exists in ruleset ${input.ruleset}`,
        );
      }
      throw error;
    }
  }

  /**
   * Append a new draft revision. Works both for editing an open draft and for
   * starting a new draft on top of a published entity. The replaced open
   * draft (if any) becomes `superseded`; the published revision is untouched.
   */
  async saveDraft(
    id: string,
    expectedRevisionNumber: number,
    input: SaveDraftInput,
    actor: string,
  ): Promise<RulesEntityDetail> {
    assertDataIsObject(input.data);
    return this.mutate(id, expectedRevisionNumber, async (tx, entity, head) => {
      this.assertNotArchived(entity);
      const schemaVersion = input.schemaVersion ?? head.schemaVersion;
      assertSupportedSchemaVersion(entity.entityType as RulesEntityType, schemaVersion);
      if (head.status === 'draft' || head.status === 'validated') {
        await this.supersede(tx, head.id);
      }
      await this.appendRevision(tx, entity, {
        status: 'draft',
        schemaVersion,
        data: input.data,
        sourceDocumentId:
          input.sourceDocumentId === undefined ? head.sourceDocumentId : input.sourceDocumentId,
        sourceLicense: input.sourceLicense ?? head.sourceLicense,
        createdBy: actor,
      });
    });
  }

  /** Run publication checks on the head; a passing draft becomes `validated`. */
  async validate(id: string, expectedRevisionNumber: number, actor: string): Promise<RulesValidationResponse> {
    let issues: RulesValidationIssue[] = [];
    const entity = await this.mutate(id, expectedRevisionNumber, async (tx, row, head) => {
      if (head.status !== 'draft' && head.status !== 'validated') {
        throw new RulesError(409, 'invalid_state', `revision ${head.revisionNumber} is ${head.status}; save a draft first`);
      }
      issues = await validateRulesRevision(tx, this.target(row), head.schemaVersion, head.data);
      if (issues.length === 0 && head.status === 'draft') {
        await tx.rulesEntityRevision.update({
          where: { id: head.id },
          data: { status: 'validated', validatedBy: actor, validatedAt: new Date() },
        });
      }
    });
    return { valid: issues.length === 0, issues, entity };
  }

  /** Publish the validated head, superseding the previous published revision. */
  async publish(id: string, expectedRevisionNumber: number, actor: string): Promise<PublishResult> {
    let catalogVersion = 0;
    const entity = await this.mutate(id, expectedRevisionNumber, async (tx, row, head) => {
      this.assertNotArchived(row);
      if (head.status !== 'validated') {
        throw new RulesError(
          409,
          'invalid_state',
          `only a validated revision can be published; revision ${head.revisionNumber} is ${head.status}`,
        );
      }
      // References may have been archived since validation; re-check under lock.
      const issues = await validateRulesRevision(tx, this.target(row), head.schemaVersion, head.data);
      if (issues.length > 0) {
        throw new RulesError(422, 'validation_failed', 'revision no longer passes validation', { issues });
      }
      catalogVersion = await this.allocateCatalogVersion(tx, actor, 'publish', [row.id]);
      if (row.currentPublishedRevisionId) await this.supersede(tx, row.currentPublishedRevisionId);
      await tx.rulesEntityRevision.update({
        where: { id: head.id },
        data: { status: 'published', publishedBy: actor, publishedAt: new Date(), catalogVersion },
      });
      await tx.rulesEntity.update({
        where: { id: row.id },
        data: { currentPublishedRevisionId: head.id, catalogVersion, schemaVersion: head.schemaVersion },
      });
    });
    return { catalogVersion, entity };
  }

  /**
   * Restore an older published revision by publishing a NEW revision with a
   * copy of its data. History is never rewritten. An open draft is superseded
   * (it stays in history); the caller acknowledged it via the expected
   * revision number.
   */
  async rollback(
    id: string,
    expectedRevisionNumber: number,
    targetRevisionNumber: number,
    actor: string,
  ): Promise<PublishResult> {
    let catalogVersion = 0;
    const entity = await this.mutate(id, expectedRevisionNumber, async (tx, row, head) => {
      this.assertNotArchived(row);
      const target = await tx.rulesEntityRevision.findUnique({
        where: { entityId_revisionNumber: { entityId: row.id, revisionNumber: targetRevisionNumber } },
      });
      if (!target) throw notFound(`revision ${targetRevisionNumber}`);
      if (!target.publishedAt) {
        throw new RulesError(409, 'invalid_state', `revision ${targetRevisionNumber} was never published`);
      }
      if (target.id === row.currentPublishedRevisionId) {
        throw new RulesError(409, 'invalid_state', `revision ${targetRevisionNumber} is already the published revision`);
      }
      const issues = await validateRulesRevision(tx, this.target(row), target.schemaVersion, target.data);
      if (issues.length > 0) {
        throw new RulesError(422, 'validation_failed', `revision ${targetRevisionNumber} no longer passes validation`, {
          issues,
        });
      }
      catalogVersion = await this.allocateCatalogVersion(tx, actor, 'rollback', [row.id]);
      if (head.status === 'draft' || head.status === 'validated') await this.supersede(tx, head.id);
      if (row.currentPublishedRevisionId) await this.supersede(tx, row.currentPublishedRevisionId);
      const now = new Date();
      const restored = await this.appendRevision(tx, row, {
        status: 'published',
        schemaVersion: target.schemaVersion,
        data: target.data,
        sourceDocumentId: target.sourceDocumentId,
        sourceLicense: target.sourceLicense,
        createdBy: actor,
        restoredFromRevisionNumber: target.revisionNumber,
        validatedBy: actor,
        validatedAt: now,
        publishedBy: actor,
        publishedAt: now,
        catalogVersion,
      });
      await tx.rulesEntity.update({
        where: { id: row.id },
        data: { currentPublishedRevisionId: restored.id, catalogVersion, schemaVersion: target.schemaVersion },
      });
    });
    return { catalogVersion, entity };
  }

  async setArchived(
    id: string,
    archived: boolean,
    expectedRevisionNumber: number | undefined,
    actor: string,
  ): Promise<RulesEntityDetail> {
    return this.mutate(id, expectedRevisionNumber, async (tx, row) => {
      if (archived === (row.archivedAt !== null)) {
        throw new RulesError(409, 'invalid_state', `entity is already ${archived ? 'archived' : 'active'}`);
      }
      let catalogVersion = row.catalogVersion;
      if (row.currentPublishedRevisionId) {
        catalogVersion = await this.allocateCatalogVersion(tx, actor, archived ? 'archive' : 'unarchive', [row.id]);
      }
      await tx.rulesEntity.update({
        where: { id: row.id },
        data: { archivedAt: archived ? new Date() : null, catalogVersion },
      });
    });
  }

  /** Normalized entity exactly as catalog consumers would receive it. */
  async preview(id: string, revisionNumber?: number): Promise<RulesPreviewResponse> {
    const entity = await this.prisma.rulesEntity.findUnique({ where: { id } });
    if (!entity) throw notFound('rules entity');
    const revision = await this.prisma.rulesEntityRevision.findUnique({
      where: {
        entityId_revisionNumber: { entityId: id, revisionNumber: revisionNumber ?? entity.headRevisionNumber },
      },
    });
    if (!revision) throw notFound(`revision ${revisionNumber}`);
    const entityType = entity.entityType as RulesEntityType;
    const ruleset = entity.ruleset as Ruleset;
    const parsed = parseRulesEntityData(entityType, ruleset, revision.data);
    if (!parsed.success) {
      throw new RulesError(422, 'validation_failed', 'revision data does not satisfy the contract', {
        issues: parsed.issues,
      });
    }
    return {
      revisionNumber: revision.revisionNumber,
      status: revision.status as RulesRevisionStatus,
      entity: toCatalogEntity(
        {
          id: entity.id,
          entityType,
          ruleset,
          slug: entity.slug,
          schemaVersion: revision.schemaVersion,
          revisionId: revision.id,
          revisionNumber: revision.revisionNumber,
          catalogVersion: revision.catalogVersion,
          publishedAt: iso(revision.publishedAt),
          sourceLicense: revision.sourceLicense,
          sourceDocumentId: revision.sourceDocumentId,
        },
        parsed.data,
      ),
    };
  }

  async diff(id: string, from: number, to: number): Promise<RulesDiffResponse> {
    const revisions = await this.prisma.rulesEntityRevision.findMany({
      where: { entityId: id, revisionNumber: { in: [from, to] } },
    });
    const left = revisions.find((r) => r.revisionNumber === from);
    const right = revisions.find((r) => r.revisionNumber === to);
    if (!left) throw notFound(`revision ${from}`);
    if (!right) throw notFound(`revision ${to}`);
    return { from, to, operations: diffJson(left.data, right.data) };
  }

  // -- internals -----------------------------------------------------------

  private target(row: DbRulesEntity) {
    return {
      id: row.id,
      entityType: row.entityType as RulesEntityType,
      ruleset: row.ruleset as Ruleset,
      slug: row.slug,
    };
  }

  private assertNotArchived(row: DbRulesEntity): void {
    if (row.archivedAt) {
      throw new RulesError(409, 'entity_archived', 'entity is archived; unarchive it first');
    }
  }

  /**
   * Lock the entity, check the expected head, run `work`, and return the
   * refreshed detail from inside the same transaction.
   */
  private async mutate(
    id: string,
    expectedRevisionNumber: number | undefined,
    work: (tx: Tx, entity: DbRulesEntity, head: DbRulesRevision) => Promise<void>,
  ): Promise<RulesEntityDetail> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "rules_entities" WHERE "id" = ${id} FOR UPDATE
        `;
        if (locked.length === 0) throw notFound('rules entity');
        const entity = await tx.rulesEntity.findUniqueOrThrow({ where: { id } });
        const head = await tx.rulesEntityRevision.findUniqueOrThrow({
          where: { entityId_revisionNumber: { entityId: id, revisionNumber: entity.headRevisionNumber } },
        });
        if (expectedRevisionNumber !== undefined && expectedRevisionNumber !== entity.headRevisionNumber) {
          throw revisionConflict(toRevision(head), expectedRevisionNumber);
        }
        await work(tx, entity, head);
        return this.getEntity(id, tx);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Only reachable if a writer bypassed the row lock; report the head.
        const current = await this.getEntity(id);
        throw revisionConflict(current.head, expectedRevisionNumber ?? current.headRevisionNumber);
      }
      throw error;
    }
  }

  private async appendRevision(
    tx: Tx,
    entity: DbRulesEntity,
    revision: Omit<Prisma.RulesEntityRevisionUncheckedCreateInput, 'entityId' | 'revisionNumber' | 'data'> & {
      data: unknown;
    },
  ): Promise<DbRulesRevision> {
    const revisionNumber = entity.headRevisionNumber + 1;
    const created = await tx.rulesEntityRevision.create({
      data: {
        ...revision,
        data: revision.data as Prisma.InputJsonValue,
        entityId: entity.id,
        revisionNumber,
      },
    });
    await tx.rulesEntity.update({ where: { id: entity.id }, data: { headRevisionNumber: revisionNumber } });
    return created;
  }

  private async supersede(tx: Tx, revisionId: string): Promise<void> {
    await tx.rulesEntityRevision.update({
      where: { id: revisionId },
      data: { status: 'superseded', supersededAt: new Date() },
    });
  }

  private async allocateCatalogVersion(
    tx: Tx,
    actor: string,
    action: 'publish' | 'rollback' | 'archive' | 'unarchive',
    changedEntityIds: string[],
  ): Promise<number> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATALOG_VERSION_LOCK_KEY})`;
    const latest = await tx.rulesCatalogVersion.aggregate({ _max: { version: true } });
    const version = (latest._max.version ?? 0) + 1;
    await tx.rulesCatalogVersion.create({
      data: { version, publishedBy: actor, action, changedEntityIds },
    });
    return version;
  }
}

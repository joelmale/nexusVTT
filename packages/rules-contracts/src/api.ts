import { z } from 'zod';
import {
  RULES_SCHEMA_VERSION,
  RulesEntityTypeSchema,
  RulesRevisionStatusSchema,
  RulesetSchema,
  SlugSchema,
  SourceLicenseSchema,
  type RulesEntityType,
  type RulesRevisionStatus,
  type Ruleset,
} from './common.js';
import type { CatalogEntity, RulesValidationIssue } from './entity.js';
import type { JsonPatchOperation } from './jsonPatch.js';

/**
 * Wire contract for the Codex internal rules-admin API
 * (`/api/admin/rules/*`). Only the control-api calls it; browsers never do.
 */

/** Header carrying the authenticated control-plane actor ID. Required on mutations. */
export const RULES_ACTOR_HEADER = 'x-nexus-actor';

/**
 * Optimistic-concurrency token. Clients send the revision number of the
 * entity head they edited, either in the body or as `If-Match: "<n>"`.
 */
export const ExpectedRevisionSchema = z.number().int().min(1);

/** Revision data as submitted for a draft: any JSON object. */
export const DraftDataSchema = z.record(z.string(), z.unknown());

export const CreateRulesEntityRequestSchema = z
  .object({
    entityType: RulesEntityTypeSchema,
    ruleset: RulesetSchema,
    slug: SlugSchema,
    schemaVersion: z.number().int().positive().default(RULES_SCHEMA_VERSION),
    /** Draft data may be incomplete; it is only contract-checked on validate. */
    data: DraftDataSchema,
    sourceDocumentId: z.string().trim().min(1).optional(),
    sourceLicense: SourceLicenseSchema,
  })
  .strict();
export type CreateRulesEntityRequest = z.input<typeof CreateRulesEntityRequestSchema>;

export const SaveRulesDraftRequestSchema = z
  .object({
    expectedRevisionNumber: ExpectedRevisionSchema.optional(),
    schemaVersion: z.number().int().positive().optional(),
    data: DraftDataSchema,
    sourceDocumentId: z.string().trim().min(1).nullable().optional(),
    sourceLicense: SourceLicenseSchema.optional(),
  })
  .strict();
export type SaveRulesDraftRequest = z.input<typeof SaveRulesDraftRequestSchema>;

export const RulesTransitionRequestSchema = z
  .object({ expectedRevisionNumber: ExpectedRevisionSchema.optional() })
  .strict();
export type RulesTransitionRequest = z.input<typeof RulesTransitionRequestSchema>;

export const RulesRollbackRequestSchema = z
  .object({
    expectedRevisionNumber: ExpectedRevisionSchema.optional(),
    targetRevisionNumber: z.number().int().min(1),
  })
  .strict();
export type RulesRollbackRequest = z.input<typeof RulesRollbackRequestSchema>;

export const RulesEntityListQuerySchema = z
  .object({
    type: RulesEntityTypeSchema.optional(),
    ruleset: RulesetSchema.optional(),
    /** Status of the entity's head revision. */
    status: RulesRevisionStatusSchema.optional(),
    /** Case-insensitive slug substring. */
    q: z.string().trim().min(1).max(120).optional(),
    archived: z.enum(['true', 'false', 'all']).default('false'),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type RulesEntityListQuery = z.input<typeof RulesEntityListQuerySchema>;

export const CatalogEntitiesQuerySchema = z
  .object({
    type: RulesEntityTypeSchema.optional(),
    ruleset: RulesetSchema.optional(),
    since: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type CatalogEntitiesQuery = z.input<typeof CatalogEntitiesQuerySchema>;

export interface RulesRevisionSummary {
  id: string;
  revisionNumber: number;
  status: RulesRevisionStatus;
  schemaVersion: number;
  sourceDocumentId: string | null;
  sourceLicense: string;
  createdBy: string;
  createdAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  supersededAt: string | null;
  catalogVersion: number | null;
  /** Revision whose data this one restored, for rollbacks. */
  restoredFromRevisionNumber: number | null;
}

export interface RulesRevision extends RulesRevisionSummary {
  data: unknown;
}

export interface RulesEntitySummary {
  id: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
  name: string | null;
  schemaVersion: number;
  currentPublishedRevisionId: string | null;
  headRevisionNumber: number;
  headStatus: RulesRevisionStatus;
  createdAt: string;
  archivedAt: string | null;
}

export interface RulesEntityDetail extends RulesEntitySummary {
  head: RulesRevision;
  currentPublished: RulesRevision | null;
  revisions: RulesRevisionSummary[];
}

export interface RulesEntityListResponse {
  items: RulesEntitySummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface RulesValidationResponse {
  valid: boolean;
  issues: RulesValidationIssue[];
  entity: RulesEntityDetail;
}

export interface RulesPreviewResponse {
  revisionNumber: number;
  status: RulesRevisionStatus;
  entity: CatalogEntity;
}

export interface RulesDiffResponse {
  from: number;
  to: number;
  operations: JsonPatchOperation[];
}

/** Error body shared by every rules-admin failure. */
export interface RulesErrorResponse {
  error: string;
  code:
    | 'actor_required'
    | 'service_token_invalid'
    | 'bad_request'
    | 'not_found'
    | 'slug_conflict'
    | 'revision_conflict'
    | 'invalid_state'
    | 'entity_archived'
    | 'validation_failed';
  issues?: RulesValidationIssue[];
  /** Present on `revision_conflict`: the head the client must rebase onto. */
  current?: RulesRevision;
}

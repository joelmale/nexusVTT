/**
 * Rules registry through control-api (`/control-api/v1/rules/*`), which
 * mirrors doc-api `/api/admin/rules/*` 1:1. Wire types come from
 * `@nexus/rules-contracts`; see apps/docs/codex/rules-registry.md.
 */
import type {
  CreateRulesEntityRequest,
  RulesDiffResponse,
  RulesEntityDetail,
  RulesEntityListResponse,
  RulesEntityType,
  RulesPreviewResponse,
  RulesRevision,
  RulesRevisionStatus,
  RulesValidationIssue,
  RulesValidationResponse,
  Ruleset,
  CatalogEntity,
} from '@nexus/rules-contracts'
import { ApiError, RULES_API_BASE, controlJson, jsonRequest, queryString } from './api'

export interface RulesListFilters {
  type?: RulesEntityType
  ruleset?: Ruleset
  status?: RulesRevisionStatus
  q?: string
  archived?: 'true' | 'false' | 'all'
  limit?: number
  offset?: number
}

const entity = (id: string) => `${RULES_API_BASE}/entities/${encodeURIComponent(id)}`
const ifMatch = (revision: number) => ({ 'If-Match': `"${revision}"` })

export function listRulesEntities(filters: RulesListFilters): Promise<RulesEntityListResponse> {
  return controlJson(
    `${RULES_API_BASE}/entities${queryString({
      type: filters.type,
      ruleset: filters.ruleset,
      status: filters.status,
      q: filters.q?.trim(),
      archived: filters.archived,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
  )
}

export function createRulesEntity(request: CreateRulesEntityRequest): Promise<RulesEntityDetail> {
  return controlJson(`${RULES_API_BASE}/entities`, jsonRequest('POST', request))
}

export function getRulesEntity(id: string): Promise<RulesEntityDetail> {
  return controlJson(entity(id))
}

export function getRulesRevision(id: string, revisionNumber: number): Promise<RulesRevision> {
  return controlJson(`${entity(id)}/revisions/${revisionNumber}`)
}

/** Appends a draft revision; a stale `expectedRevisionNumber` is `409 revision_conflict`. */
export function saveRulesDraft(
  id: string,
  expectedRevisionNumber: number,
  data: Record<string, unknown>,
  sourceLicense?: string,
): Promise<RulesEntityDetail> {
  return controlJson(
    `${entity(id)}/draft`,
    jsonRequest('PUT', { expectedRevisionNumber, data, ...(sourceLicense ? { sourceLicense } : {}) }, ifMatch(expectedRevisionNumber)),
  )
}

export function validateRulesEntity(id: string, expectedRevisionNumber: number): Promise<RulesValidationResponse> {
  return controlJson(`${entity(id)}/validate`, jsonRequest('POST', { expectedRevisionNumber }))
}

export function previewRulesEntity(id: string, revision?: number): Promise<RulesPreviewResponse> {
  return controlJson(`${entity(id)}/preview${queryString({ revision })}`)
}

export function publishRulesEntity(
  id: string,
  expectedRevisionNumber: number,
): Promise<{ catalogVersion: number; entity: RulesEntityDetail }> {
  return controlJson(`${entity(id)}/publish`, jsonRequest('POST', { expectedRevisionNumber }))
}

export function rollbackRulesEntity(
  id: string,
  expectedRevisionNumber: number,
  targetRevisionNumber: number,
): Promise<{ catalogVersion: number; entity: RulesEntityDetail }> {
  return controlJson(
    `${entity(id)}/rollback`,
    jsonRequest('POST', { expectedRevisionNumber, targetRevisionNumber }),
  )
}

export function diffRulesRevisions(id: string, from: number, to: number): Promise<RulesDiffResponse> {
  return controlJson(`${entity(id)}/diff${queryString({ from, to })}`)
}

export function setRulesArchived(
  id: string,
  archived: boolean,
  expectedRevisionNumber: number,
): Promise<RulesEntityDetail> {
  return controlJson(
    `${entity(id)}/${archived ? 'archive' : 'unarchive'}`,
    jsonRequest('POST', { expectedRevisionNumber }),
  )
}

/** The server head carried by a `409 revision_conflict`, if present. */
export function conflictHead(error: unknown): RulesRevision | null {
  if (!(error instanceof ApiError) || error.status !== 409 || error.code !== 'revision_conflict') return null
  const body = error.body as { current?: RulesRevision } | undefined
  return body?.current ?? null
}

/** Validation issues carried by a rules error body (`422 validation_failed`, `400 bad_request`). */
export function errorIssues(error: unknown): RulesValidationIssue[] {
  if (!(error instanceof ApiError)) return []
  const body = error.body as { issues?: RulesValidationIssue[] } | undefined
  return Array.isArray(body?.issues) ? body.issues : []
}

export type { CatalogEntity }

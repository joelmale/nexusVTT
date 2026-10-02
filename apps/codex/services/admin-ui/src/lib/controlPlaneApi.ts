/**
 * control-api's own routes: operations summary, audit log, administrators.
 * See apps/docs/platform/control-api-adr.md.
 */
import { CONTROL_API_BASE, controlJson, jsonRequest, queryString } from './api'

export type ServiceStatus = 'up' | 'degraded' | 'down' | 'unknown'

export interface OperationsSummary {
  generatedAt: string
  services: Array<{ name: string; status: ServiceStatus; detail?: string }>
  metrics: {
    activeRooms?: number
    websocketConnections?: number
    commitP95Ms?: number
    codexQueueWaiting?: number
    codexQueueFailed?: number
    assetMissingFiles?: number
    assetManifestAgeSeconds?: number
  }
  alerts: Array<{ name: string; severity: string; since: string }>
  links: { grafana?: string | null; runbooks?: Array<{ title: string; url: string }> }
}

export function getOperationsSummary(): Promise<OperationsSummary> {
  return controlJson(`${CONTROL_API_BASE}/operations/summary`)
}

export interface AuditEvent {
  id: string
  occurredAt: string
  requestId: string | null
  actorUserId: string | null
  actorEmail: string | null
  identityProvider: string | null
  roleUsed: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  priorVersion: string | null
  sourceIp: string | null
  outcome: 'success' | 'denied' | 'conflict' | 'failure'
  summary: Record<string, unknown>
}

export function listAuditEvents(options: { limit?: number; before?: string | null } = {}): Promise<{
  events: AuditEvent[]
  nextCursor: string | null
}> {
  return controlJson(
    `${CONTROL_API_BASE}/audit/events${queryString({ limit: options.limit, before: options.before ?? undefined })}`,
  )
}

export const ADMIN_ROLES = ['platform_admin', 'content_editor', 'operator', 'auditor'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export interface Administrator {
  userId: string
  email: string
  name?: string | null
  displayName?: string | null
  isActive: boolean
  roles: Array<{ role: AdminRole; grantedAt: string; grantedBy: string | null }>
}

export async function listAdministrators(): Promise<Administrator[]> {
  return (await controlJson<{ administrators: Administrator[] }>(`${CONTROL_API_BASE}/administrators`)).administrators
}

export function grantRole(email: string, role: AdminRole): Promise<{ userId: string; role: AdminRole }> {
  return controlJson(`${CONTROL_API_BASE}/administrators/grants`, jsonRequest('POST', { email, role }))
}

export function revokeRole(userId: string, role: AdminRole): Promise<{ userId: string; role: AdminRole }> {
  return controlJson(`${CONTROL_API_BASE}/administrators/revocations`, jsonRequest('POST', { userId, role }))
}

export type DatabaseDomain = 'vtt' | 'codex' | 'control' | 'other'

export interface DatabaseTableSummary {
  tableName: string
  schemaName: string
  domain: DatabaseDomain
  estimatedRows: number
  totalBytes: number
  totalSize: string
}

export interface DatabaseColumnSummary {
  columnName: string
  ordinalPosition: number
  isNullable: boolean
  dataType: string
  udtName: string
  columnDefault: string | null
  characterMaximumLength: number | null
  keyType: 'PRIMARY KEY' | 'UNIQUE' | null
  foreignKeyTarget: string | null
}

export interface DatabaseTableSchema {
  tableName: string
  columns: DatabaseColumnSummary[]
}

export interface DatabaseRowsResult {
  tableName: string
  rows: Record<string, unknown>[]
  totalCount: number
  limit: number
  offset: number
}

export async function listDatabaseTables(): Promise<DatabaseTableSummary[]> {
  const result = await controlJson<{ tables: DatabaseTableSummary[] }>(`${CONTROL_API_BASE}/database/tables`)
  return result.tables
}

export function getDatabaseTableSchema(tableName: string): Promise<DatabaseTableSchema> {
  return controlJson(`${CONTROL_API_BASE}/database/tables/${encodeURIComponent(tableName)}/schema`)
}

export function getDatabaseTableRows(
  tableName: string,
  options: {
    limit?: number
    offset?: number
    sortColumn?: string
    sortDirection?: 'asc' | 'desc'
  } = {},
): Promise<DatabaseRowsResult> {
  return controlJson(
    `${CONTROL_API_BASE}/database/tables/${encodeURIComponent(tableName)}/rows${queryString({
      limit: options.limit,
      offset: options.offset,
      sortColumn: options.sortColumn,
      sortDirection: options.sortDirection,
    })}`,
  )
}


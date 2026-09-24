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

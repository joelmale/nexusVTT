import type { Permission } from '@/lib/api'

/**
 * Which permission(s) an Admin UI action needs, per the role table in
 * apps/docs/platform/control-api-adr.md. Any one listed permission enables the
 * action. This only hides or disables controls; control-api enforces the real
 * decision on every request.
 */
export const ACTION_PERMISSIONS = {
  editDocument: ['codex:write'],
  reprocessDocument: ['codex:write'],
  uploadDocuments: ['codex:write'],
  annotate: ['codex:write'],
  deleteDocument: ['codex:delete'],
  mergeDuplicates: ['codex:delete'],
  // content_editor retries through codex:write; operator through codex:maintain.
  retryJob: ['codex:write', 'codex:maintain'],
  removeJob: ['codex:maintain'],
  cleanQueue: ['codex:maintain'],
  manageAlerts: ['codex:maintain'],
  maintainIndex: ['codex:maintain'],
} as const satisfies Record<string, readonly Permission[]>

export type AdminAction = keyof typeof ACTION_PERMISSIONS

export function hasAnyPermission(granted: readonly string[], required: readonly Permission[]): boolean {
  return required.some((permission) => granted.includes(permission))
}

export function permissionHint(action: AdminAction): string {
  return `Requires ${ACTION_PERMISSIONS[action].join(' or ')}`
}

import type { Permission } from '@/lib/api'

/**
 * Which permission(s) an Admin UI action needs, per the role table in
 * apps/docs/platform/control-api-adr.md. Any one listed permission enables the
 * action. This only hides or disables controls; control-api enforces the real
 * decision on every request.
 *
 * Roles (control-api is the source of truth):
 * - platform_admin: everything
 * - content_editor: codex read/write, rules read/write, assets read/write
 * - operator: codex read/operate, ops:read, assets:read, audit:read
 * - auditor: codex read, ops:read, rules:read, assets:read, audit:read
 */
export const ACTION_PERMISSIONS = {
  // Codex documents
  viewDocuments: ['codex:read'],
  editDocument: ['codex:write'],
  reprocessDocument: ['codex:write'],
  uploadDocuments: ['codex:write'],
  annotate: ['codex:write'],
  deleteDocument: ['codex:delete'],
  mergeDuplicates: ['codex:delete'],
  // content_editor retries through codex:write; operator through codex:operate.
  retryJob: ['codex:write', 'codex:maintain', 'codex:operate'],
  removeJob: ['codex:maintain'],
  cleanQueue: ['codex:maintain', 'codex:operate'],
  manageAlerts: ['codex:maintain', 'codex:operate'],
  maintainIndex: ['codex:maintain'],
  // Operations
  viewOperations: ['ops:read'],
  // Assets
  viewAssets: ['assets:read'],
  editAssets: ['assets:write'],
  deleteAssets: ['assets:delete'],
  // Rules registry
  viewRules: ['rules:read'],
  editRules: ['rules:write'],
  publishRules: ['rules:publish'],
  // Control plane
  viewAudit: ['audit:read'],
  manageAdmins: ['admins:manage'],
} as const satisfies Record<string, readonly Permission[]>

export type AdminAction = keyof typeof ACTION_PERMISSIONS

export function hasAnyPermission(granted: readonly string[], required: readonly Permission[]): boolean {
  return required.some((permission) => granted.includes(permission))
}

export function permissionHint(action: AdminAction): string {
  return `Requires ${ACTION_PERMISSIONS[action].join(' or ')}`
}

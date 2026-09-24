import { ACTION_PERMISSIONS, hasAnyPermission, type AdminAction } from '@/auth/permissions'

export interface NavItem {
  path: string
  label: string
  /** Extra route prefixes that belong to this item (detail pages). */
  match?: string
}

export interface NavGroup {
  id: 'documents' | 'rules' | 'assets' | 'operations' | 'audit' | 'administrators'
  label: string
  /** Permission needed to see the group (a UI hint; control-api decides). */
  action: AdminAction
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'documents',
    label: 'Documents',
    action: 'viewDocuments',
    items: [
      { path: '/', label: 'Dashboard' },
      { path: '/documents', label: 'Documents', match: '/reader/' },
      { path: '/bulk-upload', label: 'Bulk Upload' },
      { path: '/processing', label: 'Processing' },
      { path: '/search', label: 'Search' },
      { path: '/deduplication', label: 'Deduplication' },
      { path: '/data-quality', label: 'Data Quality' },
      { path: '/elasticsearch', label: 'ElasticSearch' },
      { path: '/logs', label: 'Logs' },
    ],
  },
  {
    id: 'rules',
    label: 'Rules',
    action: 'viewRules',
    items: [{ path: '/rules', label: 'Rules registry', match: '/rules/' }],
  },
  {
    id: 'assets',
    label: 'Assets',
    action: 'viewAssets',
    items: [
      { path: '/assets', label: 'Library', match: '/assets/' },
      { path: '/assets/upload', label: 'Upload' },
      { path: '/assets/jobs', label: 'Jobs and integrity' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    action: 'viewOperations',
    items: [{ path: '/operations', label: 'Operations' }],
  },
  {
    id: 'audit',
    label: 'Audit',
    action: 'viewAudit',
    items: [{ path: '/audit', label: 'Audit log' }],
  },
  {
    id: 'administrators',
    label: 'Administrators',
    action: 'manageAdmins',
    items: [{ path: '/administrators', label: 'Administrators' }],
  },
]

export function visibleNavGroups(permissions: readonly string[]): NavGroup[] {
  return NAV_GROUPS.filter((group) => hasAnyPermission(permissions, ACTION_PERMISSIONS[group.action])).map((group) =>
    group.id === 'assets' && !hasAnyPermission(permissions, ACTION_PERMISSIONS.editAssets)
      ? { ...group, items: group.items.filter((item) => item.path !== '/assets/upload') }
      : group,
  )
}

/** The group owning `pathname`: exact item match first, then the longest prefix. */
export function activeNavGroup(groups: NavGroup[], pathname: string): NavGroup | undefined {
  const exact = groups.find((group) => group.items.some((item) => item.path === pathname))
  if (exact) return exact
  let best: { group: NavGroup; length: number } | undefined
  for (const group of groups) {
    for (const item of group.items) {
      if (item.match && pathname.startsWith(item.match) && item.match.length > (best?.length ?? 0)) {
        best = { group, length: item.match.length }
      }
    }
  }
  return best?.group
}

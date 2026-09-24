/**
 * Roles and permissions (ADR: Control API, identity, and roles).
 *
 * `codex:operate` is a narrower slice of `codex:maintain`: queue retry/clean
 * and alert acknowledge/resolve. The ADR gives `operator` "codex:maintain
 * (queue retry and clean only)"; a separate permission expresses that
 * restriction in data instead of special-casing the operator role in code.
 * Holding `codex:maintain` implies `codex:operate`.
 */
export const ROLES = [
  'platform_admin',
  'content_editor',
  'operator',
  'auditor',
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'codex:read',
  'codex:write',
  'codex:delete',
  'codex:maintain',
  'codex:operate',
  'audit:read',
  'admins:manage',
  'ops:read',
  'assets:read',
  'assets:write',
  'assets:delete',
  'rules:read',
  'rules:write',
  'rules:publish',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  platform_admin: PERMISSIONS,
  content_editor: ['codex:read', 'codex:write', 'assets:read', 'assets:write', 'rules:read', 'rules:write'],
  operator: ['codex:read', 'codex:operate', 'audit:read', 'ops:read', 'assets:read'],
  auditor: ['codex:read', 'audit:read', 'ops:read', 'assets:read', 'rules:read'],
};

/**
 * Least-privileged first, so `role_used` in the audit log names the narrowest
 * role that authorized an action.
 */
const ROLE_AUDIT_ORDER: readonly Role[] = [
  'auditor',
  'content_editor',
  'operator',
  'platform_admin',
];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

function roleGrants(role: Role, permission: Permission): boolean {
  const granted = ROLE_PERMISSIONS[role];
  if (granted.includes(permission)) return true;
  return permission === 'codex:operate' && granted.includes('codex:maintain');
}

export function permissionsFor(roles: readonly Role[]): Permission[] {
  return PERMISSIONS.filter((permission) =>
    roles.some((role) => roleGrants(role, permission)),
  );
}

/**
 * Returns the role that authorizes any of `required`, or null. `required` is
 * an any-of list: a route may accept more than one permission.
 */
export function authorizingRole(
  roles: readonly Role[],
  required: readonly Permission[],
): Role | null {
  for (const role of ROLE_AUDIT_ORDER) {
    if (!roles.includes(role)) continue;
    if (required.some((permission) => roleGrants(role, permission))) return role;
  }
  return null;
}

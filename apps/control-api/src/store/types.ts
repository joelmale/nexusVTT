import type { Role } from '../permissions.js';

export type AuditOutcome = 'success' | 'denied' | 'conflict' | 'failure';

export interface AuditEventInput {
  requestId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  /** 'google' for browser sessions, 'cli' for the bootstrap CLI. */
  identityProvider: string | null;
  roleUsed: Role | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  priorVersion: string | null;
  sourceIp: string | null;
  outcome: AuditOutcome;
  /** Identifiers and field names only; see audit.ts for redaction. */
  summary: Record<string, unknown>;
}

/** An audit event whose outcome and target are decided inside the store. */
export type AuditDraft = Omit<AuditEventInput, 'outcome' | 'resourceId'>;

export interface AuditEventRecord extends AuditEventInput {
  id: string;
  occurredAt: Date;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  provider: string;
  isActive: boolean;
}

export interface SessionRecord {
  /** sha256 hex of the cookie's random session ID. */
  idHash: string;
  userId: string;
  csrfToken: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  recentAuthAt: Date;
  sourceIp: string | null;
}

export interface SessionContext {
  session: SessionRecord;
  user: AdminUser;
  roles: Role[];
}

export interface RoleGrantRecord {
  role: Role;
  grantedAt: Date;
  grantedBy: string | null;
}

export interface AdministratorRecord {
  user: AdminUser;
  roles: RoleGrantRecord[];
}

export type GrantResult =
  | { status: 'granted'; userId: string }
  | { status: 'already_active'; userId: string }
  | { status: 'user_not_found' };

export type RevokeResult = 'revoked' | 'not_active' | 'last_platform_admin';

export interface CompleteLoginInput {
  userId: string;
  /** Google subject to bind on first admin login; null when already bound. */
  bindSubject: string | null;
  /** Session presented by the browser before login, deleted on rotation. */
  replaceSessionHash: string | null;
  session: SessionRecord;
  audit: AuditEventInput;
}

export interface ControlStore {
  ping(): Promise<void>;
  /** Finds one Google or local-password user eligible for Google admin linking. */
  findAdminEligibleUserByEmail(email: string): Promise<AdminUser | null>;
  getIdentitySubject(userId: string): Promise<string | null>;
  findUserIdBySubject(subject: string): Promise<string | null>;
  getActiveRoles(userId: string): Promise<Role[]>;
  /**
   * Binds the subject (if requested), rotates the session, and writes the
   * login audit row in one transaction. Returns 'subject_conflict' without
   * changing anything when the subject is already bound to another user.
   */
  completeLogin(input: CompleteLoginInput): Promise<'ok' | 'subject_conflict'>;
  getSessionContext(idHash: string): Promise<SessionContext | null>;
  touchSession(idHash: string, at: Date): Promise<void>;
  deleteSession(idHash: string, audit?: AuditEventInput): Promise<void>;
  grantRole(
    input: { email: string; role: Role; grantedBy: string | null; at: Date },
    audit: AuditDraft,
  ): Promise<GrantResult>;
  revokeRole(
    input: { userId: string; role: Role; revokedBy: string | null; at: Date },
    audit: AuditDraft,
  ): Promise<RevokeResult>;
  listAdministrators(): Promise<AdministratorRecord[]>;
  listAuditEvents(options: { limit: number; beforeId?: string }): Promise<AuditEventRecord[]>;
  appendAudit(event: AuditEventInput): Promise<void>;
  listDatabaseTables(): Promise<DatabaseTableSummary[]>;
  getTableSchema(tableName: string): Promise<DatabaseTableSchema | null>;
  getTableRows(
    tableName: string,
    options: {
      limit: number;
      offset: number;
      sortColumn?: string;
      sortDirection?: 'asc' | 'desc';
    },
  ): Promise<DatabaseRowsResult | null>;
  close(): Promise<void>;
}

export type DatabaseDomain = 'vtt' | 'codex' | 'control' | 'other';

export interface DatabaseTableSummary {
  tableName: string;
  schemaName: string;
  domain: DatabaseDomain;
  estimatedRows: number;
  totalBytes: number;
  totalSize: string;
}

export interface DatabaseColumnSummary {
  columnName: string;
  ordinalPosition: number;
  isNullable: boolean;
  dataType: string;
  udtName: string;
  columnDefault: string | null;
  characterMaximumLength: number | null;
  keyType: 'PRIMARY KEY' | 'UNIQUE' | null;
  foreignKeyTarget: string | null;
  canSelect?: boolean;
}

export interface DatabaseTableSchema {
  tableName: string;
  columns: DatabaseColumnSummary[];
}

export interface DatabaseRowsResult {
  tableName: string;
  rows: Record<string, unknown>[];
  totalCount: number;
  limit: number;
  offset: number;
  permissionDenied?: boolean;
}


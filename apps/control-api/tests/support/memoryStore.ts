import { randomUUID } from 'node:crypto';
import { finalizeAudit } from '../../src/audit.js';
import type { Role } from '../../src/permissions.js';
import type {
  AdministratorRecord,
  AdminUser,
  AuditDraft,
  AuditEventInput,
  AuditEventRecord,
  CompleteLoginInput,
  ControlStore,
  GrantResult,
  RevokeResult,
  SessionContext,
  SessionRecord,
} from '../../src/store/types.js';

interface RoleRow {
  userId: string;
  role: Role;
  grantedBy: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

/**
 * In-memory ControlStore for HTTP tests. The same contract suite
 * (tests/storeContract.ts) runs against this and against PostgreSQL, so the
 * two cannot silently diverge.
 */
export class MemoryControlStore implements ControlStore {
  users = new Map<string, AdminUser>();
  identities = new Map<string, string>(); // userId -> subject
  sessions = new Map<string, SessionRecord>();
  roles: RoleRow[] = [];
  audit: AuditEventRecord[] = [];
  failPing = false;
  private nextAuditId = 1;

  addUser(partial: Partial<AdminUser> & { email: string }): AdminUser {
    const user: AdminUser = {
      id: partial.id ?? randomUUID(),
      email: partial.email,
      name: partial.name ?? partial.email.split('@')[0]!,
      displayName: partial.displayName ?? null,
      provider: partial.provider ?? 'google',
      isActive: partial.isActive ?? true,
    };
    this.users.set(user.id, user);
    return user;
  }

  addRole(userId: string, role: Role, at = new Date()): void {
    this.roles.push({ userId, role, grantedBy: null, grantedAt: at, revokedAt: null, revokedBy: null });
  }

  async ping(): Promise<void> {
    if (this.failPing) throw new Error('database unavailable');
  }

  async findGoogleUserByEmail(email: string): Promise<AdminUser | null> {
    const matches = [...this.users.values()].filter(
      (user) => user.provider === 'google' && user.email.toLowerCase() === email.toLowerCase(),
    );
    return matches.length === 1 ? { ...matches[0]! } : null;
  }

  async getIdentitySubject(userId: string): Promise<string | null> {
    return this.identities.get(userId) ?? null;
  }

  async findUserIdBySubject(subject: string): Promise<string | null> {
    for (const [userId, bound] of this.identities) if (bound === subject) return userId;
    return null;
  }

  async getActiveRoles(userId: string): Promise<Role[]> {
    return this.roles
      .filter((row) => row.userId === userId && row.revokedAt === null)
      .map((row) => row.role)
      .sort();
  }

  async completeLogin(input: CompleteLoginInput): Promise<'ok' | 'subject_conflict'> {
    if (input.bindSubject !== null) {
      const existing = this.identities.get(input.userId);
      const owner = await this.findUserIdBySubject(input.bindSubject);
      if ((existing !== undefined && existing !== input.bindSubject) || (owner !== null && owner !== input.userId)) {
        return 'subject_conflict';
      }
      this.identities.set(input.userId, input.bindSubject);
    }
    if (input.replaceSessionHash) this.sessions.delete(input.replaceSessionHash);
    this.sessions.set(input.session.idHash, { ...input.session });
    this.pushAudit(input.audit);
    return 'ok';
  }

  async getSessionContext(idHash: string): Promise<SessionContext | null> {
    const session = this.sessions.get(idHash);
    if (!session) return null;
    const user = this.users.get(session.userId);
    if (!user) return null;
    return { session: { ...session }, user: { ...user }, roles: await this.getActiveRoles(user.id) };
  }

  async touchSession(idHash: string, at: Date): Promise<void> {
    const session = this.sessions.get(idHash);
    if (session && at > session.lastSeenAt) session.lastSeenAt = at;
  }

  async deleteSession(idHash: string, audit?: AuditEventInput): Promise<void> {
    this.sessions.delete(idHash);
    if (audit) this.pushAudit(audit);
  }

  private deleteSessionsFor(userId: string): void {
    for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash);
  }

  async grantRole(
    input: { email: string; role: Role; grantedBy: string | null; at: Date },
    audit: AuditDraft,
  ): Promise<GrantResult> {
    const user = await this.findGoogleUserByEmail(input.email);
    if (!user || !user.isActive) {
      this.pushAudit({ ...audit, resourceId: null, outcome: 'failure', summary: { ...audit.summary, result: 'user_not_found' } });
      return { status: 'user_not_found' };
    }
    if ((await this.getActiveRoles(user.id)).includes(input.role)) {
      this.pushAudit({ ...audit, resourceId: user.id, outcome: 'conflict', summary: { ...audit.summary, result: 'already_active' } });
      return { status: 'already_active', userId: user.id };
    }
    this.roles.push({ userId: user.id, role: input.role, grantedBy: input.grantedBy, grantedAt: input.at, revokedAt: null, revokedBy: null });
    this.deleteSessionsFor(user.id);
    this.pushAudit({ ...audit, resourceId: user.id, outcome: 'success', summary: { ...audit.summary, result: 'granted' } });
    return { status: 'granted', userId: user.id };
  }

  async revokeRole(
    input: { userId: string; role: Role; revokedBy: string | null; at: Date },
    audit: AuditDraft,
  ): Promise<RevokeResult> {
    const row = this.roles.find((r) => r.userId === input.userId && r.role === input.role && r.revokedAt === null);
    if (!row) {
      this.pushAudit({ ...audit, resourceId: input.userId, outcome: 'failure', summary: { ...audit.summary, result: 'not_active' } });
      return 'not_active';
    }
    if (input.role === 'platform_admin') {
      const others = this.roles.filter(
        (r) => r.role === 'platform_admin' && r.revokedAt === null && r.userId !== input.userId && this.users.get(r.userId)?.isActive === true,
      );
      if (others.length === 0) {
        this.pushAudit({ ...audit, resourceId: input.userId, outcome: 'conflict', summary: { ...audit.summary, result: 'last_platform_admin' } });
        return 'last_platform_admin';
      }
    }
    row.revokedAt = input.at > row.grantedAt ? input.at : row.grantedAt;
    row.revokedBy = input.revokedBy;
    this.deleteSessionsFor(input.userId);
    this.pushAudit({ ...audit, resourceId: input.userId, outcome: 'success', summary: { ...audit.summary, result: 'revoked' } });
    return 'revoked';
  }

  async listAdministrators(): Promise<AdministratorRecord[]> {
    const byUser = new Map<string, AdministratorRecord>();
    const active = this.roles
      .filter((row) => row.revokedAt === null)
      .sort((a, b) => a.role.localeCompare(b.role));
    for (const row of active) {
      const user = this.users.get(row.userId);
      if (!user) continue;
      let record = byUser.get(user.id);
      if (!record) {
        record = { user: { ...user }, roles: [] };
        byUser.set(user.id, record);
      }
      record.roles.push({ role: row.role, grantedAt: row.grantedAt, grantedBy: row.grantedBy });
    }
    return [...byUser.values()].sort((a, b) => a.user.email.toLowerCase().localeCompare(b.user.email.toLowerCase()));
  }

  async listAuditEvents(options: { limit: number; beforeId?: string }): Promise<AuditEventRecord[]> {
    return this.audit
      .filter((event) => options.beforeId === undefined || Number(event.id) < Number(options.beforeId))
      .sort((a, b) => Number(b.id) - Number(a.id))
      .slice(0, options.limit)
      .map((event) => ({ ...event }));
  }

  async appendAudit(event: AuditEventInput): Promise<void> {
    this.pushAudit(event);
  }

  private pushAudit(event: AuditEventInput): void {
    this.audit.push({ ...finalizeAudit(event), id: String(this.nextAuditId++), occurredAt: new Date() });
  }

  async close(): Promise<void> {}
}

import { parseArgs } from 'node:util';
import { isRole } from './permissions.js';
import type { AuditDraft, ControlStore } from './store/types.js';

const USAGE = `Usage:
  node dist/cli.js grant-role  --email <email> --role <role>
  node dist/cli.js revoke-role --email <email> --role <role>
  node dist/cli.js list-admins

Roles: platform_admin, content_editor, operator, auditor
Requires CONTROL_DATABASE_URL. Every change writes an audit row (actor "cli").`;

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

function cliAudit(action: string, summary: Record<string, unknown>): AuditDraft {
  return {
    requestId: null,
    actorUserId: null,
    actorEmail: 'cli',
    identityProvider: 'cli',
    roleUsed: null,
    action,
    resourceType: 'user_role',
    priorVersion: null,
    sourceIp: null,
    summary,
  };
}

/** Returns the process exit code. */
export async function runCli(argv: string[], store: ControlStore, io: CliIo, now: () => Date = () => new Date()): Promise<number> {
  const [command, ...rest] = argv;
  let values: { email?: string; role?: string };
  try {
    ({ values } = parseArgs({
      args: rest,
      options: { email: { type: 'string' }, role: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    io.err((error as Error).message);
    io.err(USAGE);
    return 2;
  }

  if (command === 'list-admins') {
    const admins = await store.listAdministrators();
    if (admins.length === 0) io.out('No active administrators.');
    for (const { user, roles } of admins) {
      const active = user.isActive ? '' : ' (user inactive)';
      io.out(`${user.email}\t${user.id}\t${roles.map((grant) => grant.role).join(',')}${active}`);
    }
    return 0;
  }

  if (command !== 'grant-role' && command !== 'revoke-role') {
    io.err(USAGE);
    return 2;
  }
  const email = values.email?.trim().toLowerCase();
  const role = values.role;
  if (!email || !/^[^\s@]+@[^\s@]+$/.test(email) || !isRole(role)) {
    io.err('Both --email <email> and a valid --role are required.');
    io.err(USAGE);
    return 2;
  }

  if (command === 'grant-role') {
    const result = await store.grantRole(
      { email, role, grantedBy: null, at: now() },
      cliAudit('admins.grant_role', { role, targetEmail: email }),
    );
    if (result.status === 'user_not_found') {
      io.err(`No active Google or password user with email ${email}.`);
      return 1;
    }
    if (result.status === 'already_active') {
      io.out(`${email} already has ${role}.`);
      return 0;
    }
    io.out(`Granted ${role} to ${email} (${result.userId}).`);
    return 0;
  }

  const user = await store.findAdminEligibleUserByEmail(email);
  if (!user) {
    io.err(`No Google or password user with email ${email}.`);
    return 1;
  }
  const result = await store.revokeRole(
    { userId: user.id, role, revokedBy: null, at: now() },
    cliAudit('admins.revoke_role', { role, targetEmail: email }),
  );
  if (result === 'not_active') {
    io.err(`${email} does not have an active ${role} role.`);
    return 1;
  }
  if (result === 'last_platform_admin') {
    io.err('Refusing to revoke the last active platform_admin. Grant another platform_admin first.');
    return 1;
  }
  io.out(`Revoked ${role} from ${email}; their admin sessions were ended.`);
  return 0;
}

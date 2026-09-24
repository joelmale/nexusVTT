import { describe, expect, it } from 'vitest';
import { sanitizeSummary } from '../src/audit.js';
import { CookieCrypto } from '../src/auth/tokens.js';
import { runCli } from '../src/cliCommands.js';
import { ConfigError, loadServerConfig } from '../src/config.js';
import { FixedWindowLimiter } from '../src/http/rateLimit.js';
import { createLogger } from '../src/logger.js';
import { authorizingRole, permissionsFor, ROLE_PERMISSIONS } from '../src/permissions.js';
import { MemoryControlStore } from './support/memoryStore.js';
import { SECRET } from './support/harness.js';

const VALID_ENV = {
  CONTROL_DATABASE_URL: 'postgres://nexus_control:pw@postgres:5432/nexus_vtt',
  DOC_API_URL: 'http://doc-api:3000',
  ADMIN_ORIGIN: 'https://admin.internal.nexusvtt.com',
  GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret-value',
  CONTROL_GOOGLE_CALLBACK_URL: 'https://admin.internal.nexusvtt.com/control-api/v1/auth/google/callback',
  CONTROL_SESSION_SECRET: SECRET,
  TRUST_PROXY_HOPS: '1',
  ASSET_SERVICE_SECRET: 'asset-service-secret-value-0123',
};

describe('permissions', () => {
  it('matches the ADR role table', () => {
    expect(permissionsFor(['platform_admin'])).toEqual([
      'codex:read', 'codex:write', 'codex:delete', 'codex:maintain', 'codex:operate', 'audit:read', 'admins:manage',
      'ops:read', 'assets:read', 'assets:write', 'assets:delete', 'rules:read', 'rules:write', 'rules:publish',
    ]);
    expect(permissionsFor(['content_editor'])).toEqual(['codex:read', 'codex:write', 'assets:read', 'assets:write', 'rules:read', 'rules:write']);
    expect(permissionsFor(['operator'])).toEqual(['codex:read', 'codex:operate', 'audit:read', 'ops:read', 'assets:read']);
    expect(permissionsFor(['auditor'])).toEqual(['codex:read', 'audit:read', 'ops:read', 'assets:read', 'rules:read']);
    expect(permissionsFor([])).toEqual([]);
    expect(ROLE_PERMISSIONS.operator).not.toContain('codex:maintain');
  });

  it('names the least-privileged authorizing role', () => {
    expect(authorizingRole(['platform_admin', 'auditor'], ['codex:read'])).toBe('auditor');
    expect(authorizingRole(['platform_admin', 'auditor'], ['codex:delete'])).toBe('platform_admin');
    expect(authorizingRole(['platform_admin'], ['codex:operate'])).toBe('platform_admin');
    expect(authorizingRole(['content_editor'], ['codex:write', 'codex:operate'])).toBe('content_editor');
    expect(authorizingRole(['auditor'], ['codex:write'])).toBeNull();
  });
});

describe('configuration', () => {
  it('loads a complete environment', () => {
    const config = loadServerConfig(VALID_ENV);
    expect(config.port).toBe(4000);
    expect(config.trustProxyHops).toBe(1);
    expect(config.adminOrigin).toBe('https://admin.internal.nexusvtt.com');
  });

  it('fails fast naming (not printing) missing variables', () => {
    const { GOOGLE_CLIENT_SECRET: _omit, CONTROL_SESSION_SECRET: _omit2, ...rest } = VALID_ENV;
    expect(() => loadServerConfig(rest)).toThrow(ConfigError);
    expect(() => loadServerConfig(rest)).toThrow(/GOOGLE_CLIENT_SECRET, CONTROL_SESSION_SECRET/);
    try {
      loadServerConfig({ ...VALID_ENV, CONTROL_SESSION_SECRET: 'short' });
    } catch (error) {
      expect((error as Error).message).toMatch(/CONTROL_SESSION_SECRET/);
      expect((error as Error).message).not.toContain('short"');
    }
  });

  it('rejects insecure or mismatched origins and callbacks', () => {
    expect(() => loadServerConfig({ ...VALID_ENV, ADMIN_ORIGIN: 'http://admin.internal.nexusvtt.com' })).toThrow(/ADMIN_ORIGIN/);
    expect(() => loadServerConfig({ ...VALID_ENV, ADMIN_ORIGIN: 'https://admin.internal.nexusvtt.com/app' })).toThrow(/ADMIN_ORIGIN/);
    expect(() => loadServerConfig({ ...VALID_ENV, CONTROL_GOOGLE_CALLBACK_URL: 'https://evil.example/control-api/v1/auth/google/callback' })).toThrow(/CONTROL_GOOGLE_CALLBACK_URL/);
    expect(() => loadServerConfig({ ...VALID_ENV, TRUST_PROXY_HOPS: 'true' })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it('defaults the wave-2 upstreams and leaves optional integrations off', () => {
    const config = loadServerConfig(VALID_ENV);
    expect(config.assetServiceUrl).toBe('http://asset-server:5003');
    expect(config.assetServiceSecret).toBe(VALID_ENV.ASSET_SERVICE_SECRET);
    expect(config.backendUrl).toBe('http://backend:5001');
    expect(config.prometheusUrl).toBeNull();
    expect(config.grafanaUrl).toBeNull();
    expect(config.rulesServiceToken).toBeNull();
    expect(config.objectStorageOrigin).toBe('http://codex-minio:9000');
  });

  it('reads optional integrations and treats empty values as unset', () => {
    const config = loadServerConfig({
      ...VALID_ENV,
      ASSET_SERVICE_URL: 'http://assets:6000/',
      BACKEND_URL: 'http://vtt:5001',
      PROMETHEUS_URL: 'http://prometheus:9090/',
      GRAFANA_URL: 'https://admin.internal.nexusvtt.com/grafana/',
      RULES_ADMIN_SERVICE_TOKEN: 'rules-service-token-0123456789',
      CODEX_OBJECT_STORAGE_URL: 'http://minio.internal:9000/',
    });
    expect(config.assetServiceUrl).toBe('http://assets:6000');
    expect(config.backendUrl).toBe('http://vtt:5001');
    expect(config.prometheusUrl).toBe('http://prometheus:9090');
    expect(config.grafanaUrl).toBe('https://admin.internal.nexusvtt.com/grafana/');
    expect(config.rulesServiceToken).toBe('rules-service-token-0123456789');
    expect(config.objectStorageOrigin).toBe('http://minio.internal:9000');
    const empty = loadServerConfig({ ...VALID_ENV, PROMETHEUS_URL: '', GRAFANA_URL: '', RULES_ADMIN_SERVICE_TOKEN: '', BACKEND_URL: '' });
    expect(empty.prometheusUrl).toBeNull();
    expect(empty.grafanaUrl).toBeNull();
    expect(empty.rulesServiceToken).toBeNull();
    expect(empty.backendUrl).toBe('http://backend:5001');
  });

  it('fails fast on a missing asset secret or invalid integration values, naming only the variable', () => {
    const { ASSET_SERVICE_SECRET: _omit, ...rest } = VALID_ENV;
    expect(() => loadServerConfig(rest)).toThrow(/Missing required environment variables: ASSET_SERVICE_SECRET/);
    expect(() => loadServerConfig({ ...VALID_ENV, ASSET_SERVICE_SECRET: 'short' })).toThrow(/ASSET_SERVICE_SECRET/);
    expect(() => loadServerConfig({ ...VALID_ENV, PROMETHEUS_URL: 'file:///etc/passwd' })).toThrow(/PROMETHEUS_URL/);
    expect(() => loadServerConfig({ ...VALID_ENV, GRAFANA_URL: 'not a url' })).toThrow(/GRAFANA_URL/);
    expect(() => loadServerConfig({ ...VALID_ENV, BACKEND_URL: 'http://user:pw@backend:5001' })).toThrow(/BACKEND_URL/);
    expect(() => loadServerConfig({ ...VALID_ENV, RULES_ADMIN_SERVICE_TOKEN: 'short' })).toThrow(/RULES_ADMIN_SERVICE_TOKEN/);
    try {
      loadServerConfig({ ...VALID_ENV, ASSET_SERVICE_SECRET: 'tiny-secret' });
    } catch (error) {
      expect((error as Error).message).not.toContain('tiny-secret');
    }
  });
});

describe('redaction', () => {
  it('redacts secrets from structured logs', () => {
    const lines: string[] = [];
    const logger = createLogger({ write: (line) => lines.push(line) });
    logger.info('x', { cookie: 'a', headers: { authorization: 'Bearer t', 'x-csrf-token': 'c' }, csrfToken: 'c', code_verifier: 'v', userId: 'u1', error: new Error('boom') });
    const record = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(record).toMatchObject({ cookie: '[REDACTED]', csrfToken: '[REDACTED]', code_verifier: '[REDACTED]', userId: 'u1', headers: { authorization: '[REDACTED]', 'x-csrf-token': '[REDACTED]' } });
    expect(record.error).toEqual({ name: 'Error', message: 'boom' });
    expect(lines[0]).not.toMatch(/Bearer t|"v"/);
  });

  it('drops content and credentials from audit summaries', () => {
    expect(sanitizeSummary({ fields: ['title'], content: 'secret', token: 't', nested: { password: 'p', id: 'x' }, long: 'y'.repeat(500) })).toEqual({
      fields: ['title'],
      nested: { id: 'x' },
      long: `${'y'.repeat(200)}…`,
    });
  });
});

describe('cookie crypto', () => {
  const crypto = new CookieCrypto(SECRET);

  it('signs session IDs and stores only a hash', () => {
    const { cookieValue, idHash } = crypto.newSessionId();
    expect(crypto.sessionHashFromCookie(cookieValue)).toBe(idHash);
    expect(idHash).not.toContain(cookieValue.split('.')[0]);
    expect(crypto.sessionHashFromCookie(`${cookieValue.split('.')[0]}.AAAA`)).toBeNull();
    expect(new CookieCrypto(`${SECRET}x`).sessionHashFromCookie(cookieValue)).toBeNull();
    expect(crypto.sessionHashFromCookie(undefined)).toBeNull();
  });

  it('seals login state with authenticated encryption', () => {
    const sealed = crypto.seal({ s: 'state' });
    expect(crypto.open(sealed)).toEqual({ s: 'state' });
    const parts = sealed.split('.');
    parts[2] = Buffer.from('tampered').toString('base64url');
    expect(crypto.open(parts.join('.'))).toBeNull();
  });
});

describe('rate limiter', () => {
  it('resets after the window', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(2, 1000, () => now);
    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a') > 0, limiter.hit('b')]).toEqual([0, 0, true, 0]);
    now = 1000;
    expect(limiter.hit('a')).toBe(0);
  });
});

describe('CLI', () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) } };
  };

  it('grants, lists, and revokes with audit rows attributed to the CLI', async () => {
    const store = new MemoryControlStore();
    const first = store.addUser({ email: 'first@example.com' });
    store.addUser({ email: 'second@example.com' });

    const a = io();
    expect(await runCli(['grant-role', '--email', 'First@Example.com', '--role', 'platform_admin'], store, a.io)).toBe(0);
    expect(await store.getActiveRoles(first.id)).toEqual(['platform_admin']);
    expect(store.audit[0]).toMatchObject({ action: 'admins.grant_role', outcome: 'success', actorEmail: 'cli', identityProvider: 'cli', actorUserId: null });

    const b = io();
    expect(await runCli(['list-admins'], store, b.io)).toBe(0);
    expect(b.out.join('\n')).toContain('first@example.com');

    const c = io();
    expect(await runCli(['revoke-role', '--email', 'first@example.com', '--role', 'platform_admin'], store, c.io)).toBe(1);
    expect(c.err.join('\n')).toMatch(/last active platform_admin/);
    expect(store.audit.at(-1)).toMatchObject({ outcome: 'conflict' });

    await runCli(['grant-role', '--email', 'second@example.com', '--role', 'platform_admin'], store, io().io);
    expect(await runCli(['revoke-role', '--email', 'first@example.com', '--role', 'platform_admin'], store, io().io)).toBe(0);
    expect(await store.getActiveRoles(first.id)).toEqual([]);
  });

  it('rejects unknown users, roles, and commands', async () => {
    const store = new MemoryControlStore();
    expect(await runCli(['grant-role', '--email', 'nobody@example.com', '--role', 'auditor'], store, io().io)).toBe(1);
    expect(await runCli(['grant-role', '--email', 'a@example.com', '--role', 'root'], store, io().io)).toBe(2);
    expect(await runCli(['drop-tables'], store, io().io)).toBe(2);
    expect(await runCli(['grant-role', '--email', 'a@example.com', '--role', 'auditor', '--force'], store, io().io)).toBe(2);
  });
});

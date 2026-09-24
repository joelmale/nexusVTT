import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../../src/app.js';
import type { IdentityProvider, LoginChecks, VerifiedClaims } from '../../src/auth/oidc.js';
import { CookieCrypto, randomToken } from '../../src/auth/tokens.js';
import { ASSET_ALLOWLIST } from '../../src/assets/allowlist.js';
import { CODEX_ALLOWLIST, type CodexRoute } from '../../src/codex/allowlist.js';
import { ABSOLUTE_LIFETIME_MS, type AppDeps } from '../../src/deps.js';
import { SESSION_COOKIE } from '../../src/http/cookies.js';
import { silentLogger } from '../../src/logger.js';
import type { Role } from '../../src/permissions.js';
import { RouteTable, type ProxyRoute } from '../../src/proxy/routeTable.js';
import { RULES_ALLOWLIST } from '../../src/rules/allowlist.js';
import type { AdminUser } from '../../src/store/types.js';
import { MemoryControlStore } from './memoryStore.js';

export const ADMIN_ORIGIN = 'https://admin.internal.nexusvtt.com';
export const CALLBACK_URL = `${ADMIN_ORIGIN}/control-api/v1/auth/google/callback`;
export const SECRET = 'test-session-secret-that-is-long-enough-0123456789';
export const DOC_API_URL = 'http://doc-api:3000';
export const ASSET_SERVICE_URL = 'http://asset-server:5003';
export const ASSET_SERVICE_SECRET = 'test-asset-service-secret-0123456789';
export const BACKEND_URL = 'http://backend:5001';
export const PROMETHEUS_URL = 'http://prometheus:9090';
export const GRAFANA_URL = 'https://admin.internal.nexusvtt.com/grafana/';
export const RULES_SERVICE_TOKEN = 'test-rules-service-token-0123456789';
export const OBJECT_STORAGE_ORIGIN = 'http://codex-minio:9000';

export interface UpstreamCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer | null;
  signal: AbortSignal | null;
}

export interface HarnessOptions {
  codexRoutes?: readonly CodexRoute[];
  assetRoutes?: readonly ProxyRoute[];
  config?: Partial<AppDeps['config']>;
}

export class FakeIdentityProvider implements IdentityProvider {
  lastChecks: LoginChecks | null = null;
  claims: VerifiedClaims = { subject: 'google-sub-1', email: 'admin@example.com', emailVerified: true };
  failExchange = false;

  async beginLogin(): Promise<{ url: URL; checks: LoginChecks }> {
    const checks = { state: randomToken(24), nonce: randomToken(24), codeVerifier: randomToken(48) };
    this.lastChecks = checks;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('state', checks.state);
    return { url, checks };
  }

  async completeLogin(_callbackUrl: URL, checks: LoginChecks): Promise<VerifiedClaims> {
    if (this.failExchange) throw new Error('nonce mismatch');
    if (!this.lastChecks || checks.nonce !== this.lastChecks.nonce) throw new Error('unexpected checks');
    return this.claims;
  }
}

export interface Harness {
  store: MemoryControlStore;
  idp: FakeIdentityProvider;
  crypto: CookieCrypto;
  clock: { now: Date };
  upstreamCalls: UpstreamCall[];
  upstream: { respond: (call: UpstreamCall) => Response | Promise<Response> };
  baseUrl: string;
  close: () => Promise<void>;
  request: (path: string, init?: RequestInit & { session?: TestSession; csrf?: boolean | string; origin?: string | null }) => Promise<Response>;
  sessionFor: (roles: Role[], options?: { email?: string; recentAuthAgoMs?: number; user?: AdminUser }) => Promise<TestSession>;
}

export interface TestSession {
  cookie: string;
  cookieValue: string;
  idHash: string;
  csrfToken: string;
  user: AdminUser;
}

export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  const store = new MemoryControlStore();
  const idp = new FakeIdentityProvider();
  const crypto = new CookieCrypto(SECRET);
  const clock = { now: new Date('2026-09-24T12:00:00.000Z') };
  const upstreamCalls: UpstreamCall[] = [];
  const upstream = {
    respond: (_call: UpstreamCall): Response | Promise<Response> =>
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
  };

  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    let body: Buffer | null = null;
    if (init?.body instanceof ReadableStream) {
      const chunks: Buffer[] = [];
      for await (const chunk of init.body as unknown as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
      body = Buffer.concat(chunks);
    } else if (init?.body instanceof Blob) {
      body = Buffer.from(await init.body.arrayBuffer());
    } else if (typeof init?.body === 'string') {
      body = Buffer.from(init.body, 'utf8');
    } else if (init?.body) {
      body = Buffer.from(init.body as Buffer);
    }
    const call: UpstreamCall = { url: String(input), method: init?.method ?? 'GET', headers, body, signal: init?.signal ?? null };
    upstreamCalls.push(call);
    return upstream.respond(call);
  }) as typeof fetch;

  const deps: AppDeps = {
    config: {
      adminOrigin: ADMIN_ORIGIN,
      docApiUrl: DOC_API_URL,
      googleCallbackUrl: CALLBACK_URL,
      trustProxyHops: 1,
      assetServiceUrl: ASSET_SERVICE_URL,
      assetServiceSecret: ASSET_SERVICE_SECRET,
      backendUrl: BACKEND_URL,
      prometheusUrl: PROMETHEUS_URL,
      grafanaUrl: GRAFANA_URL,
      rulesServiceToken: RULES_SERVICE_TOKEN,
      objectStorageOrigin: OBJECT_STORAGE_ORIGIN,
      operationsTimeoutMs: 300,
      ...options.config,
    },
    store,
    identityProvider: idp,
    cookieCrypto: crypto,
    logger: silentLogger,
    codexRoutes: new RouteTable(options.codexRoutes ?? CODEX_ALLOWLIST),
    assetRoutes: new RouteTable(options.assetRoutes ?? ASSET_ALLOWLIST),
    rulesRoutes: new RouteTable(RULES_ALLOWLIST),
    now: () => clock.now,
    fetch: fakeFetch,
  };
  const app = createApp(deps);
  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  let userCounter = 0;
  const sessionFor: Harness['sessionFor'] = async (roles, opts = {}) => {
    const user = opts.user ?? store.addUser({ email: opts.email ?? `user${++userCounter}@example.com` });
    for (const role of roles) store.addRole(user.id, role, new Date(clock.now.getTime() - 60_000));
    const { cookieValue, idHash } = crypto.newSessionId();
    const csrfToken = randomToken(32);
    store.sessions.set(idHash, {
      idHash,
      userId: user.id,
      csrfToken,
      createdAt: clock.now,
      lastSeenAt: clock.now,
      expiresAt: new Date(clock.now.getTime() + ABSOLUTE_LIFETIME_MS),
      recentAuthAt: new Date(clock.now.getTime() - (opts.recentAuthAgoMs ?? 0)),
      sourceIp: '127.0.0.1',
    });
    return { cookie: `${SESSION_COOKIE}=${cookieValue}`, cookieValue, idHash, csrfToken, user };
  };

  const request: Harness['request'] = (path, init = {}) => {
    const { session, csrf, origin, ...rest } = init;
    const headers = new Headers(rest.headers);
    const method = (rest.method ?? 'GET').toUpperCase();
    if (session) headers.set('cookie', session.cookie);
    const unsafe = method !== 'GET' && method !== 'HEAD';
    if (origin !== null && (origin !== undefined || unsafe)) headers.set('origin', origin ?? ADMIN_ORIGIN);
    if (session && csrf !== false && (unsafe || csrf !== undefined)) {
      headers.set('x-csrf-token', typeof csrf === 'string' ? csrf : session.csrfToken);
    }
    return fetch(`${baseUrl}${path}`, { ...rest, method, headers, redirect: 'manual' });
  };

  return {
    store,
    idp,
    crypto,
    clock,
    upstreamCalls,
    upstream,
    baseUrl,
    request,
    sessionFor,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

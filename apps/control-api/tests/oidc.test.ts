import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as client from 'openid-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OpenIdProvider } from '../src/auth/oidc.js';

/**
 * A minimal mock Google: authorization codes, a PKCE-checking token endpoint,
 * and RS256 ID tokens whose claims each test can tamper with. This exercises
 * the real openid-client validation used in production.
 */
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const REDIRECT_URI = 'https://admin.internal.nexusvtt.com/control-api/v1/auth/google/callback';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function signJwt(claims: Record<string, unknown>): string {
  const header = b64({ alg: 'RS256', typ: 'JWT', kid: 'k1' });
  const payload = b64(claims);
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

let forgeWith: (claims: Record<string, unknown>) => string = signJwt;

interface Grant {
  challenge: string;
  nonce: string;
}

describe('OpenIdProvider against a mock IdP', () => {
  let server: Server;
  let issuer: string;
  const grants = new Map<string, Grant>();
  let claimOverrides: Record<string, unknown> = {};
  let provider: OpenIdProvider;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/token') {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', () => {
          const form = new URLSearchParams(raw);
          const grant = grants.get(form.get('code') ?? '');
          const verifier = form.get('code_verifier') ?? '';
          const challenge = createHash('sha256').update(verifier).digest('base64url');
          if (!grant || grant.challenge !== challenge || form.get('redirect_uri') !== REDIRECT_URI) {
            res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'invalid_grant' }));
            return;
          }
          const now = Math.floor(Date.now() / 1000);
          const idToken = forgeWith({
            iss: issuer,
            aud: CLIENT_ID,
            sub: 'google-sub-123',
            email: 'admin@example.com',
            email_verified: true,
            nonce: grant.nonce,
            iat: now,
            exp: now + 300,
            ...claimOverrides,
          });
          res.writeHead(200, { 'content-type': 'application/json' }).end(
            JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires_in: 300, id_token: idToken }),
          );
        });
        return;
      }
      if (req.url === '/jwks') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] }),
        );
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    provider = new OpenIdProvider(async () => {
      const configuration = new client.Configuration(
        {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          id_token_signing_alg_values_supported: ['RS256'],
        },
        CLIENT_ID,
        'test-secret',
      );
      client.allowInsecureRequests(configuration);
      return configuration;
    }, REDIRECT_URI);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    claimOverrides = {};
    grants.clear();
  });

  /** Plays the browser + IdP authorize step; returns the callback URL. */
  async function authorize(state?: string, stepUp = false): Promise<{ callback: URL; checks: Awaited<ReturnType<OpenIdProvider['beginLogin']>>['checks'] }> {
    const { url, checks } = await provider.beginLogin({ stepUp });
    const code = `code-${Math.random().toString(36).slice(2)}`;
    grants.set(code, { challenge: url.searchParams.get('code_challenge')!, nonce: url.searchParams.get('nonce')! });
    const callback = new URL(REDIRECT_URI);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', state ?? url.searchParams.get('state')!);
    return { callback, checks };
  }

  it('builds an authorization URL with PKCE S256, state, nonce, and the email scope', async () => {
    const { url, checks } = await provider.beginLogin();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(checks.codeVerifier).digest('base64url'));
    expect(url.searchParams.get('state')).toBe(checks.state);
    expect(url.searchParams.get('nonce')).toBe(checks.nonce);
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    // A normal login offers the account chooser and does not force re-authentication.
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.has('max_age')).toBe(false);
  });

  it('forces re-authentication with max_age=0 on a step-up login', async () => {
    const { url } = await provider.beginLogin({ stepUp: true });
    expect(url.searchParams.get('max_age')).toBe('0');
    expect(url.searchParams.has('prompt')).toBe(false);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('returns the ID token auth_time for the step-up check', async () => {
    const authTime = Math.floor(Date.now() / 1000) - 2;
    claimOverrides = { auth_time: authTime };
    const { callback, checks } = await authorize(undefined, true);
    await expect(provider.completeLogin(callback, checks)).resolves.toMatchObject({ authTime });
  });

  it('reports a missing auth_time as null, never as now', async () => {
    const { callback, checks } = await authorize(undefined, true);
    await expect(provider.completeLogin(callback, checks)).resolves.toMatchObject({ authTime: null });
  });

  it('rejects a non-numeric auth_time', async () => {
    claimOverrides = { auth_time: 'yesterday' };
    const { callback, checks } = await authorize(undefined, true);
    await expect(provider.completeLogin(callback, checks)).rejects.toThrow();
  });

  it('exchanges the code with the PKCE verifier and returns verified claims', async () => {
    const { callback, checks } = await authorize();
    await expect(provider.completeLogin(callback, checks)).resolves.toEqual({
      subject: 'google-sub-123',
      email: 'admin@example.com',
      emailVerified: true,
      authTime: null,
    });
  });

  it('reports an unverified email as such', async () => {
    claimOverrides = { email_verified: false };
    const { callback, checks } = await authorize();
    await expect(provider.completeLogin(callback, checks)).resolves.toMatchObject({ emailVerified: false });
  });

  it('rejects a mismatched state', async () => {
    const { callback, checks } = await authorize('attacker-state');
    await expect(provider.completeLogin(callback, checks)).rejects.toThrow();
  });

  it('rejects a mismatched nonce', async () => {
    claimOverrides = { nonce: 'replayed-nonce' };
    const { callback, checks } = await authorize();
    await expect(provider.completeLogin(callback, checks)).rejects.toThrow();
  });

  it('rejects a wrong PKCE verifier', async () => {
    const { callback, checks } = await authorize();
    await expect(provider.completeLogin(callback, { ...checks, codeVerifier: client.randomPKCECodeVerifier() })).rejects.toThrow();
  });

  it('rejects an ID token for another audience or issuer, or expired', async () => {
    for (const override of [{ aud: 'someone-else' }, { iss: 'https://evil.example' }, { exp: Math.floor(Date.now() / 1000) - 3600 }]) {
      claimOverrides = override;
      const { callback, checks } = await authorize();
      await expect(provider.completeLogin(callback, checks)).rejects.toThrow();
    }
  });

  it('rejects an ID token with a forged signature', async () => {
    const { privateKey: attackerKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const original = signJwt;
    const forge = (claims: Record<string, unknown>) => {
      const header = b64({ alg: 'RS256', typ: 'JWT', kid: 'k1' });
      const payload = b64(claims);
      return `${header}.${payload}.${sign('sha256', Buffer.from(`${header}.${payload}`), attackerKey).toString('base64url')}`;
    };
    forgeWith = forge;
    try {
      const { callback, checks } = await authorize();
      await expect(provider.completeLogin(callback, checks)).rejects.toThrow();
    } finally {
      forgeWith = original;
    }
  });

  it('retries discovery after a failure instead of caching it', async () => {
    let attempts = 0;
    const flaky = new OpenIdProvider(async () => {
      attempts += 1;
      throw new Error('discovery down');
    }, REDIRECT_URI);
    await expect(flaky.beginLogin()).rejects.toThrow('discovery down');
    await expect(flaky.beginLogin()).rejects.toThrow('discovery down');
    expect(attempts).toBe(2);
  });
});

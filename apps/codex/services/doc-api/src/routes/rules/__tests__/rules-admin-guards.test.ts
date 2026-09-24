import Fastify, { type FastifyInstance } from 'fastify';
import { vi } from 'vitest';
import { rulesAdminRoutes } from '../admin';
import { rulesCatalogRoutes } from '../catalog';
import { createServiceTokenGuard, parseIfMatch } from '../http';
import { RulesError } from '../../../services/rules/rules-errors';
import type { RulesRegistryService } from '../../../services/rules/rules-registry.service';
import type { RulesCatalogService } from '../../../services/rules/rules-catalog.service';

const ENTITY_ID = '6f1c1c63-4f3b-4a0e-9d7e-1b2f3c4d5e6f';

function fakeService() {
  const detail = { id: ENTITY_ID, headRevisionNumber: 2 };
  return {
    listEntities: vi.fn(async () => ({ items: [], total: 0, limit: 50, offset: 0 })),
    createEntity: vi.fn(async () => ({ ...detail, headRevisionNumber: 1 })),
    saveDraft: vi.fn(async () => detail),
    validate: vi.fn(async () => ({ valid: true, issues: [], entity: detail })),
    publish: vi.fn(async () => ({ catalogVersion: 1, entity: detail })),
    rollback: vi.fn(async () => ({ catalogVersion: 2, entity: detail })),
    setArchived: vi.fn(async () => detail),
    getEntity: vi.fn(async () => {
      throw new RulesError(404, 'not_found', 'rules entity not found');
    }),
  };
}

async function build(serviceToken?: string, requireServiceToken?: boolean) {
  const service = fakeService();
  const app = Fastify();
  await app.register(rulesAdminRoutes, {
    service: service as unknown as RulesRegistryService,
    serviceToken,
    requireServiceToken,
  });
  await app.ready();
  return { app, service };
}

describe('rules admin route guards', () => {
  let app: FastifyInstance;
  let service: ReturnType<typeof fakeService>;

  beforeEach(async () => {
    ({ app, service } = await build());
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects mutations without an actor before touching the service', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/rules/entities/${ENTITY_ID}/draft`,
      payload: { expectedRevisionNumber: 1, data: {} },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('actor_required');
    expect(service.saveDraft).not.toHaveBeenCalled();
  });

  it('requires an expected revision for drafts, validation, publication and rollback', async () => {
    const headers = { 'x-nexus-actor': 'admin-1' };
    const cases = [
      { method: 'PUT' as const, url: `/api/admin/rules/entities/${ENTITY_ID}/draft`, payload: { data: {} } },
      { method: 'POST' as const, url: `/api/admin/rules/entities/${ENTITY_ID}/validate`, payload: {} },
      { method: 'POST' as const, url: `/api/admin/rules/entities/${ENTITY_ID}/publish` },
      { method: 'POST' as const, url: `/api/admin/rules/entities/${ENTITY_ID}/rollback`, payload: { targetRevisionNumber: 1 } },
    ];
    for (const request of cases) {
      const response = await app.inject({ ...request, headers });
      expect({ url: request.url, status: response.statusCode }).toEqual({ url: request.url, status: 400 });
    }
    expect(service.saveDraft).not.toHaveBeenCalled();
    expect(service.publish).not.toHaveBeenCalled();
  });

  it('accepts If-Match and forwards the actor', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/rules/entities/${ENTITY_ID}/publish`,
      headers: { 'x-nexus-actor': 'admin-1', 'if-match': 'W/"2"' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBe('"2"');
    expect(service.publish).toHaveBeenCalledWith(ENTITY_ID, 2, 'admin-1');
  });

  it('rejects disagreeing If-Match and body revisions', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/rules/entities/${ENTITY_ID}/publish`,
      headers: { 'x-nexus-actor': 'admin-1', 'if-match': '"3"' },
      payload: { expectedRevisionNumber: 2 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('validates request bodies and ids', async () => {
    const headers = { 'x-nexus-actor': 'admin-1' };
    const badCreate = await app.inject({
      method: 'POST',
      url: '/api/admin/rules/entities',
      headers,
      payload: { entityType: 'class', ruleset: '2014', slug: 'fighter', data: {}, sourceLicense: 'x' },
    });
    expect(badCreate.statusCode).toBe(400);
    expect(badCreate.json().code).toBe('bad_request');
    expect((await app.inject({ method: 'GET', url: '/api/admin/rules/entities/not-a-uuid' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: `/api/admin/rules/entities/${ENTITY_ID}` })).statusCode).toBe(404);
  });

  it('enforces the configured service token on every admin route', async () => {
    const guarded = await build('s3cret');
    try {
      const denied = await guarded.app.inject({ method: 'GET', url: '/api/admin/rules/entities' });
      expect(denied.statusCode).toBe(401);
      expect(denied.json().code).toBe('service_token_invalid');
      const allowed = await guarded.app.inject({
        method: 'GET',
        url: '/api/admin/rules/entities',
        headers: { 'x-nexus-service-token': 's3cret' },
      });
      expect(allowed.statusCode).toBe(200);
      for (const wrong of ['s3cre', 's3cretx', 'S3CRET', '']) {
        const response = await guarded.app.inject({
          method: 'GET',
          url: '/api/admin/rules/entities',
          headers: { 'x-nexus-service-token': wrong },
        });
        expect(response.statusCode).toBe(401);
      }
    } finally {
      await guarded.app.close();
    }
  });

  it('fails closed with 503 when a token is required but not configured, before any work', async () => {
    const closed = await build(undefined, true);
    try {
      for (const request of [
        { method: 'GET' as const, url: '/api/admin/rules/entities' },
        { method: 'GET' as const, url: '/api/admin/rules/entities', headers: { 'x-nexus-service-token': '' } },
        {
          method: 'POST' as const,
          url: `/api/admin/rules/entities/${ENTITY_ID}/publish`,
          headers: { 'x-nexus-actor': 'admin-1', 'if-match': '"2"', 'x-nexus-service-token': 'anything' },
        },
      ]) {
        const response = await closed.app.inject(request);
        expect(response.statusCode).toBe(503);
        expect(response.json().code).toBe('service_token_invalid');
      }
      expect(closed.service.listEntities).not.toHaveBeenCalled();
      expect(closed.service.publish).not.toHaveBeenCalled();
    } finally {
      await closed.app.close();
    }
  });

  it('keeps the published catalog open when the admin API fails closed', async () => {
    const service = fakeService();
    const catalog = {
      manifest: vi.fn(async () => ({ catalogVersion: 3, generatedAt: '2026-09-24T00:00:00.000Z' })),
    };
    const app = Fastify();
    await app.register(rulesAdminRoutes, { service: service as unknown as RulesRegistryService, requireServiceToken: true });
    await app.register(rulesCatalogRoutes, { service: catalog as unknown as RulesCatalogService });
    await app.ready();
    try {
      expect((await app.inject({ method: 'GET', url: '/api/admin/rules/entities' })).statusCode).toBe(503);
      const manifest = await app.inject({ method: 'GET', url: '/api/rules/catalog/manifest' });
      expect(manifest.statusCode).toBe(200);
      expect(manifest.json().catalogVersion).toBe(3);
    } finally {
      await app.close();
    }
  });
});

describe('createServiceTokenGuard', () => {
  const request = (token?: string) =>
    ({ headers: token === undefined ? {} : { 'x-nexus-service-token': token } }) as never;
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('fails closed in production when no token is configured', async () => {
    process.env.NODE_ENV = 'production';
    for (const token of [undefined, '']) {
      await expect(createServiceTokenGuard(token)(request('x'))).rejects.toMatchObject({ statusCode: 503 });
    }
    // Explicitly relaxable for local production-like runs.
    await expect(createServiceTokenGuard(undefined, { requireToken: false })(request())).resolves.toBeUndefined();
  });

  it('stays open outside production when no token is configured', async () => {
    process.env.NODE_ENV = 'test';
    await expect(createServiceTokenGuard(undefined)(request())).resolves.toBeUndefined();
    process.env.NODE_ENV = 'development';
    await expect(createServiceTokenGuard('')(request())).resolves.toBeUndefined();
  });

  it('requires a configured token in every environment', async () => {
    for (const env of ['production', 'development', 'test']) {
      process.env.NODE_ENV = env;
      const guard = createServiceTokenGuard('token-value');
      await expect(guard(request())).rejects.toMatchObject({ statusCode: 401 });
      await expect(guard(request('token-valuE'))).rejects.toMatchObject({ statusCode: 401 });
      await expect(guard(request('token-value'))).resolves.toBeUndefined();
    }
  });
});

describe('parseIfMatch', () => {
  it('parses strong, weak and bare revision tags', () => {
    expect(parseIfMatch(undefined)).toBeUndefined();
    expect(parseIfMatch('"4"')).toBe(4);
    expect(parseIfMatch('W/"4"')).toBe(4);
    expect(parseIfMatch('4')).toBe(4);
    expect(() => parseIfMatch('"abc"')).toThrow(RulesError);
  });
});

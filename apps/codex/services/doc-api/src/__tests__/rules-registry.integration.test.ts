import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { goblin2014, fireball2014, shield2024 } from '@nexus/rules-contracts/dist/fixtures';
import { rulesAdminRoutes, rulesCatalogRoutes } from '../routes/rules';
import { prisma } from '../services/database.service';

/**
 * Rules registry against a real PostgreSQL database (the integration job's
 * isolated schema). Slugs and names are unique per run because published
 * history is immutable and never cleaned up.
 */
describe('Rules registry integration', () => {
  let app: FastifyInstance;
  const run = randomUUID().slice(0, 8);
  const actor = { 'x-nexus-actor': 'admin-1' };
  const slug = (base: string) => `rt-${run}-${base}`;
  const named = <T extends { name: string }>(data: T, base: string) => ({ ...data, name: `${data.name} ${run}-${base}` });

  const create = (body: Record<string, unknown>, headers: Record<string, string> = actor) =>
    app.inject({ method: 'POST', url: '/api/admin/rules/entities', headers, payload: body });
  const post = (id: string, action: string, payload: Record<string, unknown> = {}, headers: Record<string, string> = actor) =>
    app.inject({ method: 'POST', url: `/api/admin/rules/entities/${id}/${action}`, headers, payload });
  const saveDraft = (id: string, payload: Record<string, unknown>, headers: Record<string, string> = actor) =>
    app.inject({ method: 'PUT', url: `/api/admin/rules/entities/${id}/draft`, headers, payload });
  const manifest = async () => (await app.inject({ method: 'GET', url: '/api/rules/catalog/manifest' })).json();

  async function publishNew(entityType: string, ruleset: string, base: string, data: Record<string, unknown>) {
    const created = await create({ entityType, ruleset, slug: slug(base), data, sourceLicense: 'CC-BY-4.0' });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    const validated = await post(id, 'validate', { expectedRevisionNumber: 1 });
    expect(validated.json().issues).toEqual([]);
    const published = await post(id, 'publish', { expectedRevisionNumber: 1 });
    expect(published.statusCode).toBe(200);
    return { id, catalogVersion: published.json().catalogVersion as number };
  }

  beforeAll(async () => {
    app = Fastify();
    await app.register(rulesAdminRoutes, { serviceToken: undefined });
    await app.register(rulesCatalogRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('requires the actor header on every mutation', async () => {
    const noActor = await create(
      { entityType: 'spell', ruleset: '2014', slug: slug('no-actor'), data: fireball2014, sourceLicense: 'CC-BY-4.0' },
      {},
    );
    expect(noActor.statusCode).toBe(401);
    expect(noActor.json().code).toBe('actor_required');

    const { id } = await publishNew('spell', '2014', 'actor-check', named(fireball2014, 'actor-check'));
    for (const action of ['validate', 'publish', 'archive', 'rollback']) {
      const response = await post(id, action, { expectedRevisionNumber: 1, targetRevisionNumber: 1 }, {});
      expect({ action, status: response.statusCode }).toEqual({ action, status: 401 });
    }
    expect((await saveDraft(id, { expectedRevisionNumber: 1, data: fireball2014 }, {})).statusCode).toBe(401);
  });

  it('runs draft -> validate -> publish and increments the catalog version', async () => {
    const before = await manifest();
    const created = await create({
      entityType: 'spell',
      ruleset: '2014',
      slug: slug('fireball'),
      data: named(fireball2014, 'fireball'),
      sourceLicense: 'CC-BY-4.0',
      sourceDocumentId: 'doc-srd-51',
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"1"');
    const entity = created.json();
    expect(entity).toMatchObject({ headRevisionNumber: 1, headStatus: 'draft', currentPublishedRevisionId: null });
    expect(entity.head).toMatchObject({ createdBy: 'admin-1', sourceDocumentId: 'doc-srd-51' });

    expect((await post(entity.id, 'publish', { expectedRevisionNumber: 1 })).json().code).toBe('invalid_state');

    const validated = await post(entity.id, 'validate', { expectedRevisionNumber: 1 });
    expect(validated.statusCode).toBe(200);
    expect(validated.json()).toMatchObject({ valid: true, issues: [], entity: { headStatus: 'validated' } });

    const published = await post(entity.id, 'publish', { expectedRevisionNumber: 1 });
    expect(published.statusCode).toBe(200);
    const result = published.json();
    expect(result.catalogVersion).toBeGreaterThan(before.catalogVersion);
    expect(result.entity).toMatchObject({ headStatus: 'published', currentPublishedRevisionId: result.entity.head.id });
    expect(result.entity.head).toMatchObject({ publishedBy: 'admin-1', catalogVersion: result.catalogVersion });

    const after = await manifest();
    expect(after.catalogVersion).toBe(result.catalogVersion);
    expect(after.counts['2014'].spell).toBe(before.counts['2014'].spell + 1);

    const delta = (await app.inject({ method: 'GET', url: `/api/rules/catalog/entities?since=${before.catalogVersion}&type=spell` })).json();
    const entry = delta.entities.find((e: { id: string }) => e.id === entity.id);
    expect(entry).toMatchObject({ slug: slug('fireball'), revisionNumber: 1, summary: '3rd-level evocation' });
  });

  it('rejects duplicate slugs and never publishes invalid data', async () => {
    const base = { entityType: 'monster', ruleset: '2014', sourceLicense: 'homebrew' };
    const invalid = await create({ ...base, slug: slug('bad-goblin'), data: { ...named(goblin2014, 'bad'), xp: 9999 } });
    expect(invalid.statusCode).toBe(201);
    expect((await create({ ...base, slug: slug('bad-goblin'), data: goblin2014 })).json().code).toBe('slug_conflict');

    const id = invalid.json().id;
    const validation = await post(id, 'validate', { expectedRevisionNumber: 1 });
    expect(validation.json()).toMatchObject({ valid: false, entity: { headStatus: 'draft' } });
    expect(validation.json().issues.map((i: { path: unknown[] }) => i.path.join('.'))).toContain('xp');

    const publish = await post(id, 'publish', { expectedRevisionNumber: 1 });
    expect(publish.statusCode).toBe(409);
    expect(publish.json().code).toBe('invalid_state');

    const preview = await app.inject({ method: 'GET', url: `/api/admin/rules/entities/${id}/preview` });
    expect(preview.statusCode).toBe(422);

    const catalog = (await app.inject({ method: 'GET', url: '/api/rules/catalog/entities?type=monster&ruleset=2014' })).json();
    expect(catalog.entities.some((e: { id: string }) => e.id === id)).toBe(false);
  });

  it('returns 409 with the current head on a stale update, never last-write-wins', async () => {
    const created = await create({ entityType: 'spell', ruleset: '2024', slug: slug('shield'), data: named(shield2024, 'shield'), sourceLicense: 'CC-BY-4.0' });
    const id = created.json().id;

    const first = await saveDraft(id, { expectedRevisionNumber: 1, data: { ...named(shield2024, 'shield'), level: 2 } });
    expect(first.statusCode).toBe(200);
    expect(first.headers.etag).toBe('"2"');

    const stale = await saveDraft(id, { expectedRevisionNumber: 1, data: { ...shield2024, level: 3 } });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: 'revision_conflict', current: { revisionNumber: 2, data: { level: 2 } } });

    const staleHeader = await saveDraft(id, { data: shield2024 }, { ...actor, 'if-match': '"1"' });
    expect(staleHeader.statusCode).toBe(409);
    expect((await saveDraft(id, { data: shield2024 })).statusCode).toBe(400);

    const viaHeader = await saveDraft(id, { data: named(shield2024, 'shield') }, { ...actor, 'if-match': '"2"' });
    expect(viaHeader.statusCode).toBe(200);
    expect(viaHeader.json().revisions.map((r: { status: string }) => r.status)).toEqual(['draft', 'superseded', 'superseded']);

    const racing = await Promise.all([
      saveDraft(id, { expectedRevisionNumber: 3, data: { ...named(shield2024, 'shield'), level: 4 } }),
      saveDraft(id, { expectedRevisionNumber: 3, data: { ...named(shield2024, 'shield'), level: 5 } }),
    ]);
    expect(racing.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });

  it('keeps drafts out of the catalog and rolls back by publishing a new revision', async () => {
    const original = named(fireball2014, 'rollback');
    const { id, catalogVersion: v1 } = await publishNew('spell', '2014', 'rollback', original);
    const catalogUrl = `/api/rules/catalog/entities?since=${v1 - 1}&type=spell&ruleset=2014`;
    const catalogEntry = async () =>
      (await app.inject({ method: 'GET', url: catalogUrl })).json().entities.find((e: { id: string }) => e.id === id);

    const edited = { ...original, level: 4, higherLevel: undefined };
    expect((await saveDraft(id, { expectedRevisionNumber: 1, data: edited })).statusCode).toBe(200);
    expect((await catalogEntry()).data.level).toBe(3);

    await post(id, 'validate', { expectedRevisionNumber: 2 });
    const published = await post(id, 'publish', { expectedRevisionNumber: 2 });
    const v2 = published.json().catalogVersion;
    expect(v2).toBeGreaterThan(v1);
    expect((await catalogEntry()).data.level).toBe(4);

    const diff = await app.inject({ method: 'GET', url: `/api/admin/rules/entities/${id}/diff?from=1&to=2` });
    expect(diff.json().operations).toEqual(
      expect.arrayContaining([
        { op: 'replace', path: '/level', value: 4 },
        { op: 'remove', path: '/higherLevel' },
      ]),
    );

    const notPublished = await saveDraft(id, { expectedRevisionNumber: 2, data: edited });
    expect(notPublished.statusCode).toBe(200);
    expect((await post(id, 'rollback', { expectedRevisionNumber: 3, targetRevisionNumber: 3 })).json().code).toBe('invalid_state');

    const rollback = await post(id, 'rollback', { expectedRevisionNumber: 3, targetRevisionNumber: 1 });
    expect(rollback.statusCode).toBe(200);
    const restored = rollback.json();
    expect(restored.catalogVersion).toBeGreaterThan(v2);
    expect(restored.entity.head).toMatchObject({
      revisionNumber: 4,
      status: 'published',
      restoredFromRevisionNumber: 1,
      data: original,
    });
    expect(restored.entity.revisions.map((r: { revisionNumber: number; status: string }) => [r.revisionNumber, r.status])).toEqual([
      [4, 'published'],
      [3, 'superseded'],
      [2, 'superseded'],
      [1, 'superseded'],
    ]);
    expect((await catalogEntry())).toMatchObject({ revisionNumber: 4, data: { level: 3 } });

    const rev1 = await app.inject({ method: 'GET', url: `/api/admin/rules/entities/${id}/revisions/1` });
    const rev2 = await app.inject({ method: 'GET', url: `/api/admin/rules/entities/${id}/revisions/2` });
    expect(rev1.json()).toMatchObject({ data: original, publishedBy: 'admin-1', catalogVersion: v1 });
    expect(rev2.json()).toMatchObject({ data: { level: 4 }, catalogVersion: v2 });
  });

  it('validates cross-references within the same ruleset', async () => {
    const spell = named(fireball2014, 'ref');
    const monster = {
      ...named(goblin2014, 'caster'),
      spellcasting: [
        { name: 'Spellcasting', ability: 'int', description: 'Casts spells.', spells: [{ ref: slug('ref-spell') }] },
      ],
    };
    const created = await create({ entityType: 'monster', ruleset: '2014', slug: slug('caster'), data: monster, sourceLicense: 'homebrew' });
    const id = created.json().id;
    const unresolved = (await post(id, 'validate', { expectedRevisionNumber: 1 })).json();
    expect(unresolved.valid).toBe(false);
    expect(unresolved.issues[0]).toMatchObject({ code: 'unresolved_reference', path: ['spellcasting', 0, 'spells', 0, 'ref'] });

    await publishNew('spell', '2014', 'ref-spell', spell);
    expect((await post(id, 'validate', { expectedRevisionNumber: 1 })).json().valid).toBe(true);

    const monster2024 = { ...monster, ruleset: '2024', type: 'fey' };
    const other = await create({ entityType: 'monster', ruleset: '2024', slug: slug('caster'), data: monster2024, sourceLicense: 'homebrew' });
    const incompatible = (await post(other.json().id, 'validate', { expectedRevisionNumber: 1 })).json();
    expect(incompatible.issues[0].code).toBe('ruleset_incompatible_reference');

    const mismatch = await create({ entityType: 'spell', ruleset: '2024', slug: slug('mismatch'), data: spell, sourceLicense: 'homebrew' });
    expect((await post(mismatch.json().id, 'validate', { expectedRevisionNumber: 1 })).json().issues[0].code).toBe('ruleset_mismatch');

    const duplicate = await create({ entityType: 'spell', ruleset: '2014', slug: slug('ref-spell-copy'), data: spell, sourceLicense: 'homebrew' });
    expect((await post(duplicate.json().id, 'validate', { expectedRevisionNumber: 1 })).json().issues[0].code).toBe('duplicate_name');
  });

  it('archives with a catalog tombstone and blocks edits until unarchived', async () => {
    const { id, catalogVersion } = await publishNew('spell', '2024', 'archived', named(shield2024, 'archived'));
    const archived = await post(id, 'archive');
    expect(archived.statusCode).toBe(200);
    expect(archived.json().archivedAt).not.toBeNull();

    const delta = (await app.inject({ method: 'GET', url: `/api/rules/catalog/entities?since=${catalogVersion}` })).json();
    expect(delta.removed).toEqual(expect.arrayContaining([expect.objectContaining({ id, slug: slug('archived') })]));
    const full = (await app.inject({ method: 'GET', url: '/api/rules/catalog/entities?ruleset=2024&type=spell' })).json();
    expect(full.entities.some((e: { id: string }) => e.id === id)).toBe(false);

    expect((await saveDraft(id, { expectedRevisionNumber: 1, data: shield2024 })).json().code).toBe('entity_archived');
    expect((await post(id, 'archive')).json().code).toBe('invalid_state');
    expect((await post(id, 'unarchive')).statusCode).toBe(200);
  });

  it('previews the normalized consumer shape', async () => {
    const created = await create({ entityType: 'monster', ruleset: '2014', slug: slug('preview'), data: named(goblin2014, 'preview'), sourceLicense: 'CC-BY-4.0' });
    const preview = await app.inject({ method: 'GET', url: `/api/admin/rules/entities/${created.json().id}/preview` });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      revisionNumber: 1,
      status: 'draft',
      entity: { catalogVersion: null, publishedAt: null, data: { reactions: [], savingThrows: {} } },
    });
    expect(preview.json().entity.summary).toContain('CR 1/4 (50 XP)');
  });

  it('serves catalog reads with ETags and 304s', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/rules/catalog/manifest' });
    expect(first.headers.etag).toBe(first.json().etag);
    const cached = await app.inject({ method: 'GET', url: '/api/rules/catalog/manifest', headers: { 'if-none-match': first.headers.etag as string } });
    expect(cached.statusCode).toBe(304);

    const entities = await app.inject({ method: 'GET', url: '/api/rules/catalog/entities?type=item' });
    const again = await app.inject({ method: 'GET', url: '/api/rules/catalog/entities?type=item', headers: { 'if-none-match': entities.headers.etag as string } });
    expect(again.statusCode).toBe(304);
    expect((await app.inject({ method: 'GET', url: '/api/rules/catalog/entities?type=class' })).statusCode).toBe(400);
  });

  it('skips a stored revision that no longer satisfies the contract instead of failing the catalog', async () => {
    const entity = await prisma.rulesEntity.create({
      data: { entityType: 'spell', ruleset: '2014', slug: slug('stale'), schemaVersion: 1, headRevisionNumber: 1 },
    });
    const now = new Date();
    const revision = await prisma.rulesEntityRevision.create({
      data: {
        entityId: entity.id,
        revisionNumber: 1,
        status: 'published',
        schemaVersion: 1,
        data: { ...named(fireball2014, 'stale'), retiredField: true },
        sourceLicense: 'homebrew',
        createdBy: 'legacy',
        publishedBy: 'legacy',
        publishedAt: now,
        catalogVersion: 1,
      },
    });
    await prisma.rulesEntity.update({ where: { id: entity.id }, data: { currentPublishedRevisionId: revision.id, catalogVersion: 1 } });

    const response = await app.inject({ method: 'GET', url: '/api/rules/catalog/entities?type=spell&ruleset=2014' });
    expect(response.statusCode).toBe(200);
    expect(response.json().skipped).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: entity.id, revisionId: revision.id })]),
    );
    expect(response.json().entities.some((e: { id: string }) => e.id === entity.id)).toBe(false);
  });

  it('database guard rejects in-place edits of published revisions when the migration is applied', async () => {
    const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger WHERE tgname = 'rules_entity_revisions_guard'
    `;
    if (triggers.length === 0) return; // schema created by `prisma db push`
    const { id } = await publishNew('spell', '2014', 'trigger', named(fireball2014, 'trigger'));
    await expect(
      prisma.rulesEntityRevision.update({
        where: { entityId_revisionNumber: { entityId: id, revisionNumber: 1 } },
        data: { data: { tampered: true } },
      }),
    ).rejects.toThrow(/immutable/);
    await expect(prisma.rulesEntity.delete({ where: { id } })).rejects.toThrow();
  });
});

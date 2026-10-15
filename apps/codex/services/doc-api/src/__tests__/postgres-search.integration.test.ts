import { randomUUID } from 'node:crypto';
import { prisma } from '../services/database.service';
import { PostgresSearchProvider } from '../services/search/postgres-provider';
import { loggingService } from '../services/logging.service';

// Requires a database migrated with `prisma migrate deploy` (triggers, GIN
// indexes and pg_trgm come from the add_postgres_search_and_log_events migration).
describe('Postgres search provider', () => {
  const provider = new PostgresSearchProvider();
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  async function createDocument(key: string, data: Partial<{
    title: string;
    description: string;
    tags: string[];
    campaigns: string[];
    type: 'rulebook' | 'handout' | 'srd_content';
    uploadedAt: Date;
  }>) {
    const doc = await prisma.document.create({
      data: {
        title: data.title ?? key,
        description: data.description ?? '',
        type: data.type ?? 'rulebook',
        format: 'pdf',
        storageKey: `test/${run}/${key}.pdf`,
        fileSize: 100,
        uploadedBy: `search-test-${run}`,
        tags: data.tags ?? [],
        campaigns: data.campaigns ?? [],
        ...(data.uploadedAt ? { uploadedAt: data.uploadedAt } : {}),
      },
    });
    ids[key] = doc.id;
    return doc;
  }

  async function addChunk(key: string, content: string, index = 0) {
    await prisma.documentChunk.create({
      data: {
        documentId: ids[key],
        chunkIndex: index,
        source: 'pdf_extraction',
        chunkHash: `${run}-${key}-${index}`,
        content,
      },
    });
  }

  const scoped = { uploadedBy: `search-test-${run}` };

  beforeAll(async () => {
    await createDocument('strahd', {
      title: `Curse of Strahd ${run}`,
      description: 'Gothic horror campaign',
      tags: ['horror', 'campaign'],
      campaigns: ['ravenloft'],
      uploadedAt: new Date('2026-01-01'),
    });
    await createDocument('dragons', {
      title: `Monster Manual ${run}`,
      description: 'Creatures and beasts',
      tags: ['monsters'],
      campaigns: ['core'],
      uploadedAt: new Date('2026-02-01'),
    });
    await createDocument('handout', {
      title: `Player Handout ${run}`,
      description: 'A map of the village with a dragon warning',
      type: 'handout',
      uploadedAt: new Date('2026-03-01'),
    });
    await createDocument('dragonTitle', {
      title: `Dragon Compendium ${run}`,
      uploadedAt: new Date('2026-01-15'),
    });
    await addChunk('strahd', 'The vampire lord rules the valley of Barovia from Castle Ravenloft.');
    await addChunk('strahd', 'A fireball lights the crypt while the party flees the vampire spawn.', 1);
    await addChunk('dragons', 'An adult red dragon breathes fire in a 60-foot cone, much like a fireball.');
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { uploadedBy: `search-test-${run}` } });
    await prisma.logEvent.deleteMany({ where: { service: `search-test-${run}` } });
    await prisma.$disconnect();
  });

  it('finds a document through extracted text and highlights the match', async () => {
    const result = await provider.search({ query: 'Barovia', filters: scoped });
    const hit = result.hits.find((h) => h.documentId === ids.strahd);
    expect(hit).toBeDefined();
    expect(hit?.highlights?.content?.[0]).toContain('<em>Barovia</em>');
    expect(hit?.source.title).toBe(`Curse of Strahd ${run}`);
  });

  it('ORs terms and prefers documents matching more of them', async () => {
    const result = await provider.advancedSearch({ query: 'vampire fireball dragon', filters: scoped });
    const order = result.hits.map((h) => h.documentId);
    expect(order).toEqual(expect.arrayContaining([ids.strahd, ids.dragons, ids.handout]));

    // "vampire fireball": Curse of Strahd matches both terms, the Monster Manual one.
    const narrower = await provider.advancedSearch({ query: 'vampire fireball', filters: scoped });
    const ranked = narrower.hits.map((h) => h.documentId);
    expect(ranked.indexOf(ids.strahd)).toBeLessThan(ranked.indexOf(ids.dragons));
  });

  it('ranks a title match above a text-only match', async () => {
    const result = await provider.advancedSearch({ query: 'dragon', filters: scoped });
    const order = result.hits.map((h) => h.documentId);
    // The Monster Manual only mentions dragons in its text.
    expect(order.indexOf(ids.dragonTitle)).toBeLessThan(order.indexOf(ids.dragons));
  });

  it('tolerates a typo in the title through trigram similarity', async () => {
    const result = await provider.advancedSearch({ query: `Curse of Strahdd ${run}`, filters: scoped });
    expect(result.hits.map((h) => h.documentId)).toContain(ids.strahd);
  });

  it('applies type, tag, campaign and date filters', async () => {
    const byType = await provider.advancedSearch({ query: 'dragon', filters: { ...scoped, type: 'handout' } });
    expect(byType.hits.map((h) => h.documentId)).toEqual([ids.handout]);

    const byTag = await provider.advancedSearch({ query: 'fireball', filters: { ...scoped, tags: ['monsters'] } });
    expect(byTag.hits.map((h) => h.documentId)).toEqual([ids.dragons]);

    const byCampaign = await provider.advancedSearch({
      query: 'fireball',
      filters: { ...scoped, campaigns: ['ravenloft'] },
    });
    expect(byCampaign.hits.map((h) => h.documentId)).toEqual([ids.strahd]);

    const byDate = await provider.advancedSearch({
      query: 'dragon',
      filters: { ...scoped, uploadedAfter: new Date('2026-02-15') },
    });
    expect(byDate.hits.map((h) => h.documentId)).toEqual([ids.handout]);
  });

  it('paginates with a stable total', async () => {
    const first = await provider.advancedSearch({
      query: 'dragon fireball vampire',
      filters: scoped,
      size: 2,
      from: 0,
    });
    const second = await provider.advancedSearch({
      query: 'dragon fireball vampire',
      filters: scoped,
      size: 2,
      from: 2,
    });
    expect(first.total).toBe(4);
    expect(first.hits).toHaveLength(2);
    expect(second.hits).toHaveLength(2);
  });

  it('sorts by upload date when asked and lists everything for an empty query', async () => {
    const result = await provider.advancedSearch({
      query: '',
      filters: scoped,
      sortBy: 'uploadedAt',
      sortOrder: 'asc',
    });
    expect(result.hits.map((h) => h.documentId)).toEqual([ids.strahd, ids.dragonTitle, ids.dragons, ids.handout]);
  });

  it('searches within one document only', async () => {
    const result = await provider.searchWithinDocument({ documentId: ids.dragons, query: 'fireball' });
    expect(result.hits.map((h) => h.documentId)).toEqual([ids.dragons]);
  });

  it('indexes SRD entries from structured_data', async () => {
    const srd = await createDocument('srd', { title: `Fireball ${run}`, type: 'srd_content' });
    await prisma.structuredData.create({
      data: {
        documentId: srd.id,
        type: 'spell',
        name: `Fireball ${run}`,
        data: {},
        searchText: 'A bright streak flashes from your pointing finger and blossoms into an explosion of flame',
      },
    });
    const result = await provider.search({ query: 'explosion flame' });
    const hit = result.hits.find((h) => h.documentId === srd.id);
    expect(hit).toBeDefined();
    expect(hit?.highlights?.content?.[0]).toContain('<em>explosion</em>');
  });

  it('keeps search current when a title changes', async () => {
    await prisma.document.update({ where: { id: ids.handout }, data: { title: `Cartographer Notes ${run}` } });
    const result = await provider.advancedSearch({ query: 'Cartographer', filters: scoped });
    expect(result.hits.map((h) => h.documentId)).toEqual([ids.handout]);
  });

  it('reports whether a document is searchable', async () => {
    expect(await provider.documentExists(ids.strahd)).toBe(true);
    expect(await provider.documentExists(randomUUID())).toBe(false);
  });

  it('does not let query text inject tsquery syntax', async () => {
    await expect(provider.search({ query: "'; DROP TABLE documents; -- & | ! ( )" })).resolves.toBeDefined();
    await expect(provider.search({ query: 'the and of' })).resolves.toBeDefined();
  });
});

describe('log_events', () => {
  const service = `search-test-${randomUUID().slice(0, 8)}`;

  afterAll(async () => {
    await prisma.logEvent.deleteMany({ where: { service } });
  });

  it('stores logs and finds them by service, level, text and job', async () => {
    const jobId = randomUUID();
    await prisma.logEvent.createMany({
      data: [
        { service, level: 'info', message: 'Starting extraction for rulebook', jobId, meta: { jobId, stage: 'ingest' } },
        { service, level: 'error', message: 'OCR failed on page 12', jobId, meta: { jobId } },
        { service, level: 'info', message: 'Unrelated message' },
      ],
    });

    const errors = await loggingService.search({ services: [service], levels: ['error'] });
    expect(errors.total).toBe(1);
    expect(errors.hits[0].message).toBe('OCR failed on page 12');

    const text = await loggingService.search({ services: [service], query: 'ocr page' });
    expect(text.hits.map((hit) => hit.message)).toEqual(['OCR failed on page 12']);

    const jobLogs = await loggingService.getLogs(jobId);
    expect(jobLogs.map((entry) => entry.level)).toEqual(['info', 'error']);
  });

  it('prunes rows older than the retention window', async () => {
    await prisma.logEvent.create({
      data: { service, level: 'info', message: 'ancient', timestamp: new Date('2020-01-01') },
    });
    const removed = await loggingService.pruneOldLogs(30);
    expect(removed).toBeGreaterThanOrEqual(1);
    const remaining = await prisma.logEvent.count({ where: { service, message: 'ancient' } });
    expect(remaining).toBe(0);
  });
});

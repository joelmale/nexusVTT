import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * v2 extract stage end to end: fixture DocumentPage rows -> candidates ->
 * Ollama (hand-written /api/chat fixtures) -> validation -> StructuredData.
 */

const db = vi.hoisted(() => ({ pages: [] as any[], rows: [] as any[], deletes: 0 }));
const cache = vi.hoisted(() => new Map<string, Buffer>());
const handoff = vi.hoisted(() => ({ layoutUnloads: 0 }));

vi.mock('../../services/database.service', () => ({
  prisma: {
    documentPage: { findMany: vi.fn(async () => db.pages) },
    structuredData: {
      deleteMany: vi.fn(async () => {
        db.deletes += 1;
        db.rows = [];
      }),
      createMany: vi.fn(async ({ data }: any) => {
        db.rows.push(...data);
      }),
    },
  },
}));
vi.mock('../../services/s3.service', () => ({
  s3Service: {
    downloadFile: vi.fn(async () => Buffer.from('%PDF')),
    downloadFileIfExists: vi.fn(async (key: string) => cache.get(key) ?? null),
    uploadFile: vi.fn(async (key: string, body: Buffer) => {
      cache.set(key, body);
    }),
  },
}));
vi.mock('../../services/logging.service', () => ({
  loggingService: { logInfo: vi.fn(async () => {}), logWarn: vi.fn(async () => {}) },
}));
vi.mock('../../services/entity-resolver.service', () => ({
  entityResolverService: { resolveEntity: vi.fn(async ({ name }: { name: string }) => `entity-${name}`) },
}));
vi.mock('../../services/entity-linking.service', () => ({
  entityLinkingService: { linkSpellMentions: vi.fn(async () => {}) },
}));
vi.mock('../../services/layout-client.service', () => ({
  layoutClientService: {
    unloadModels: vi.fn(async () => {
      handoff.layoutUnloads += 1;
      return true;
    }),
  },
}));
vi.mock('../../services/monster-crop.service', () => ({
  monsterCropService: {
    cropRegions: vi.fn(async (_pdf: Buffer, regions: Map<string, unknown[]>) =>
      new Map([...regions.keys()].map((key) => [key, [Buffer.from(`crop:${key}`)]]))
    ),
  },
}));

import { env } from '../../config/env';
import { entityLinkingService } from '../../services/entity-linking.service';
import { runExtractStage } from '../extract-stage';
import { SRD_PAGES } from '../../extraction/__tests__/fixtures/pages';

const recorded = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '../../extraction/__tests__/fixtures/ollama', name), 'utf8'));

/** Routes each Ollama call to a fixture by the entity type named in the system prompt. */
const mockOllama = (monsterFixture = 'monster-gorgon.json') => {
  const calls: any[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: any) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (url.endsWith('/api/generate')) return { ok: true, json: async () => ({}) };
    const system: string = body.messages[0].content;
    const name = system.includes('stat blocks') ? monsterFixture : system.includes('spell') ? 'spell-fireball.json' : 'item-bag-of-holding.json';
    return { ok: true, json: async () => recorded(name) };
  }) as any;
  return calls;
};

const document = { id: 'doc-1', format: 'pdf', storageKey: 'uploads/mm.pdf', contentHash: 'hash-a' };

describe('runExtractStage (v2)', () => {
  beforeEach(() => {
    db.pages = SRD_PAGES.map((page) => ({ pageNumber: page.pageNumber, markdown: page.markdown, blocks: page.blocks }));
    db.rows = [];
    db.deletes = 0;
    cache.clear();
    handoff.layoutUnloads = 0;
    (env as any).GPU_HANDOFF = true;
    vi.mocked(entityLinkingService.linkSpellMentions).mockClear();
  });

  it('persists validated entities with review, source and page numbers', async () => {
    const calls = mockOllama();
    const result = await runExtractStage('job-1', document);

    expect(result.counts).toEqual({ spell: 1, monster: 1, item: 1 });
    expect(result.needsReview).toBe(0);
    expect(db.rows.map((r) => [r.type, r.name, r.pageNumber, r.entityId])).toEqual([
      ['monster', 'Gorgon', 12, 'entity-Gorgon'],
      ['spell', 'Fireball', 13, 'entity-Fireball'],
      ['item', 'Bag of Holding', 13, 'entity-Bag of Holding'],
    ]);

    const gorgon = db.rows[0].data;
    expect(gorgon.review).toMatchObject({ status: 'auto', reasons: [] });
    expect(gorgon.source).toMatchObject({
      pageNumber: 12,
      blockIds: ['p12-b4', 'p12-b5', 'p13-b1', 'p13-b2'],
      bbox: [0.52, 0.06, 0.94, 0.5],
      model: env.VLM_MODEL,
      promptVersion: env.EXTRACT_PROMPT_VERSION,
    });
    expect(gorgon.source.regions).toHaveLength(2);
    expect(gorgon).toMatchObject({ armorClass: 19, hitPoints: 114, needsReview: false });

    // Monsters get the crop; spells and items are text only.
    const chats = calls.filter((c) => c.url.endsWith('/api/chat'));
    expect(chats[0].body.messages[1].images).toEqual([Buffer.from('crop:monster:p12:p12-b4').toString('base64')]);
    expect(chats[1].body.messages[1].images).toBeUndefined();
    expect(entityLinkingService.linkSpellMentions).toHaveBeenCalledOnce();
  });

  it('hands the GPU over: layout models unloaded before, VLM unloaded after', async () => {
    const calls = mockOllama();
    await runExtractStage('job-1', document);
    expect(handoff.layoutUnloads).toBe(1);
    expect(calls[calls.length - 1]).toMatchObject({ url: expect.stringContaining('/api/generate'), body: { keep_alive: 0 } });
  });

  it('flags invented numbers for review instead of trusting them', async () => {
    mockOllama('monster-gorgon-invented.json');
    const result = await runExtractStage('job-1', document);
    const gorgon = db.rows.find((r) => r.name === 'Gorgon').data;
    expect(gorgon.review.status).toBe('needs_review');
    expect(gorgon.review.reasons).toContain('ungrounded:hitPoints=126');
    expect(gorgon.needsReview).toBe(true);
    expect(result.needsReview).toBe(1);
  });

  it('a retry reuses cached responses and replaces rows instead of duplicating them', async () => {
    const calls = mockOllama();
    await runExtractStage('job-1', document);
    const first = calls.filter((c) => c.url.endsWith('/api/chat')).length;

    const result = await runExtractStage('job-2', document);
    expect(calls.filter((c) => c.url.endsWith('/api/chat')).length).toBe(first);
    expect(result.cachedCalls).toBe(3);
    expect(db.rows).toHaveLength(3);
    expect(db.deletes).toBe(2);
  });

  it('keeps a schema-invalid candidate visible as needs_review', async () => {
    globalThis.fetch = vi.fn(async (url: string) =>
      url.endsWith('/api/generate')
        ? { ok: true, json: async () => ({}) }
        : { ok: true, json: async () => recorded('spell-schema-invalid.json') }
    ) as any;
    await runExtractStage('job-1', document);
    expect(db.rows.map((r) => [r.name, r.data.review.reasons, r.entityId])).toEqual([
      ['Gorgon', ['schema_invalid'], undefined],
      ['Fireball', ['schema_invalid'], undefined],
      ['Bag of Holding', ['schema_invalid'], undefined],
    ]);
  });

  it('fails the stage when Ollama is unreachable, still unloading the VLM', async () => {
    const generate = vi.fn(async () => ({ ok: true }));
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/generate')) return generate();
      throw new Error('connect ECONNREFUSED ollama:11434');
    }) as any;
    await expect(runExtractStage('job-1', document)).rejects.toThrow('ECONNREFUSED');
    expect(generate).toHaveBeenCalledOnce();
    expect(db.deletes).toBe(0); // previous rows untouched
  });
});

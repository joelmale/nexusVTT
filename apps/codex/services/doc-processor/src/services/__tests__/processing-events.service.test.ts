import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  runs: [] as Array<{ runId: string; _max: { id: bigint } }>,
  deleted: [] as string[][],
  created: [] as any[],
  failCreate: false,
}));

vi.mock('../database.service', () => ({
  prisma: {
    processingEvent: {
      groupBy: vi.fn(async () => db.runs),
      deleteMany: vi.fn(async ({ where }: any) => {
        db.deleted.push(where.runId.in);
      }),
      createMany: vi.fn(async ({ data }: any) => {
        if (db.failCreate) throw new Error('db down');
        db.created.push(...data);
      }),
    },
  },
}));

import {
  candidateEvents,
  describePageLayout,
  describePageMarkdown,
  describeQuality,
  estimateColumns,
  ProcessingEventsService,
} from '../processing-events.service';
import { LayoutPage } from '../../types/layout';

const page: LayoutPage = {
  pageNumber: 12,
  markdown: '## Gorgon\n\nArmor Class 19',
  quality: { wordCount: 412, wordValidity: 0.964 },
  blocks: [
    { id: 'p12-b0', class: 'furniture', markerType: 'PageHeader', bbox: [0.05, 0.01, 0.95, 0.03] },
    { id: 'p12-b1', class: 'body', markerType: 'Text', bbox: [0.06, 0.1, 0.45, 0.6], markdown: 'left' },
    { id: 'p12-b2', class: 'body', markerType: 'Text', bbox: [0.52, 0.1, 0.94, 0.5], markdown: 'right' },
    { id: 'p12-b3', class: 'art', markerType: 'Picture', bbox: [0.06, 0.62, 0.45, 0.95] },
    { id: 'p12-b4', class: 'sidebar', markerType: 'Text', bbox: [0.52, 0.6, 0.94, 0.8], markdown: 'box' },
  ],
};

describe('Action Feed sentences', () => {
  it('describes a page layout', () => {
    expect(estimateColumns(page)).toBe(2);
    expect(describePageLayout(page)).toBe(
      'Page 12: two-column layout, 3 text blocks, 1 sidebar (heuristic), 1 art region excluded, 1 header/footer excluded'
    );
  });

  it('describes page markdown with text cleanliness', () => {
    expect(describePageMarkdown(page)).toBe('Page 12 Markdown: 412 words, text cleanliness 96.4%');
  });

  it('summarizes document quality and lists pages to check', () => {
    const quality = describeQuality([
      { pageNumber: 1, wordValidity: 0.98 },
      { pageNumber: 2, wordValidity: 0.8 },
      { pageNumber: 3 },
    ]);
    expect(quality).toEqual({
      message: 'Text cleanliness 89.0% average over 2 pages; 1 below 90.0%: p. 2',
      average: 0.89,
      lowPages: [2],
    });
  });

  const candidate = {
    key: 'monster:p12:p12-b4',
    type: 'monster' as const,
    title: 'Gorgon',
    pageNumber: 12,
    regions: [{ pageNumber: 12, blockIds: ['p12-b4'], bbox: [0.52, 0.06, 0.94, 0.5] as [number, number, number, number] }],
    blockIds: ['p12-b4'],
    markdown: '',
    blockHash: 'h',
  };
  const gorgon = {
    name: 'Gorgon', size: 'Large', type: 'monstrosity', alignment: 'unaligned', armorClass: 19, hitPoints: 114,
    speed: '40 ft.', abilities: { str: 20, dex: 11, con: 18, int: 2, wis: 12, cha: 7 }, challengeRating: '5 (1,800 XP)',
    traits: [{ name: 'Trample', description: '' }], actions: [{ name: 'Gore', description: '' }],
  };

  it('describes an extracted entity with its card summary and source', () => {
    const [event] = candidateEvents(
      { candidate, cached: false, parseFailed: false, entities: [{ name: 'Gorgon', entity: gorgon, review: { status: 'auto', confidence: 0.95, reasons: [], baseline: 'agrees' } }] },
      'qwen2.5vl:7b'
    );
    expect(event.kind).toBe('entity_extracted');
    expect(event.message).toBe('qwen2.5vl:7b: extracted Gorgon (AC 19, HP 114, CR 5), all values grounded');
    expect(event.payload).toMatchObject({
      type: 'monster',
      summary: { armorClass: 19, hitPoints: 114, actions: ['Gore'], abilities: { str: 20 } },
      source: { pageNumber: 12, candidateKey: 'monster:p12:p12-b4' },
    });
  });

  it('names review reasons and rejections', () => {
    const [review] = candidateEvents(
      { candidate, cached: true, parseFailed: false, entities: [{ name: 'Gorgon', entity: gorgon, review: { status: 'needs_review', confidence: 0.3, reasons: ['ungrounded:hitPoints=126'], baseline: 'not_found' } }] },
      'm'
    );
    expect(review.message).toBe('m (cached): extracted Gorgon (AC 19, HP 114, CR 5), needs review (ungrounded:hitPoints=126)');
    const [rejected] = candidateEvents({ candidate, cached: false, parseFailed: true, entities: [] }, 'm');
    expect(rejected).toMatchObject({ kind: 'entity_rejected', message: 'm: no valid monster in "Gorgon" (p. 12), response failed the schema' });
  });
});

describe('ProcessingEventsService', () => {
  beforeEach(() => {
    db.runs = [];
    db.deleted = [];
    db.created = [];
    db.failCreate = false;
  });

  it('startRun keeps the two newest earlier runs (three with the new one)', async () => {
    db.runs = [
      { runId: 'r1', _max: { id: 10n } },
      { runId: 'r4', _max: { id: 40n } },
      { runId: 'r2', _max: { id: 20n } },
      { runId: 'r3', _max: { id: 30n } },
    ];
    const runId = await new ProcessingEventsService().startRun('doc-1');
    expect(runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(db.deleted).toEqual([['r2', 'r1']]);
  });

  it('emit never throws (events must not fail a stage)', async () => {
    db.failCreate = true;
    await expect(
      new ProcessingEventsService().emit({ documentId: 'd', runId: 'r', stage: 'layout', kind: 'quality', message: 'x' })
    ).resolves.toBeUndefined();
  });
});

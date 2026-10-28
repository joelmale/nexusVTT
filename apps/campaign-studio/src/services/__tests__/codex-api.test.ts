import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DOCUMENT_TYPES,
  DEFAULT_TAGS,
  getAvailableTags,
  getDocument,
  getDocumentContent,
  getDocumentTypes,
  getStructuredData,
  listDocuments,
  searchDocuments,
  searchStructuredData,
} from '../codex-api';

describe('codex-api service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('searchDocuments (CS-68)', () => {
    it('returns empty result without fetching if query and term are empty', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const result = await searchDocuments({});
      expect(result).toEqual({ documents: [], total: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends query and size to /api/search/quick and normalizes QuickSearchResults', async () => {
      let requestedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: 'dragon',
              results: [
                {
                  documentId: 'doc-123',
                  title: 'Red Dragon Lore',
                  snippet: 'A fierce fire-breathing creature.',
                  type: 'rulebook',
                  score: 0.95,
                },
              ],
            }),
        } as Response);
      });

      const result = await searchDocuments({ term: 'dragon', limit: 10, type: 'rulebook' });

      expect(requestedUrl).toContain('/api/search/quick?');
      expect(requestedUrl).toContain('query=dragon');
      expect(requestedUrl).toContain('size=10');
      expect(requestedUrl).toContain('type=rulebook');
      expect(result.total).toBe(1);
      expect(result.documents[0]).toMatchObject({
        id: 'doc-123',
        title: 'Red Dragon Lore',
        description: 'A fierce fire-breathing creature.',
        type: 'rulebook',
        tags: [],
        uploadedBy: 'system',
      });
    });

    it('accepts query and size directly in params', async () => {
      let requestedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: 'goblin',
              results: [],
            }),
        } as Response);
      });

      const result = await searchDocuments({ query: 'goblin', size: 5, tags: ['srd', 'monster'] });
      expect(requestedUrl).toContain('query=goblin');
      expect(requestedUrl).toContain('size=5');
      expect(requestedUrl).toContain('tags=srd');
      expect(requestedUrl).toContain('tags=monster');
      expect(result).toEqual({ documents: [], total: 0 });
    });

    it('normalizes responses that already have { documents, total }', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total: 1,
            documents: [
              {
                id: 'doc-abc',
                title: 'Existing Format',
                tags: ['tag1'],
              },
            ],
          }),
      } as Response);

      const result = await searchDocuments({ term: 'test' });
      expect(result.total).toBe(1);
      expect(result.documents[0].id).toBe('doc-abc');
      expect(result.documents[0].tags).toEqual(['tag1']);
    });

    it('handles raw array responses and non-record responses gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 'doc-raw', title: 'Raw Item' },
          ]),
      } as Response);

      const result = await searchDocuments({ query: 'raw' });
      expect(result.total).toBe(1);
      expect(result.documents[0].id).toBe('doc-raw');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve('bad-data'),
      } as Response);
      const badResult = await searchDocuments({ query: 'bad' });
      expect(badResult).toEqual({ documents: [], total: 0 });
    });

    it('throws error when search request fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(searchDocuments({ term: 'fail' })).rejects.toThrow('Search failed: Bad Request');
    });
  });

  describe('listDocuments', () => {
    it('queries /api/documents with filter parameters', async () => {
      let requestedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              documents: [{ id: 'doc-list-1', title: 'Doc 1', type: 'supplement', tags: ['dnd'] }],
              total: 1,
            }),
        } as Response);
      });

      const res = await listDocuments({
        type: 'supplement',
        tag: 'dnd',
        campaign: 'c1',
        search: 'rules',
        limit: 25,
        offset: 5,
      });

      expect(requestedUrl).toContain('/api/documents?');
      expect(requestedUrl).toContain('type=supplement');
      expect(requestedUrl).toContain('tag=dnd');
      expect(requestedUrl).toContain('campaign=c1');
      expect(requestedUrl).toContain('search=rules');
      expect(requestedUrl).toContain('limit=25');
      expect(requestedUrl).toContain('offset=5');
      expect(res.documents[0].id).toBe('doc-list-1');
    });

    it('throws when listDocuments fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
      } as Response);

      await expect(listDocuments()).rejects.toThrow('Failed to list documents: Internal Error');
    });
  });

  describe('getDocument & getDocumentContent', () => {
    it('fetches document by id', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'doc-42', title: 'Spells Guide', type: 'srd_content' }),
      } as Response);

      const doc = await getDocument('doc-42');
      expect(doc.id).toBe('doc-42');
      expect(doc.title).toBe('Spells Guide');
    });

    it('throws when getDocument fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(getDocument('missing')).rejects.toThrow('Failed to fetch document: Not Found');
    });

    it('fetches document content as blob', async () => {
      const dummyBlob = new Blob(['sample content']);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(dummyBlob),
      } as Response);

      const content = await getDocumentContent('doc-42');
      expect(content).toBe(dummyBlob);
    });

    it('throws when getDocumentContent fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      await expect(getDocumentContent('doc-42')).rejects.toThrow('Failed to fetch content: Forbidden');
    });
  });

  describe('getStructuredData & searchStructuredData (CS-69)', () => {
    it('returns raw array when doc-api returns an array of structured data', async () => {
      const mockItems = [
        { id: 'sd-1', documentId: 'd1', type: 'spell', name: 'Magic Missile', data: {} },
        { id: 'sd-2', documentId: 'd1', type: 'spell', name: 'Fireball', data: {} },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockItems),
      } as Response);

      const res1 = await getStructuredData('d1');
      expect(res1).toEqual(mockItems);

      const res2 = await searchStructuredData({ type: 'spell', name: 'Fire' });
      expect(res2).toEqual(mockItems);
    });

    it('returns data.data when backend returns an object envelope', async () => {
      const mockItems = [
        { id: 'sd-3', documentId: 'd2', type: 'monster', name: 'Aboleth', data: {} },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockItems }),
      } as Response);

      const res = await getStructuredData('d2');
      expect(res).toEqual(mockItems);
    });

    it('returns empty array when data or data.data is not an array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ other: 'value' }),
      } as Response);

      const res = await getStructuredData('d3');
      expect(res).toEqual([]);
    });

    it('throws when structured data request returns non-200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Gateway Timeout',
      } as Response);

      await expect(getStructuredData('d1')).rejects.toThrow('Failed to fetch structured data: Gateway Timeout');
      await expect(searchStructuredData({ type: 'item' })).rejects.toThrow('Search failed: Gateway Timeout');
    });
  });

  describe('getDocumentTypes & getAvailableTags (CS-70)', () => {
    it('derives unique sorted document types from listDocuments', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            documents: [
              { id: '1', type: 'rulebook' },
              { id: '2', type: 'homebrew' },
              { id: '3', type: 'rulebook' },
            ],
            total: 3,
          }),
      } as Response);

      const types = await getDocumentTypes();
      expect(types).toEqual(['homebrew', 'rulebook']);
    });

    it('falls back to DEFAULT_DOCUMENT_TYPES when listDocuments throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const types = await getDocumentTypes();
      expect(types).toEqual(DEFAULT_DOCUMENT_TYPES);
    });

    it('derives unique sorted tags from listDocuments', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            documents: [
              { id: '1', tags: ['spell', 'srd'] },
              { id: '2', tags: ['monster', 'srd'] },
            ],
            total: 2,
          }),
      } as Response);

      const tags = await getAvailableTags();
      expect(tags).toEqual(['monster', 'spell', 'srd']);
    });

    it('falls back to DEFAULT_TAGS when listDocuments throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const tags = await getAvailableTags();
      expect(tags).toEqual(DEFAULT_TAGS);
    });
  });
});

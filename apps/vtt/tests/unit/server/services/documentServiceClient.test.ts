import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentServiceClient, createDocumentServiceClient } from '../../../../server/services/documentServiceClient.js';

describe('DocumentServiceClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds document, search, and structured-data requests with normalized URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [], results: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const client = new DocumentServiceClient({ apiUrl: 'http://documents.test/' });
    await client.createDocument({ title: 'Rules', type: 'rulebook', format: 'pdf', uploadedBy: 'ignored', fileSize: 1, fileName: 'rules.pdf' }, 'user-1');
    await client.listDocuments({ skip: 2, limit: 5, type: 'rulebook', campaign: 'camp', tag: 'srd', search: 'fire' });
    await client.searchDocuments({ query: 'fire bolt', campaigns: ['camp'], tags: ['srd'], from: 1, size: 4 });
    await client.semanticSearch({ query: 'dragon', topK: 3 });
    await client.getDocumentStructuredData('doc-1', { type: 'spell', name: 'Fire Bolt' });
    await client.listStructuredData({ documentId: 'doc-1', search: 'fire', limit: '10' });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      'http://documents.test/api/documents',
      expect.stringContaining('/api/documents?skip=2&limit=5&type=rulebook&campaign=camp&tag=srd&search=fire'),
      expect.stringContaining('/api/search?query=fire+bolt&campaigns=camp&tags=srd&from=1&size=4'),
      expect.stringContaining('/api/search/semantic?query=dragon&topK=3'),
      expect.stringContaining('/api/documents/doc-1/structured-data?type=spell&name=Fire+Bolt'),
    ]));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ uploadedBy: 'user-1' });
    expect(client.getDocumentContentUrl('doc-1')).toBe('http://documents.test/api/documents/doc-1/content');
    expect(createDocumentServiceClient('http://documents.test')).toBeInstanceOf(DocumentServiceClient);
  });

  it('surfaces service errors, invalid JSON error bodies, and timeouts', async () => {
    const client = new DocumentServiceClient({ apiUrl: 'http://documents.test', timeout: 1 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Missing document' }) }));
    await expect(client.getDocument('gone')).rejects.toThrow('Missing document');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json'); } }));
    await expect(client.healthCheck()).rejects.toThrow('Unknown error');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    await expect(client.deleteDocument('gone')).rejects.toThrow('Request timeout');
  });
});

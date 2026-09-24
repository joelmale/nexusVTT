import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CODEX_ALLOWLIST, CODEX_MAX_JSON_BYTES, CODEX_UPLOAD_MAX_BODY_BYTES, CODEX_UPLOAD_MAX_FILE_BYTES } from '../src/codex/allowlist.js';
import { MB } from '../src/proxy/routeTable.js';
import { DOC_API_URL, OBJECT_STORAGE_ORIGIN, startHarness, type Harness, type TestSession } from './support/harness.js';
import { BATCH_ID, codexStub, DOC_ID, PDF_BYTES, PRESIGNED_PAGE, PRESIGNED_PUT, uploadForm, WEBP_BYTES } from './support/upstreams.js';

const UPLOAD = '/control-api/v1/codex/documents/upload';
const MAX_FILE = 4096;

const leftoverSpools = () => readdirSync(tmpdir()).filter((name) => name.startsWith('nexus-control-upload-'));

describe('Codex body caps', () => {
  it('allows 200 MB for the upload route and at most 1 MB everywhere else', () => {
    expect(CODEX_UPLOAD_MAX_FILE_BYTES).toBe(200 * MB);
    for (const route of CODEX_ALLOWLIST) {
      if (route.body.kind === 'none') continue;
      if (route.path === 'documents/upload') {
        expect(route.body).toEqual({ kind: 'stream', maxBytes: CODEX_UPLOAD_MAX_BODY_BYTES, contentTypes: ['multipart/form-data'] });
        expect(CODEX_UPLOAD_MAX_BODY_BYTES).toBeLessThanOrEqual(201 * MB);
      } else {
        expect(route.body.kind, route.path).toBe('json');
        expect(route.body.maxBytes, route.path).toBeLessThanOrEqual(CODEX_MAX_JSON_BYTES);
      }
    }
    expect(CODEX_MAX_JSON_BYTES).toBe(1 * MB);
  });

  it('lists the server-side upload and page-image routes', () => {
    const upload = CODEX_ALLOWLIST.find((route) => route.path === 'documents/upload')!;
    expect(upload).toMatchObject({ method: 'POST', permission: ['codex:write'], audited: true, handler: 'upload' });
    const image = CODEX_ALLOWLIST.find((route) => route.path === 'documents/:id/pages/:page/image')!;
    expect(image).toMatchObject({ method: 'GET', permission: ['codex:read'], handler: 'pageImage', response: 'image' });
  });
});

describe('Codex server-side upload', () => {
  let h: Harness;
  let editor: TestSession;
  beforeAll(async () => {
    h = await startHarness({ config: { codexUploadMaxFileBytes: MAX_FILE } });
    editor = await h.sessionFor(['content_editor']);
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.store.audit.length = 0;
    h.upstreamCalls.length = 0;
    h.upstream.respond = codexStub();
  });

  it('creates the record, PUTs the bytes to object storage, queues processing, and hides the presigned URL', async () => {
    const before = leftoverSpools().length;
    const res = await h.request(UPLOAD, {
      method: 'POST',
      session: editor,
      body: uploadForm({
        title: 'Monster Manual',
        description: 'Creatures',
        type: 'rulebook',
        tags: ['srd', 'monsters'],
        campaigns: '["camp-1","camp-2"]',
        isPublic: 'false',
        uploadedBy: 'someone-else',
        userId: 'someone-else',
        fileSize: '1',
        format: 'markdown',
      }),
    });
    expect(res.status).toBe(201);
    const text = await res.text();
    const body = JSON.parse(text) as { batchId: string; documents: Array<{ id: string; uploadedBy: string }>; processingQueued: boolean };
    expect(body.batchId).toBe(BATCH_ID);
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0]!.id).toBe(DOC_ID);
    expect(body.processingQueued).toBe(true);
    expect(text).not.toContain('X-Amz');
    expect(text).not.toContain(OBJECT_STORAGE_ORIGIN);

    const [create, put, processing] = h.upstreamCalls;
    expect(h.upstreamCalls).toHaveLength(3);
    expect(create!.url).toBe(`${DOC_API_URL}/api/documents/bulk`);
    expect(create!.method).toBe('POST');
    const created = JSON.parse(create!.body!.toString('utf8')) as { documents: Array<Record<string, unknown>> };
    expect(created.documents).toHaveLength(1);
    expect(created.documents[0]).toEqual({
      title: 'Monster Manual',
      description: 'Creatures',
      type: 'rulebook',
      format: 'pdf',
      author: '',
      uploadedBy: editor.user.id,
      tags: ['srd', 'monsters'],
      campaigns: ['camp-1', 'camp-2'],
      collections: [],
      isPublic: false,
      metadata: {},
      fileSize: PDF_BYTES.length,
      fileName: 'Monster Manual.pdf',
    });
    expect(put!.url).toBe(PRESIGNED_PUT);
    expect(put!.method).toBe('PUT');
    expect(put!.headers['content-type']).toBe('application/pdf');
    expect(put!.headers.cookie).toBeUndefined();
    expect(put!.headers.authorization).toBeUndefined();
    expect(put!.body).toEqual(PDF_BYTES);
    expect(processing!.url).toBe(`${DOC_API_URL}/api/documents/${DOC_ID}/process`);
    expect(processing!.method).toBe('POST');

    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({
      action: 'codex.document.upload',
      outcome: 'success',
      resourceType: 'document',
      resourceId: DOC_ID,
      actorUserId: editor.user.id,
      roleUsed: 'content_editor',
      summary: { format: 'pdf', fileSize: PDF_BYTES.length, batchId: BATCH_ID, processingQueued: true },
    });
    expect(JSON.stringify(h.store.audit[0])).not.toContain('Monster Manual');
    // The spool directory is removed right after the response is sent.
    await vi.waitFor(() => expect(leftoverSpools().length).toBe(before));
  });

  it('uploads Markdown with the markdown content type and defaults the title to the file name', async () => {
    const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm({}, { bytes: Buffer.from('# Goblins\n\nSmall and mean.\n'), name: 'goblins.md', type: 'text/markdown' }) });
    expect(res.status).toBe(201);
    const created = JSON.parse(h.upstreamCalls[0]!.body!.toString('utf8')) as { documents: Array<Record<string, unknown>> };
    expect(created.documents[0]).toMatchObject({ title: 'goblins', format: 'markdown', type: 'rulebook', fileName: 'goblins.md' });
    expect(h.upstreamCalls[1]!.headers['content-type']).toBe('text/markdown');
  });

  it('enforces the size cap before contacting doc-api', async () => {
    const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm({}, { bytes: Buffer.concat([PDF_BYTES, Buffer.alloc(MAX_FILE)]) }) });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: 'payload_too_large' });
    expect(h.upstreamCalls).toHaveLength(0);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'failure', summary: { reason: 'payload_too_large' } });
  });

  const rejected: Array<[string, FormData, number, string]> = [
    ['PDF extension with non-PDF bytes', uploadForm({}, { bytes: Buffer.from('MZ\x90\x00 executable', 'latin1'), name: 'evil.pdf' }), 415, 'unsupported_media_type'],
    ['executable extension', uploadForm({}, { bytes: PDF_BYTES, name: 'evil.exe', type: 'application/octet-stream' }), 415, 'unsupported_media_type'],
    ['HTML disguised as Markdown', uploadForm({}, { bytes: Buffer.from('<script>x</script>'), name: 'x.html', type: 'text/html' }), 415, 'unsupported_media_type'],
    ['declared type mismatch', uploadForm({}, { bytes: PDF_BYTES, name: 'x.pdf', type: 'text/html' }), 415, 'unsupported_media_type'],
    ['binary Markdown', uploadForm({}, { bytes: Buffer.from([0x23, 0x20, 0x00, 0x01]), name: 'x.md', type: 'text/markdown' }), 415, 'unsupported_media_type'],
    ['invalid UTF-8 Markdown', uploadForm({}, { bytes: Buffer.from([0x23, 0x20, 0xc3, 0x28]), name: 'x.md', type: 'text/markdown' }), 415, 'unsupported_media_type'],
    ['empty file', uploadForm({}, { bytes: Buffer.alloc(0), name: 'x.md', type: 'text/markdown' }), 400, 'empty_file'],
    ['no file', uploadForm({ title: 'x' }, null), 400, 'file_required'],
    ['unknown field', uploadForm({ storageKey: 'documents/../../etc' }), 400, 'invalid_field'],
    ['invalid type', uploadForm({ type: 'malware' }), 400, 'invalid_field'],
    ['invalid batch id', uploadForm({ batchId: '../x' }), 400, 'invalid_field'],
  ];
  for (const [name, form, status, code] of rejected) {
    it(`rejects ${name} without contacting doc-api`, async () => {
      const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: form });
      expect(res.status).toBe(status);
      expect(await res.json()).toMatchObject({ error: code });
      expect(h.upstreamCalls).toHaveLength(0);
      expect(h.store.audit).toHaveLength(1);
      expect(h.store.audit[0]).toMatchObject({ outcome: 'failure', summary: { reason: code } });
    });
  }

  it('rejects two file parts', async () => {
    const form = uploadForm();
    form.append('file', new Blob([PDF_BYTES], { type: 'application/pdf' }), 'second.pdf');
    const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: form });
    expect(res.status).toBe(400);
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('rejects non-multipart bodies and query strings', async () => {
    expect((await h.request(UPLOAD, { method: 'POST', session: editor, body: '{}', headers: { 'content-type': 'application/json' } })).status).toBe(415);
    expect((await h.request(`${UPLOAD}?uploadedBy=x`, { method: 'POST', session: editor, body: uploadForm() })).status).toBe(400);
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('requires CSRF and Origin', async () => {
    expect((await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm(), csrf: false })).status).toBe(403);
    expect((await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm(), origin: 'https://evil.example' })).status).toBe(403);
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('refuses a presigned URL outside the internal object-storage origin and removes the record', async () => {
    h.upstream.respond = codexStub({ uploadUrl: 'http://attacker.example/steal?X-Amz-Signature=1' });
    const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm() });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'object_storage_misconfigured' });
    expect(h.upstreamCalls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${DOC_API_URL}/api/documents/bulk`,
      `DELETE ${DOC_API_URL}/api/documents/${DOC_ID}`,
    ]);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'failure', resourceId: DOC_ID, summary: { reason: 'object_storage_misconfigured' } });
  });

  it('removes the record when object storage rejects the bytes', async () => {
    h.upstream.respond = codexStub({ putStatus: 403 });
    const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm() });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'object_storage_error' });
    expect(h.upstreamCalls.map((call) => call.method)).toEqual(['POST', 'PUT', 'DELETE']);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'failure', summary: { reason: 'object_storage_error' } });
  });

  it('maps a doc-api outage to 502 without leaking detail', async () => {
    h.upstream.respond = () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND doc-api');
    };
    const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm() });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toMatch(/ENOTFOUND|doc-api/);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'failure', summary: { reason: 'upstream_unavailable' } });
  });

  it('reports a created document whose processing could not be queued', async () => {
    const base = codexStub();
    h.upstream.respond = (call) => (call.url.endsWith('/process') ? new Response('{}', { status: 500 }) : base(call));
    const res = await h.request(UPLOAD, { method: 'POST', session: editor, body: uploadForm() });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ processingQueued: false });
  });
});

describe('Codex page images', () => {
  let h: Harness;
  let auditor: TestSession;
  beforeAll(async () => {
    h = await startHarness();
    auditor = await h.sessionFor(['auditor']);
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.upstreamCalls.length = 0;
    h.upstream.respond = codexStub();
  });

  it('streams the page image server-side with safe headers', async () => {
    const res = await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/1/image`, { session: auditor, headers: { authorization: 'Bearer x' } });
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(WEBP_BYTES);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('content-length')).toBe(String(WEBP_BYTES.length));
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-disposition')).toBe('inline');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('server')).toBeNull();
    expect(res.headers.get('x-amz-request-id')).toBeNull();
    const [listing, image] = h.upstreamCalls;
    expect(listing!.url).toBe(`${DOC_API_URL}/api/documents/${DOC_ID}/page-images`);
    expect(image!.url).toBe(PRESIGNED_PAGE);
    expect(image!.headers.cookie).toBeUndefined();
    expect(image!.headers.authorization).toBeUndefined();
  });

  it('serves the requested page number', async () => {
    await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/2/image`, { session: auditor });
    expect(h.upstreamCalls[1]!.url).toBe(PRESIGNED_PAGE.replace('page-1', 'page-2'));
  });

  it('falls back to the stored key extension when object storage reports a generic type', async () => {
    h.upstream.respond = codexStub({ pageContentType: 'binary/octet-stream' });
    const res = await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/1/image`, { session: auditor });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
  });

  it('returns 404 for a missing page or a malformed page number', async () => {
    expect((await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/9/image`, { session: auditor })).status).toBe(404);
    expect((await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/abc/image`, { session: auditor })).status).toBe(404);
    expect((await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/1/image?url=http://x`, { session: auditor })).status).toBe(400);
  });

  it('refuses a presigned URL outside the internal object-storage origin', async () => {
    h.upstream.respond = codexStub({ pageUrl: 'http://169.254.169.254/latest/meta-data' });
    const res = await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/1/image`, { session: auditor });
    expect(res.status).toBe(502);
    expect(h.upstreamCalls).toHaveLength(1);
  });

  it('refuses non-image content from object storage', async () => {
    h.upstream.respond = codexStub({ pageContentType: 'text/html', pageUrl: `${OBJECT_STORAGE_ORIGIN}/documents/pages/x/page-1.html` });
    const res = await h.request(`/control-api/v1/codex/documents/${DOC_ID}/pages/1/image`, { session: auditor });
    expect(res.status).toBe(502);
  });
});

describe('actor fields come from the session', () => {
  let h: Harness;
  let editor: TestSession;
  beforeAll(async () => {
    h = await startHarness();
    editor = await h.sessionFor(['content_editor']);
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.upstreamCalls.length = 0;
  });

  const post = (path: string, value: unknown) =>
    h.request(path, { method: 'POST', session: editor, body: JSON.stringify(value), headers: { 'content-type': 'application/json' } });

  it('overwrites userId on annotations', async () => {
    await post(`/control-api/v1/codex/documents/${DOC_ID}/annotations`, { userId: 'victim', pageNumber: 1, content: 'note', type: 'note' });
    expect(JSON.parse(h.upstreamCalls[0]!.body!.toString('utf8'))).toEqual({ userId: editor.user.id, pageNumber: 1, content: 'note', type: 'note' });
  });

  it('sets userId on references even when the client omits it', async () => {
    await post('/control-api/v1/codex/references', { documentId: DOC_ID, pageNumber: 3 });
    expect(JSON.parse(h.upstreamCalls[0]!.body!.toString('utf8'))).toEqual({ documentId: DOC_ID, pageNumber: 3, userId: editor.user.id });
  });

  it('overwrites uploadedBy on every bulk-created document', async () => {
    await post('/control-api/v1/codex/documents/bulk', { documents: [{ title: 'a', uploadedBy: 'victim' }, { title: 'b' }] });
    const body = JSON.parse(h.upstreamCalls[0]!.body!.toString('utf8')) as { documents: Array<{ uploadedBy: string }> };
    expect(body.documents.map((doc) => doc.uploadedBy)).toEqual([editor.user.id, editor.user.id]);
  });
});

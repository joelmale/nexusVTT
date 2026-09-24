import { DOC_API_URL, OBJECT_STORAGE_ORIGIN, type UpstreamCall } from './harness.js';

export const DOC_ID = '0b6f1c1e-3b7a-4d7e-9a51-4a4a2d6f9c11';
export const BATCH_ID = '7d0c5a8e-1f2b-4c3d-8e9f-0a1b2c3d4e5f';
export const PRESIGNED_PUT = `${OBJECT_STORAGE_ORIGIN}/documents/documents/${DOC_ID}.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef`;
export const PRESIGNED_PAGE = `${OBJECT_STORAGE_ORIGIN}/documents/pages/${DOC_ID}/page-1.webp?X-Amz-Signature=cafebabe`;
export const WEBP_BYTES = Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 fake', 'latin1');

const jsonResponse = (status: number, value: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });

export interface CodexStubOptions {
  uploadUrl?: string;
  putStatus?: number;
  pageUrl?: string;
  pageContentType?: string;
}

/**
 * Stubs doc-api's upload/page-image endpoints and object storage (MinIO).
 * Anything else answers `200 {"ok":true}`.
 */
export function codexStub(options: CodexStubOptions = {}) {
  return (call: UpstreamCall): Response => {
    const url = new URL(call.url);
    if (call.url.startsWith(`${DOC_API_URL}/api/documents/bulk`) && call.method === 'POST') {
      const body = JSON.parse(call.body!.toString('utf8')) as { documents: Array<Record<string, unknown>> };
      const doc = body.documents[0]!;
      return jsonResponse(201, {
        batchId: BATCH_ID,
        results: [{ document: { id: DOC_ID, title: doc.title, uploadedBy: doc.uploadedBy, fileSize: doc.fileSize, format: doc.format, storageKey: `documents/${DOC_ID}.pdf` }, uploadUrl: options.uploadUrl ?? PRESIGNED_PUT, expiresIn: 3600, success: true }],
        total: 1,
        successful: 1,
        failed: 0,
      });
    }
    if (url.origin === OBJECT_STORAGE_ORIGIN && call.method === 'PUT') {
      return new Response(null, { status: options.putStatus ?? 200, headers: { etag: '"abc"' } });
    }
    if (call.url === `${DOC_API_URL}/api/documents/${DOC_ID}/process`) {
      return jsonResponse(202, { message: 'Document processing queued', documentId: DOC_ID, jobId: 'j1' });
    }
    if (call.url === `${DOC_API_URL}/api/documents/${DOC_ID}` && call.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (call.url === `${DOC_API_URL}/api/documents/${DOC_ID}/page-images`) {
      return jsonResponse(200, {
        documentId: DOC_ID,
        title: 'Doc',
        count: 2,
        pages: [
          { key: `pages/${DOC_ID}/page-1.webp`, url: options.pageUrl ?? PRESIGNED_PAGE, pageNumber: 1 },
          { key: `pages/${DOC_ID}/page-2.webp`, url: PRESIGNED_PAGE.replace('page-1', 'page-2'), pageNumber: 2 },
        ],
      });
    }
    if (url.origin === OBJECT_STORAGE_ORIGIN && call.method === 'GET') {
      return new Response(WEBP_BYTES, {
        status: 200,
        headers: {
          'content-type': options.pageContentType ?? 'image/webp',
          'content-length': String(WEBP_BYTES.length),
          'set-cookie': 'minio=1',
          'x-amz-request-id': 'internal',
          server: 'MinIO',
        },
      });
    }
    return jsonResponse(200, { ok: true });
  };
}

export const PDF_BYTES = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n', 'latin1');

export function uploadForm(fields: Record<string, string | string[]> = {}, file: { bytes?: Buffer; name?: string; type?: string } | null = {}): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(key, item);
  }
  if (file) {
    form.append('file', new Blob([new Uint8Array(file.bytes ?? PDF_BYTES)], { type: file.type ?? 'application/pdf' }), file.name ?? 'Monster Manual.pdf');
  }
  return form;
}

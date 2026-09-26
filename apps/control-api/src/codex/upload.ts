import { once } from 'node:events';
import { createWriteStream, openAsBlob, type WriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sendError } from '../http/context.js';
import { MultipartError, multipartBoundary, parseMultipart, type FileSink } from '../http/multipart.js';
import { declaredLength, type HandlerContext } from '../proxy/forward.js';
import { ID } from '../proxy/routeTable.js';
import { CODEX_UPLOAD_MAX_BODY_BYTES, CODEX_UPLOAD_MAX_FILE_BYTES } from './allowlist.js';
import { docApiJson, objectStorageUrl, timedFetch, UpstreamFailure } from './internal.js';

/**
 * `POST /control-api/v1/codex/documents/upload` (codex:write).
 *
 * multipart/form-data with exactly one `file` part (PDF or Markdown, at most
 * 320 MiB) plus optional metadata fields mirroring the Admin UI's bulk upload
 * form: `title`, `description`, `type`, `author`, `isPublic`, `batchId`, and
 * `tags`/`campaigns`/`collections` (repeat the field once per value, or send
 * one JSON array). `uploadedBy`, `userId`, `format`, `fileName`, and
 * `fileSize` are ignored: the uploader is the session's administrator and the
 * rest is derived from the file itself.
 *
 * Flow: spool the file to a private temp directory while counting and
 * sniffing it -> doc-api `POST /api/documents/bulk` (one record) -> PUT the
 * bytes to the presigned object-storage URL (internal origin only) -> doc-api
 * `POST /api/documents/:id/process`. The presigned URL never reaches the
 * browser. A record whose bytes could not be stored is deleted again.
 */

export const DOCUMENT_TYPES = ['rulebook', 'campaign_note', 'handout', 'map', 'character_sheet', 'homebrew'] as const;
type DocumentFormat = 'pdf' | 'markdown';

const FORMAT_BY_EXTENSION: Readonly<Record<string, DocumentFormat>> = { pdf: 'pdf', md: 'markdown', markdown: 'markdown' };
const STORED_CONTENT_TYPE: Readonly<Record<DocumentFormat, string>> = { pdf: 'application/pdf', markdown: 'text/markdown' };
const DECLARED_TYPES: Readonly<Record<DocumentFormat, ReadonlySet<string>>> = {
  pdf: new Set(['', 'application/pdf', 'application/x-pdf', 'application/octet-stream']),
  markdown: new Set(['', 'text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream']),
};
const IGNORED_FIELDS = new Set(['uploadedBy', 'userId', 'format', 'fileName', 'fileSize']);
const LIST_FIELDS = new Set(['tags', 'campaigns', 'collections']);
const SCALAR_FIELDS = new Set(['title', 'description', 'type', 'author', 'isPublic', 'batchId']);
const MAX_LIST_ITEMS = 100;
const MAX_LIST_ITEM = 200;
/** No control characters except tab, LF, and CR. */
const NO_CONTROL = /^(?:\P{Cc}|[\t\n\r])*$/u;
const PUT_TIMEOUT_MS = 300_000;

class UploadRejected extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

interface SpooledFile {
  path: string;
  filename: string;
  format: DocumentFormat;
  size: number;
}

/** Spools one file part to disk while enforcing the size cap and sniffing its type. */
class SpoolSink implements FileSink {
  private readonly stream: WriteStream;
  private head = Buffer.alloc(0);
  private readonly decoder: TextDecoder | null;
  size = 0;

  constructor(readonly filePath: string, readonly format: DocumentFormat) {
    this.stream = createWriteStream(filePath, { flags: 'wx', mode: 0o600 });
    this.stream.on('error', () => undefined);
    this.decoder = format === 'markdown' ? new TextDecoder('utf-8', { fatal: true }) : null;
  }

  async write(chunk: Buffer): Promise<void> {
    if (this.head.length < 8) this.head = Buffer.concat([this.head, chunk.subarray(0, 8 - this.head.length)]);
    if (this.format === 'pdf' && this.head.length >= 5 && this.head.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new UploadRejected(415, 'unsupported_media_type');
    }
    if (this.decoder) {
      if (chunk.includes(0)) throw new UploadRejected(415, 'unsupported_media_type');
      try {
        this.decoder.decode(chunk, { stream: true });
      } catch {
        throw new UploadRejected(415, 'unsupported_media_type');
      }
    }
    this.size += chunk.length;
    if (!this.stream.write(chunk)) await once(this.stream, 'drain');
  }

  async end(size: number): Promise<void> {
    this.size = size;
    if (this.format === 'pdf' && (this.head.length < 5 || this.head.subarray(0, 5).toString('latin1') !== '%PDF-')) {
      throw new UploadRejected(415, 'unsupported_media_type');
    }
    if (this.decoder) {
      try {
        this.decoder.decode();
      } catch {
        throw new UploadRejected(415, 'unsupported_media_type');
      }
    }
    this.stream.end();
    await once(this.stream, 'close');
  }

  destroy(): void {
    this.stream.destroy();
  }
}

function formatFor(filename: string): DocumentFormat | null {
  const base = path.basename(filename.replace(/\\/g, '/'));
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  return FORMAT_BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? null;
}

/** A display-safe file name: basename only, no control characters, bounded. */
function safeFileName(filename: string): string {
  const base = path.basename(filename.replace(/\\/g, '/')).replace(/\p{Cc}/gu, '').trim();
  return base.slice(-255) || 'upload';
}

interface DocumentMetadata {
  title: string | null;
  description: string;
  type: (typeof DOCUMENT_TYPES)[number];
  author: string;
  isPublic: boolean;
  batchId: string | null;
  tags: string[];
  campaigns: string[];
  collections: string[];
}

function parseList(values: string[]): string[] {
  const items: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new UploadRejected(400, 'invalid_field');
      }
      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) throw new UploadRejected(400, 'invalid_field');
      items.push(...(parsed as string[]));
    } else if (trimmed !== '') {
      items.push(trimmed);
    }
  }
  const clean = items.map((item) => item.trim()).filter((item) => item !== '');
  if (clean.length > MAX_LIST_ITEMS || clean.some((item) => item.length > MAX_LIST_ITEM || !NO_CONTROL.test(item))) {
    throw new UploadRejected(400, 'invalid_field');
  }
  return [...new Set(clean)];
}

export function parseUploadFields(fields: ReadonlyArray<[string, string]>): DocumentMetadata {
  const scalars = new Map<string, string>();
  const lists = new Map<string, string[]>();
  for (const [name, value] of fields) {
    if (IGNORED_FIELDS.has(name)) continue;
    if (LIST_FIELDS.has(name)) {
      lists.set(name, [...(lists.get(name) ?? []), value]);
    } else if (SCALAR_FIELDS.has(name)) {
      if (scalars.has(name)) throw new UploadRejected(400, 'invalid_field');
      scalars.set(name, value);
    } else {
      throw new UploadRejected(400, 'invalid_field');
    }
  }
  const text = (name: string, max: number): string => {
    const value = (scalars.get(name) ?? '').trim();
    if (value.length > max || !NO_CONTROL.test(value)) throw new UploadRejected(400, 'invalid_field');
    return value;
  };
  const type = scalars.get('type')?.trim() || 'rulebook';
  if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) throw new UploadRejected(400, 'invalid_field');
  const isPublic = scalars.get('isPublic')?.trim() ?? 'false';
  if (isPublic !== 'true' && isPublic !== 'false') throw new UploadRejected(400, 'invalid_field');
  const batchId = scalars.get('batchId')?.trim() || null;
  if (batchId !== null && !ID.test(batchId)) throw new UploadRejected(400, 'invalid_field');
  const title = text('title', 255);
  return {
    title: title === '' ? null : title,
    description: text('description', 10_000),
    type: type as DocumentMetadata['type'],
    author: text('author', 255),
    isPublic: isPublic === 'true',
    batchId,
    tags: parseList(lists.get('tags') ?? []),
    campaigns: parseList(lists.get('campaigns') ?? []),
    collections: parseList(lists.get('collections') ?? []),
  };
}

interface CreatedDocument {
  document: Record<string, unknown> & { id: string };
  uploadUrl: unknown;
}

function createdDocument(json: unknown): { batchId: string; created: CreatedDocument } | null {
  if (!json || typeof json !== 'object') return null;
  const record = json as { batchId?: unknown; results?: unknown };
  if (typeof record.batchId !== 'string' || !Array.isArray(record.results) || record.results.length !== 1) return null;
  const result = record.results[0] as { success?: unknown; document?: unknown; uploadUrl?: unknown } | null;
  if (!result || result.success !== true || !result.document || typeof result.document !== 'object') return null;
  const document = result.document as Record<string, unknown>;
  if (typeof document.id !== 'string' || !ID.test(document.id)) return null;
  return { batchId: record.batchId, created: { document: document as CreatedDocument['document'], uploadUrl: result.uploadUrl } };
}

export async function uploadHandler(hc: HandlerContext): Promise<void> {
  const { deps, req, res, context, audit, baseSummary } = hc;
  const maxFileBytes = deps.config.codexUploadMaxFileBytes ?? CODEX_UPLOAD_MAX_FILE_BYTES;
  const maxBodyBytes = maxFileBytes + (CODEX_UPLOAD_MAX_BODY_BYTES - CODEX_UPLOAD_MAX_FILE_BYTES);
  const reject = async (status: number, code: string) => {
    await audit('failure', { ...baseSummary, reason: code });
    // A refused body is not drained: close the connection after answering.
    if (!req.complete) res.setHeader('Connection', 'close');
    sendError(res, status, code);
  };

  if (hc.rawQuery !== '') return reject(400, 'invalid_query');
  const boundary = multipartBoundary(req.headers['content-type']);
  if (!boundary) return reject(415, 'unsupported_media_type');
  const length = declaredLength(req);
  if (length !== null && length > maxBodyBytes) return reject(413, 'payload_too_large');

  let dir: string | null = null;
  let sink: SpoolSink | null = null;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'nexus-control-upload-'));
    const spoolDir = dir;
    let filename = '';
    const parsed = await parseMultipart(
      // destroyOnReturn: false keeps the socket usable for the error response.
      req.iterator({ destroyOnReturn: false }) as AsyncIterable<Buffer>,
      boundary,
      {
        maxBodyBytes,
        maxFileBytes,
        maxFiles: 1,
        maxFields: 40,
        maxFieldBytes: 64 * 1024,
        maxHeaderBytes: 8 * 1024,
      },
      (info) => {
        if (info.fieldName !== 'file') throw new UploadRejected(400, 'invalid_field');
        const format = formatFor(info.filename);
        if (!format || !DECLARED_TYPES[format].has(info.contentType)) throw new UploadRejected(415, 'unsupported_media_type');
        filename = safeFileName(info.filename);
        sink = new SpoolSink(path.join(spoolDir, 'file'), format);
        return sink;
      },
    );
    const file = sink as SpoolSink | null;
    if (!file || parsed.files !== 1) return await reject(400, 'file_required');
    if (file.size === 0) return await reject(400, 'empty_file');
    const metadata = parseUploadFields(parsed.fields);
    await createAndStore(hc, { path: file.filePath, filename, format: file.format, size: file.size }, metadata);
  } catch (error) {
    (sink as SpoolSink | null)?.destroy();
    if (error instanceof UploadRejected || error instanceof MultipartError) {
      return await reject(error.status, error.code);
    }
    if (error instanceof UpstreamFailure) {
      deps.logger.warn('codex upload failed', { requestId: context.requestId, reason: error.reason, upstreamStatus: error.upstreamStatus });
      const status = error.reason === 'upstream_timeout' ? 504 : 502;
      await audit('failure', { ...baseSummary, reason: error.reason, ...(error.upstreamStatus ? { upstreamStatus: error.upstreamStatus } : {}) });
      return sendError(res, status, error.reason);
    }
    if (req.destroyed || res.destroyed) {
      await audit('failure', { ...baseSummary, reason: 'client_aborted' });
      return;
    }
    throw error;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function createAndStore(hc: HandlerContext, file: SpooledFile, metadata: DocumentMetadata): Promise<void> {
  const { deps, res, context, audit, baseSummary } = hc;
  const userId = context.admin!.user.id;
  const title = metadata.title ?? (file.filename.replace(/\.[^.]+$/, '').slice(0, 255) || 'Untitled');
  const request = {
    documents: [
      {
        title,
        description: metadata.description,
        type: metadata.type,
        format: file.format,
        author: metadata.author,
        uploadedBy: userId,
        tags: metadata.tags,
        campaigns: metadata.campaigns,
        collections: metadata.collections,
        isPublic: metadata.isPublic,
        metadata: {},
        fileSize: file.size,
        fileName: file.filename,
      },
    ],
    ...(metadata.batchId ? { batchId: metadata.batchId } : {}),
  };
  const summary = { ...baseSummary, format: file.format, fileSize: file.size, type: metadata.type };

  const create = await docApiJson(deps, context, 'POST', 'documents/bulk', { body: request });
  if (create.status === 400 || create.status === 422) throw new UploadRejected(400, 'invalid_request');
  if (create.status !== 201 && create.status !== 200) throw new UpstreamFailure('upstream_error', create.status);
  const created = createdDocument(create.json);
  if (!created) throw new UpstreamFailure('upstream_error', create.status);
  const documentId = created.created.document.id;

  const discard = async (reason: string) => {
    try {
      await docApiJson(deps, context, 'DELETE', `documents/${documentId}`);
    } catch (error) {
      deps.logger.warn('could not remove document after failed upload', { requestId: context.requestId, documentId, error });
    }
    await audit('failure', { ...summary, reason, batchId: created.batchId }, { resourceId: documentId });
    sendError(res, 502, reason);
  };

  const target = objectStorageUrl(deps, created.created.uploadUrl);
  if (!target) {
    deps.logger.error('presigned upload URL is not on the internal object-storage origin; set doc-api S3_PUBLIC_ENDPOINT to it', { requestId: context.requestId });
    return discard('object_storage_misconfigured');
  }

  let put: globalThis.Response;
  try {
    const blob = await openAsBlob(file.path, { type: STORED_CONTENT_TYPE[file.format] });
    put = await timedFetch(deps, target.href, {
      method: 'PUT',
      headers: { 'content-type': STORED_CONTENT_TYPE[file.format] },
      body: blob,
    }, PUT_TIMEOUT_MS, 'object_storage');
  } catch (error) {
    deps.logger.warn('object storage upload failed', { requestId: context.requestId, documentId, error });
    return discard('object_storage_error');
  }
  if (put.status < 200 || put.status >= 300) {
    const errorBody = await put.text().catch(() => '');
    deps.logger.warn('object storage rejected the upload', { requestId: context.requestId, documentId, status: put.status, body: errorBody });
    return discard('object_storage_error');
  }
  await put.body?.cancel().catch(() => undefined);

  let processingQueued = false;
  try {
    const processing = await docApiJson(deps, context, 'POST', `documents/${documentId}/process`);
    processingQueued = processing.status >= 200 && processing.status < 300;
  } catch (error) {
    deps.logger.warn('could not queue document processing', { requestId: context.requestId, documentId, error });
  }

  await audit('success', { ...summary, batchId: created.batchId, upstreamStatus: create.status, processingQueued }, { resourceId: documentId });
  res.status(201).json({
    document: created.created.document,
    batchId: created.batchId,
    documents: [created.created.document],
    processingQueued,
  });
}

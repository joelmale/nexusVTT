/**
 * Minimal streaming multipart/form-data parser (RFC 7578) for control-api's
 * own upload handlers. It never buffers a file part: file bytes go to the
 * caller's sink as they arrive, so memory stays bounded by the header and
 * field limits. Every limit is enforced while streaming.
 */

export class MultipartError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

export interface MultipartLimits {
  /** Whole request body, framing included. */
  maxBodyBytes: number;
  maxFileBytes: number;
  maxFiles: number;
  maxFields: number;
  maxFieldBytes: number;
  /** One part's header block. */
  maxHeaderBytes: number;
}

export interface FilePartInfo {
  fieldName: string;
  filename: string;
  /** Declared part Content-Type (lower-cased media type), or '' when absent. */
  contentType: string;
}

export interface FileSink {
  write(chunk: Buffer): Promise<void>;
  /** Called once when the part ends; `size` is the byte count written. */
  end(size: number): Promise<void>;
}

export interface MultipartResult {
  fields: Array<[string, string]>;
  files: number;
}

const BOUNDARY = /^[0-9A-Za-z'()+_,./:=? -]{1,70}$/;
const CRLF = Buffer.from('\r\n');
const HEADER_END = Buffer.from('\r\n\r\n');

/** Extracts the boundary from a multipart/form-data Content-Type, or null. */
export function multipartBoundary(contentType: string | undefined): string | null {
  if (!contentType) return null;
  const [mediaType, ...params] = contentType.split(';');
  if (mediaType?.trim().toLowerCase() !== 'multipart/form-data') return null;
  for (const param of params) {
    const eq = param.indexOf('=');
    if (eq < 0 || param.slice(0, eq).trim().toLowerCase() !== 'boundary') continue;
    let value = param.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
    return BOUNDARY.test(value) && !value.endsWith(' ') ? value : null;
  }
  return null;
}

function parseDisposition(value: string): { name: string | null; filename: string | null } | null {
  const semicolon = value.indexOf(';');
  const type = (semicolon < 0 ? value : value.slice(0, semicolon)).trim().toLowerCase();
  if (type !== 'form-data') return null;
  let name: string | null = null;
  let filename: string | null = null;
  const param = /;\s*([A-Za-z0-9*_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]*))/g;
  for (const match of value.slice(semicolon < 0 ? value.length : semicolon).matchAll(param)) {
    const key = match[1]!.toLowerCase();
    const raw = match[2] !== undefined ? match[2].replace(/\\(.)/g, '$1') : (match[3] ?? '');
    if (key === 'name') name = raw;
    else if (key === 'filename') filename = raw;
  }
  return { name, filename };
}

interface PartHeaders {
  name: string;
  filename: string | null;
  contentType: string;
}

function parseHeaders(block: Buffer): PartHeaders {
  let disposition: ReturnType<typeof parseDisposition> = null;
  let contentType = '';
  for (const line of block.toString('utf8').split('\r\n')) {
    if (line === '') continue;
    const colon = line.indexOf(':');
    if (colon <= 0 || /[^\P{Cc}\t]/u.test(line)) throw new MultipartError(400, 'invalid_multipart');
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'content-disposition') disposition = parseDisposition(value);
    else if (key === 'content-type') contentType = value.split(';')[0]!.trim().toLowerCase();
  }
  if (!disposition?.name) throw new MultipartError(400, 'invalid_multipart');
  return { name: disposition.name, filename: disposition.filename, contentType };
}

type State = 'preamble' | 'afterDelimiter' | 'headers' | 'body' | 'end';

/**
 * Parses `body` (the raw request stream). `onFile` is called for each file
 * part (a part with a `filename`) and returns its sink, or throws a
 * MultipartError to refuse the part.
 */
export async function parseMultipart(
  body: AsyncIterable<Buffer>,
  boundary: string,
  limits: MultipartLimits,
  onFile: (info: FilePartInfo) => FileSink | Promise<FileSink>,
): Promise<MultipartResult> {
  // A leading CRLF lets the first delimiter be matched like every other one.
  const delimiter = Buffer.from(`\r\n--${boundary}`);
  let buffer: Buffer = Buffer.from(CRLF);
  let state: State = 'preamble';
  let received = 0;
  const fields: Array<[string, string]> = [];
  let files = 0;
  let fieldBytes: Buffer[] = [];
  let fieldSize = 0;
  let current: { headers: PartHeaders; sink: FileSink | null; size: number } | null = null;

  const emit = async (chunk: Buffer) => {
    if (!current || chunk.length === 0) return;
    current.size += chunk.length;
    if (current.sink) {
      if (current.size > limits.maxFileBytes) throw new MultipartError(413, 'payload_too_large');
      await current.sink.write(chunk);
    } else {
      fieldSize += chunk.length;
      if (fieldSize > limits.maxFieldBytes) throw new MultipartError(413, 'field_too_large');
      fieldBytes.push(chunk);
    }
  };

  const finishPart = async () => {
    if (!current) return;
    if (current.sink) {
      await current.sink.end(current.size);
    } else {
      fields.push([current.headers.name, Buffer.concat(fieldBytes).toString('utf8')]);
    }
    current = null;
    fieldBytes = [];
    fieldSize = 0;
  };

  const startPart = async (headers: PartHeaders) => {
    if (headers.filename !== null) {
      files += 1;
      if (files > limits.maxFiles) throw new MultipartError(400, 'too_many_files');
      const sink = await onFile({ fieldName: headers.name, filename: headers.filename, contentType: headers.contentType });
      current = { headers, sink, size: 0 };
    } else {
      if (fields.length >= limits.maxFields) throw new MultipartError(400, 'too_many_fields');
      current = { headers, sink: null, size: 0 };
    }
  };

  const drain = async (final: boolean) => {
    for (;;) {
      if (state === 'end') {
        buffer = Buffer.alloc(0); // epilogue is ignored
        return;
      }
      if (state === 'preamble' || state === 'body') {
        const index = buffer.indexOf(delimiter);
        if (index < 0) {
          // Keep enough tail to recognise a delimiter split across chunks.
          const keep = final ? 0 : Math.min(buffer.length, delimiter.length - 1);
          if (state === 'body') await emit(buffer.subarray(0, buffer.length - keep));
          else if (buffer.length - keep > limits.maxHeaderBytes) throw new MultipartError(400, 'invalid_multipart');
          buffer = buffer.subarray(buffer.length - keep);
          return;
        }
        if (state === 'body') {
          await emit(buffer.subarray(0, index));
          await finishPart();
        }
        buffer = buffer.subarray(index + delimiter.length);
        state = 'afterDelimiter';
        continue;
      }
      if (state === 'afterDelimiter') {
        if (buffer.length < 2) {
          if (final) throw new MultipartError(400, 'invalid_multipart');
          return;
        }
        if (buffer[0] === 0x2d && buffer[1] === 0x2d) {
          state = 'end';
          continue;
        }
        if (buffer[0] !== 0x0d || buffer[1] !== 0x0a) throw new MultipartError(400, 'invalid_multipart');
        buffer = buffer.subarray(2);
        state = 'headers';
        continue;
      }
      // headers
      const end = buffer.indexOf(HEADER_END);
      const blankFirst = buffer.length >= 2 && buffer[0] === 0x0d && buffer[1] === 0x0a;
      if (blankFirst) throw new MultipartError(400, 'invalid_multipart'); // a part needs headers
      if (end < 0) {
        if (buffer.length > limits.maxHeaderBytes || final) throw new MultipartError(400, 'invalid_multipart');
        return;
      }
      if (end > limits.maxHeaderBytes) throw new MultipartError(400, 'invalid_multipart');
      const headers = parseHeaders(buffer.subarray(0, end));
      buffer = buffer.subarray(end + HEADER_END.length);
      await startPart(headers);
      state = 'body';
    }
  };

  for await (const chunk of body) {
    received += chunk.length;
    if (received > limits.maxBodyBytes) throw new MultipartError(413, 'payload_too_large');
    buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
    await drain(false);
  }
  await drain(true);
  // `state` is advanced inside drain(); widen it back from the initial literal.
  if ((state as State) !== 'end') throw new MultipartError(400, 'invalid_multipart');
  return { fields, files };
}

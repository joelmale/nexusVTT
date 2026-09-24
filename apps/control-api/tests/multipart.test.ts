import { describe, expect, it } from 'vitest';
import { MultipartError, multipartBoundary, parseMultipart, type FileSink, type MultipartLimits } from '../src/http/multipart.js';

const LIMITS: MultipartLimits = { maxBodyBytes: 1 << 20, maxFileBytes: 1 << 16, maxFiles: 1, maxFields: 10, maxFieldBytes: 1024, maxHeaderBytes: 1024 };
const BOUNDARY = '----nexusBoundary7MA4YWxkTrZu0gW';

function body(parts: string[], preamble = '', epilogue = ''): Buffer {
  return Buffer.from(`${preamble}${parts.map((part) => `--${BOUNDARY}\r\n${part}\r\n`).join('')}--${BOUNDARY}--\r\n${epilogue}`, 'latin1');
}

async function* chunks(buffer: Buffer, size: number): AsyncGenerator<Buffer> {
  for (let i = 0; i < buffer.length; i += size) yield buffer.subarray(i, i + size);
}

async function parse(buffer: Buffer, chunkSize = buffer.length, limits = LIMITS) {
  const files: Array<{ name: string; filename: string; contentType: string; data: Buffer }> = [];
  const result = await parseMultipart(chunks(buffer, Math.max(1, chunkSize)), BOUNDARY, limits, (info) => {
    const collected: Buffer[] = [];
    const sink: FileSink = {
      write: async (chunk) => {
        collected.push(Buffer.from(chunk));
      },
      end: async () => {
        files.push({ name: info.fieldName, filename: info.filename, contentType: info.contentType, data: Buffer.concat(collected) });
      },
    };
    return sink;
  });
  return { ...result, fileParts: files };
}

// The file content deliberately contains a near-delimiter and CRLFs.
const FILE_DATA = `%PDF-1.7\r\n--${BOUNDARY.slice(0, -1)}\r\n\r\nbinary\x00\xff tail`;
const SAMPLE = body(
  [
    'Content-Disposition: form-data; name="title"\r\n\r\nMonster; "Manual"',
    'Content-Disposition: form-data; name="tags"\r\n\r\nsrd',
    `Content-Disposition: form-data; name="file"; filename="a \\"b\\".pdf"\r\nContent-Type: application/pdf\r\n\r\n${FILE_DATA}`,
    'Content-Disposition: form-data; name="tags"\r\n\r\n',
  ],
  'ignored preamble\r\n',
  'ignored epilogue',
);

describe('multipart parser', () => {
  it('parses fields and a file identically for every chunk size', async () => {
    for (let size = 1; size <= SAMPLE.length; size += size < 80 ? 1 : 37) {
      const result = await parse(SAMPLE, size);
      expect(result.fields, `chunk ${size}`).toEqual([
        ['title', 'Monster; "Manual"'],
        ['tags', 'srd'],
        ['tags', ''],
      ]);
      expect(result.files).toBe(1);
      expect(result.fileParts).toHaveLength(1);
      expect(result.fileParts[0]!.name).toBe('file');
      expect(result.fileParts[0]!.filename).toBe('a "b".pdf');
      expect(result.fileParts[0]!.contentType).toBe('application/pdf');
      expect(result.fileParts[0]!.data.toString('latin1'), `chunk ${size}`).toBe(FILE_DATA);
    }
  });

  it('extracts quoted and unquoted boundaries and rejects others', () => {
    expect(multipartBoundary(`multipart/form-data; boundary=${BOUNDARY}`)).toBe(BOUNDARY);
    expect(multipartBoundary('multipart/form-data; charset=utf-8; boundary="a b:c"')).toBe('a b:c');
    expect(multipartBoundary('Multipart/Form-Data;BOUNDARY=x')).toBe('x');
    expect(multipartBoundary('multipart/mixed; boundary=x')).toBeNull();
    expect(multipartBoundary('multipart/form-data')).toBeNull();
    expect(multipartBoundary(`multipart/form-data; boundary=${'x'.repeat(71)}`)).toBeNull();
    expect(multipartBoundary('multipart/form-data; boundary=a\r\nb')).toBeNull();
    expect(multipartBoundary(undefined)).toBeNull();
  });

  const failures: Array<[string, Buffer, Partial<MultipartLimits>, number, string]> = [
    ['a missing close delimiter', Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="a"\r\n\r\nx`, 'latin1'), {}, 400, 'invalid_multipart'],
    ['no delimiter at all', Buffer.from('just text'), {}, 400, 'invalid_multipart'],
    ['a part without a name', body(['Content-Disposition: form-data\r\n\r\nx']), {}, 400, 'invalid_multipart'],
    ['a non form-data disposition', body(['Content-Disposition: attachment; name="a"\r\n\r\nx']), {}, 400, 'invalid_multipart'],
    ['oversized headers', body([`Content-Disposition: form-data; name="a"\r\nX-Pad: ${'p'.repeat(2048)}\r\n\r\nx`]), {}, 400, 'invalid_multipart'],
    ['an oversized field', body([`Content-Disposition: form-data; name="a"\r\n\r\n${'x'.repeat(2048)}`]), {}, 413, 'field_too_large'],
    ['too many fields', body(Array.from({ length: 3 }, (_, i) => `Content-Disposition: form-data; name="f${i}"\r\n\r\nx`)), { maxFields: 2 }, 400, 'too_many_fields'],
    ['too many files', body(['Content-Disposition: form-data; name="file"; filename="a"\r\n\r\nx', 'Content-Disposition: form-data; name="file"; filename="b"\r\n\r\ny']), {}, 400, 'too_many_files'],
    ['an oversized file', body([`Content-Disposition: form-data; name="file"; filename="a"\r\n\r\n${'x'.repeat(200)}`]), { maxFileBytes: 100 }, 413, 'payload_too_large'],
    ['an oversized body', SAMPLE, { maxBodyBytes: 100 }, 413, 'payload_too_large'],
  ];

  for (const [name, buffer, limits, status, code] of failures) {
    it(`rejects ${name}`, async () => {
      for (const size of [1, 7, buffer.length]) {
        const error = await parse(buffer, size, { ...LIMITS, ...limits }).then(() => null, (e: unknown) => e);
        expect(error, `chunk ${size}`).toBeInstanceOf(MultipartError);
        expect((error as MultipartError).status).toBe(status);
        expect((error as MultipartError).code).toBe(code);
      }
    });
  }

  it('lets the file callback refuse a part', async () => {
    const buffer = body(['Content-Disposition: form-data; name="other"; filename="a"\r\n\r\nx']);
    await expect(
      parseMultipart(chunks(buffer, 5), BOUNDARY, LIMITS, () => {
        throw new MultipartError(400, 'invalid_field');
      }),
    ).rejects.toMatchObject({ code: 'invalid_field' });
  });
});

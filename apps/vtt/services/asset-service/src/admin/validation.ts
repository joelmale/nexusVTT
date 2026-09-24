import { AdminError } from './errors';
import { ASSET_ID_PATTERN } from './pathSafety';

/** Request-body validation for the internal admin API. */

function isControlChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code <= 0x1f || code === 0x7f;
}

function hasControlChars(value: string): boolean {
  return [...value].some(isControlChar);
}

function stripControlChars(value: string): string {
  return [...value].filter((char) => !isControlChar(char)).join('');
}
const MAX_TAGS = 50;
const MAX_CAMPAIGN_IDS = 1000;

export interface MetadataPatch {
  name?: string;
  category?: string;
  tags?: string[];
  attribution?: string | null;
  license?: string | null;
}

export interface UploadFields extends MetadataPatch {
  category: string;
  source?: string;
  sourceUrl?: string;
}

function invalid(field: string, message: string): AdminError {
  return new AdminError(400, 'invalid-field', message, { field });
}

function boundedString(field: string, value: unknown, max: number): string {
  if (typeof value !== 'string') throw invalid(field, `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max || hasControlChars(trimmed)) {
    throw invalid(field, `${field} must be 1-${max} printable characters`);
  }
  return trimmed;
}

function nullableString(field: string, value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return boundedString(field, value, max);
}

function parseCategory(value: unknown): string {
  const category = boundedString('category', value, 64);
  if (/[\\/]/.test(category)) throw invalid('category', 'category must not contain slashes');
  return category;
}

function parseTags(value: unknown): string[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (text.startsWith('[')) {
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        throw invalid('tags', 'tags must be a JSON array or comma-separated list');
      }
    } else {
      raw = text === '' ? [] : text.split(',');
    }
  }
  if (!Array.isArray(raw)) throw invalid('tags', 'tags must be an array of strings');
  const tags: string[] = [];
  for (const tag of raw) {
    const parsed = boundedString('tags', tag, 48);
    if (!tags.includes(parsed)) tags.push(parsed);
  }
  if (tags.length > MAX_TAGS) throw invalid('tags', `at most ${MAX_TAGS} tags are allowed`);
  return tags;
}

const PATCH_FIELDS = new Set(['name', 'category', 'tags', 'attribution', 'license']);

function readMetadata(body: Record<string, unknown>): MetadataPatch {
  const patch: MetadataPatch = {};
  if (body.name !== undefined) patch.name = boundedString('name', body.name, 200);
  if (body.category !== undefined) patch.category = parseCategory(body.category);
  if (body.tags !== undefined) patch.tags = parseTags(body.tags);
  if (body.attribution !== undefined) {
    patch.attribution = nullableString('attribution', body.attribution, 500);
  }
  if (body.license !== undefined) patch.license = nullableString('license', body.license, 120);
  return patch;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

/** PATCH body: at least one editable field; unknown fields are rejected. */
export function parseMetadataPatch(body: unknown): MetadataPatch {
  const record = asRecord(body);
  for (const key of Object.keys(record)) {
    if (key !== 'expectedVersion' && !PATCH_FIELDS.has(key)) {
      throw new AdminError(400, 'unknown-field', `Field ${key} cannot be edited`, {
        field: key,
      });
    }
  }
  const patch = readMetadata(record);
  if (Object.keys(patch).length === 0) {
    throw new AdminError(400, 'empty-patch', 'No editable fields were supplied');
  }
  return patch;
}

/** Multipart upload fields. `category` is required; `name` defaults later. */
export function parseUploadFields(body: unknown): UploadFields {
  const record = asRecord(body);
  if (record.category === undefined) {
    throw invalid('category', 'category is required');
  }
  const patch = readMetadata(record);
  const fields: UploadFields = { ...patch, category: patch.category as string };
  if (record.source !== undefined && record.source !== '') {
    fields.source = boundedString('source', record.source, 200);
  }
  if (record.sourceUrl !== undefined && record.sourceUrl !== '') {
    const url = boundedString('sourceUrl', record.sourceUrl, 2048);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw invalid('sourceUrl', 'sourceUrl must be an absolute http(s) URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw invalid('sourceUrl', 'sourceUrl must be an absolute http(s) URL');
    }
    fields.sourceUrl = parsed.toString();
  }
  return fields;
}

export function parseBooleanFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

/**
 * The client filename is recorded as provenance text only — never used as a
 * path. Keep the last path component, drop control characters and bound it.
 */
export function sanitizeOriginalFilename(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const base = value.split(/[\\/]/).pop() ?? '';
  const cleaned = stripControlChars(base).trim().slice(0, 255);
  return cleaned || undefined;
}

export function defaultNameFromFilename(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  const withoutExt = filename.replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();
  return withoutExt ? withoutExt.slice(0, 200) : undefined;
}

/**
 * Optimistic concurrency: `expectedVersion` in the body, or an `If-Match`
 * header carrying the ETag returned by GET (`"<id>:<version>"`).
 */
export function parseExpectedVersion(
  body: unknown,
  ifMatch: string | undefined,
  assetId: string,
): number {
  const record = asRecord(body);
  if (record.expectedVersion !== undefined) {
    const version = record.expectedVersion;
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
      throw invalid('expectedVersion', 'expectedVersion must be a non-negative integer');
    }
    return version;
  }
  if (ifMatch) {
    const match = /^(?:W\/)?"([^"]+):(\d+)"$/.exec(ifMatch.trim());
    if (!match || match[1] !== assetId) {
      throw new AdminError(412, 'precondition-failed', 'If-Match does not match this asset');
    }
    return Number(match[2]);
  }
  throw new AdminError(
    428,
    'precondition-required',
    'Supply expectedVersion or an If-Match header',
  );
}

export function parseCampaignIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_CAMPAIGN_IDS) {
    throw invalid(
      'referencingCampaignIds',
      `referencingCampaignIds must be an array of at most ${MAX_CAMPAIGN_IDS} ids`,
    );
  }
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id !== 'string' || !ASSET_ID_PATTERN.test(id)) {
      throw invalid('referencingCampaignIds', 'referencingCampaignIds contains an invalid id');
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parseOptionalReason(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return boundedString('reason', value, 500);
}

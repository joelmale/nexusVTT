import type { AppDeps } from '../deps.js';
import type {
  DatabaseColumnSummary,
  DatabaseRowsResult,
  DatabaseTableSchema,
  DatabaseTableSummary,
} from '../store/types.js';
import { timedFetch } from './internal.js';

const CODEX_TABLE_NAMES = new Set([
  'documents',
  'document',
  'structured_data',
  'structureddata',
  'document_pages',
  'documentpage',
  'document_chunks',
  'documentchunk',
  'rules_entities',
  'rulesentity',
]);

export function isCodexTable(tableName: string): boolean {
  return CODEX_TABLE_NAMES.has(tableName.toLowerCase());
}

function normalizeCodexTableName(tableName: string): string {
  const lower = tableName.toLowerCase();
  if (lower === 'document' || lower === 'documents') return 'documents';
  if (lower === 'structureddata' || lower === 'structured_data') return 'structured_data';
  if (lower === 'documentpage' || lower === 'document_pages') return 'document_pages';
  if (lower === 'documentchunk' || lower === 'document_chunks') return 'document_chunks';
  if (lower === 'rulesentity' || lower === 'rules_entities') return 'rules_entities';
  return lower;
}

const DOCUMENTS_COLUMNS: DatabaseColumnSummary[] = [
  { columnName: 'id', ordinalPosition: 1, isNullable: false, dataType: 'uuid', udtName: 'uuid', columnDefault: 'gen_random_uuid()', characterMaximumLength: null, keyType: 'PRIMARY KEY', foreignKeyTarget: null, canSelect: true },
  { columnName: 'title', ordinalPosition: 2, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'description', ordinalPosition: 3, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: "''", characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'type', ordinalPosition: 4, isNullable: false, dataType: 'text', udtName: 'document_type', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'format', ordinalPosition: 5, isNullable: false, dataType: 'text', udtName: 'document_format', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'fileSize', ordinalPosition: 6, isNullable: false, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'pageCount', ordinalPosition: 7, isNullable: false, dataType: 'integer', udtName: 'int4', columnDefault: '0', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'author', ordinalPosition: 8, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: "''", characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'uploadedBy', ordinalPosition: 9, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: 'users(id)', canSelect: true },
  { columnName: 'ocrStatus', ordinalPosition: 10, isNullable: false, dataType: 'text', udtName: 'ocr_status', columnDefault: "'not_required'", characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'searchIndex', ordinalPosition: 11, isNullable: true, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'contentHash', ordinalPosition: 12, isNullable: true, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'isPublic', ordinalPosition: 13, isNullable: false, dataType: 'boolean', udtName: 'bool', columnDefault: 'false', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'tags', ordinalPosition: 14, isNullable: false, dataType: 'ARRAY', udtName: '_text', columnDefault: "'{}'", characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'collections', ordinalPosition: 15, isNullable: false, dataType: 'ARRAY', udtName: '_text', columnDefault: "'{}'", characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'campaigns', ordinalPosition: 16, isNullable: false, dataType: 'ARRAY', udtName: '_text', columnDefault: "'{}'", characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'uploadedAt', ordinalPosition: 17, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'lastModified', ordinalPosition: 18, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
];

const STRUCTURED_DATA_COLUMNS: DatabaseColumnSummary[] = [
  { columnName: 'id', ordinalPosition: 1, isNullable: false, dataType: 'uuid', udtName: 'uuid', columnDefault: 'gen_random_uuid()', characterMaximumLength: null, keyType: 'PRIMARY KEY', foreignKeyTarget: null, canSelect: true },
  { columnName: 'documentId', ordinalPosition: 2, isNullable: false, dataType: 'uuid', udtName: 'uuid', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: 'documents(id)', canSelect: true },
  { columnName: 'type', ordinalPosition: 3, isNullable: false, dataType: 'text', udtName: 'structured_data_type', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'name', ordinalPosition: 4, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'data', ordinalPosition: 5, isNullable: false, dataType: 'jsonb', udtName: 'jsonb', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'searchText', ordinalPosition: 6, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'pageNumber', ordinalPosition: 7, isNullable: true, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'section', ordinalPosition: 8, isNullable: true, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'searchIndex', ordinalPosition: 9, isNullable: true, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'createdAt', ordinalPosition: 10, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'updatedAt', ordinalPosition: 11, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
];

const DOCUMENT_PAGES_COLUMNS: DatabaseColumnSummary[] = [
  { columnName: 'id', ordinalPosition: 1, isNullable: false, dataType: 'uuid', udtName: 'uuid', columnDefault: 'gen_random_uuid()', characterMaximumLength: null, keyType: 'PRIMARY KEY', foreignKeyTarget: null, canSelect: true },
  { columnName: 'documentId', ordinalPosition: 2, isNullable: false, dataType: 'uuid', udtName: 'uuid', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: 'documents(id)', canSelect: true },
  { columnName: 'pageNumber', ordinalPosition: 3, isNullable: false, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'markdown', ordinalPosition: 4, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'blocks', ordinalPosition: 5, isNullable: false, dataType: 'jsonb', udtName: 'jsonb', columnDefault: "'[]'", characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'widthPt', ordinalPosition: 6, isNullable: true, dataType: 'double precision', udtName: 'float8', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'heightPt', ordinalPosition: 7, isNullable: true, dataType: 'double precision', udtName: 'float8', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'previewKey', ordinalPosition: 8, isNullable: true, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'engine', ordinalPosition: 9, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'createdAt', ordinalPosition: 10, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'updatedAt', ordinalPosition: 11, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
];

const DOCUMENT_CHUNKS_COLUMNS: DatabaseColumnSummary[] = [
  { columnName: 'id', ordinalPosition: 1, isNullable: false, dataType: 'uuid', udtName: 'uuid', columnDefault: 'gen_random_uuid()', characterMaximumLength: null, keyType: 'PRIMARY KEY', foreignKeyTarget: null, canSelect: true },
  { columnName: 'documentId', ordinalPosition: 2, isNullable: false, dataType: 'uuid', udtName: 'uuid', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: 'documents(id)', canSelect: true },
  { columnName: 'chunkIndex', ordinalPosition: 3, isNullable: false, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'content', ordinalPosition: 4, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'tokenCount', ordinalPosition: 5, isNullable: true, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'pageStart', ordinalPosition: 6, isNullable: true, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'pageEnd', ordinalPosition: 7, isNullable: true, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'createdAt', ordinalPosition: 8, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
];

const RULES_ENTITIES_COLUMNS: DatabaseColumnSummary[] = [
  { columnName: 'id', ordinalPosition: 1, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: 'PRIMARY KEY', foreignKeyTarget: null, canSelect: true },
  { columnName: 'name', ordinalPosition: 2, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'entityType', ordinalPosition: 3, isNullable: false, dataType: 'text', udtName: 'text', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'currentRevisionNumber', ordinalPosition: 4, isNullable: true, dataType: 'integer', udtName: 'int4', columnDefault: null, characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'createdAt', ordinalPosition: 5, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
  { columnName: 'updatedAt', ordinalPosition: 6, isNullable: false, dataType: 'timestamp with time zone', udtName: 'timestamptz', columnDefault: 'now()', characterMaximumLength: null, keyType: null, foreignKeyTarget: null, canSelect: true },
];

export async function listCodexTables(deps: AppDeps): Promise<DatabaseTableSummary[]> {
  let docCount = 0;
  let docBytes = 0;
  try {
    const res = await timedFetch(
      deps,
      `${deps.config.docApiUrl}/api/admin/stats`,
      { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'nexus-control-api' } },
      2500,
      'upstream',
    );
    if (res.ok) {
      const stats = (await res.json()) as { totalDocuments?: number; totalStorageBytes?: number };
      docCount = Math.max(0, Number(stats.totalDocuments ?? 0));
      docBytes = Math.max(0, Number(stats.totalStorageBytes ?? 0));
    }
  } catch {
    // Graceful fallback if doc-api is down
  }

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
    return `${bytes} bytes`;
  };

  return [
    {
      tableName: 'documents',
      schemaName: 'codex',
      domain: 'codex',
      estimatedRows: docCount,
      totalBytes: docBytes,
      totalSize: formatSize(docBytes),
    },
    {
      tableName: 'structured_data',
      schemaName: 'codex',
      domain: 'codex',
      estimatedRows: docCount > 0 ? docCount * 25 : 0,
      totalBytes: 32768,
      totalSize: '32 kB',
    },
    {
      tableName: 'document_pages',
      schemaName: 'codex',
      domain: 'codex',
      estimatedRows: docCount > 0 ? docCount * 20 : 0,
      totalBytes: 65536,
      totalSize: '64 kB',
    },
    {
      tableName: 'document_chunks',
      schemaName: 'codex',
      domain: 'codex',
      estimatedRows: docCount > 0 ? docCount * 40 : 0,
      totalBytes: 65536,
      totalSize: '64 kB',
    },
    {
      tableName: 'rules_entities',
      schemaName: 'codex',
      domain: 'codex',
      estimatedRows: 350,
      totalBytes: 32768,
      totalSize: '32 kB',
    },
  ];
}

export function getCodexTableSchema(tableName: string): DatabaseTableSchema | null {
  if (!isCodexTable(tableName)) return null;
  const canonical = normalizeCodexTableName(tableName);

  switch (canonical) {
    case 'documents':
      return { tableName, columns: DOCUMENTS_COLUMNS };
    case 'structured_data':
      return { tableName, columns: STRUCTURED_DATA_COLUMNS };
    case 'document_pages':
      return { tableName, columns: DOCUMENT_PAGES_COLUMNS };
    case 'document_chunks':
      return { tableName, columns: DOCUMENT_CHUNKS_COLUMNS };
    case 'rules_entities':
      return { tableName, columns: RULES_ENTITIES_COLUMNS };
    default:
      return null;
  }
}

export async function getCodexTableRows(
  deps: AppDeps,
  tableName: string,
  options: {
    limit: number;
    offset: number;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
  },
): Promise<DatabaseRowsResult | null> {
  if (!isCodexTable(tableName)) return null;
  const canonical = normalizeCodexTableName(tableName);

  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
  const offset = Math.max(Number(options.offset) || 0, 0);

  try {
    if (canonical === 'documents') {
      const page = Math.floor(offset / limit) + 1;
      const res = await timedFetch(
        deps,
        `${deps.config.docApiUrl}/api/admin/documents?page=${page}&limit=${limit}`,
        { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'nexus-control-api' } },
        5000,
        'upstream',
      );
      if (res.ok) {
        const body = (await res.json()) as {
          documents?: Array<Record<string, unknown>>;
          pagination?: { total?: number };
        };
        const rawDocs = body.documents ?? [];
        const rows = rawDocs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          description: doc.description ?? '',
          type: doc.type,
          format: doc.format,
          fileSize: doc.fileSize,
          pageCount: doc.pageCount ?? 0,
          author: doc.author ?? '',
          uploadedBy: doc.uploadedBy,
          ocrStatus: doc.ocrStatus ?? 'completed',
          searchIndex: doc.searchIndex ?? null,
          contentHash: doc.contentHash ?? null,
          isPublic: doc.isPublic ?? false,
          tags: doc.tags ?? [],
          collections: doc.collections ?? [],
          campaigns: doc.campaigns ?? [],
          uploadedAt: doc.uploadedAt ?? null,
          lastModified: doc.lastModified ?? null,
        }));
        return {
          tableName,
          rows,
          totalCount: Number(body.pagination?.total ?? rows.length),
          limit,
          offset,
          permissionDenied: false,
        };
      }
    } else if (canonical === 'structured_data') {
      const res = await timedFetch(
        deps,
        `${deps.config.docApiUrl}/api/structured-data?limit=${limit}&offset=${offset}`,
        { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'nexus-control-api' } },
        5000,
        'upstream',
      );
      if (res.ok) {
        const items = (await res.json()) as Array<Record<string, unknown>>;
        const rows = (Array.isArray(items) ? items : []).map((item) => ({
          id: item.id,
          documentId: item.documentId,
          type: item.type,
          name: item.name,
          data: item.data ?? {},
          searchText: item.searchText ?? '',
          pageNumber: item.pageNumber ?? null,
          section: item.section ?? null,
          searchIndex: item.searchIndex ?? null,
          createdAt: item.createdAt ?? null,
          updatedAt: item.updatedAt ?? null,
        }));
        return {
          tableName,
          rows,
          totalCount: rows.length < limit && offset === 0 ? rows.length : rows.length + offset,
          limit,
          offset,
          permissionDenied: false,
        };
      }
    } else if (canonical === 'rules_entities') {
      const res = await timedFetch(
        deps,
        `${deps.config.docApiUrl}/api/rules/catalog/entities?limit=${limit}&offset=${offset}`,
        { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'nexus-control-api' } },
        5000,
        'upstream',
      );
      if (res.ok) {
        const body = (await res.json()) as { entities?: Array<Record<string, unknown>> };
        const list = body.entities ?? [];
        const rows = list.map((ent) => ({
          id: ent.id,
          name: ent.name,
          entityType: ent.entityType,
          currentRevisionNumber: ent.currentRevisionNumber ?? 1,
          createdAt: ent.createdAt ?? null,
          updatedAt: ent.updatedAt ?? null,
        }));
        return {
          tableName,
          rows,
          totalCount: rows.length < limit && offset === 0 ? rows.length : rows.length + offset,
          limit,
          offset,
          permissionDenied: false,
        };
      }
    }
  } catch {
    // If doc-api request times out or fails, return empty result gracefully
  }

  return {
    tableName,
    rows: [],
    totalCount: 0,
    limit,
    offset,
    permissionDenied: false,
  };
}

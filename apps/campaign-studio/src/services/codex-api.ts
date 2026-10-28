/**
 * API client for NexusCodex doc-api
 * Read-only access for browsing codex documents
 */

type RuntimeConfig = {
  DOC_API_URL?: string;
  WEBSOCKET_URL?: string;
};

const runtimeConfig =
  typeof window !== 'undefined' ? (window as Window & { __NEXUSCODEX_CONFIG__?: RuntimeConfig }).__NEXUSCODEX_CONFIG__ : undefined;

const rawApiUrl =
  runtimeConfig?.DOC_API_URL ||
  import.meta.env.VITE_DOC_API_URL ||
  '/codex-api';

const API_URL = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

export interface Document {
  id: string;
  title: string;
  description?: string;
  type: string;
  tags: string[];
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  documents: Document[];
  total: number;
}

export interface StructuredData {
  id: string;
  documentId: string;
  type: string;
  name: string;
  data: Record<string, unknown>;
  searchText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDocument(hit: unknown): Document {
  const item = isRecord(hit) ? hit : {};
  return {
    id: String(item.documentId || item.id || ''),
    title: String(item.title || 'Untitled Document'),
    description:
      typeof item.snippet === 'string'
        ? item.snippet
        : typeof item.description === 'string'
          ? item.description
          : undefined,
    type: String(item.type || 'other'),
    tags: Array.isArray(item.tags)
      ? item.tags.filter((t): t is string => typeof t === 'string')
      : [],
    fileSize: typeof item.fileSize === 'number' ? item.fileSize : 0,
    uploadedBy: String(item.uploadedBy || 'system'),
    uploadedAt: String(item.uploadedAt || new Date().toISOString()),
    status: String(item.status || 'ready'),
    metadata: isRecord(item.metadata) ? item.metadata : undefined,
  };
}

function normalizeSearchResult(data: unknown): SearchResult {
  if (!isRecord(data)) {
    if (Array.isArray(data)) {
      return {
        documents: data.map(normalizeDocument),
        total: data.length,
      };
    }
    return { documents: [], total: 0 };
  }

  // If the API returned { documents, total } directly
  if (Array.isArray(data.documents)) {
    return {
      documents: data.documents.map(normalizeDocument),
      total:
        typeof data.total === 'number'
          ? data.total
          : data.documents.length,
    };
  }

  // If the API returned doc-api QuickSearch response: { query, results }
  if (Array.isArray(data.results)) {
    const documents = data.results.map(normalizeDocument);
    return {
      documents,
      total: typeof data.total === 'number' ? data.total : documents.length,
    };
  }

  return { documents: [], total: 0 };
}

/**
 * Search documents using doc-api /api/search/quick
 */
export async function searchDocuments(params: {
  term?: string;
  query?: string;
  type?: string;
  tags?: string[];
  limit?: number;
  size?: number;
  offset?: number;
}): Promise<SearchResult> {
  const query = (params.query ?? params.term ?? '').trim();
  if (!query) {
    return { documents: [], total: 0 };
  }

  const queryParams = new URLSearchParams();
  queryParams.append('query', query);

  const size = params.size ?? params.limit;
  if (size !== undefined) {
    queryParams.append('size', size.toString());
  }
  if (params.type) {
    queryParams.append('type', params.type);
  }
  if (params.tags) {
    params.tags.forEach((tag) => queryParams.append('tags', tag));
  }

  const response = await fetch(`${API_URL}/api/search/quick?${queryParams}`);

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return normalizeSearchResult(data);
}

/**
 * List documents with optional filters
 */
export async function listDocuments(params: {
  type?: string;
  tag?: string;
  campaign?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<SearchResult> {
  const queryParams = new URLSearchParams();

  if (params.type) queryParams.append('type', params.type);
  if (params.tag) queryParams.append('tag', params.tag);
  if (params.campaign) queryParams.append('campaign', params.campaign);
  if (params.search) queryParams.append('search', params.search);
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());

  const response = await fetch(`${API_URL}/api/documents?${queryParams}`);

  if (!response.ok) {
    throw new Error(`Failed to list documents: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return normalizeSearchResult(data);
}

/**
 * Get document by ID
 */
export async function getDocument(id: string): Promise<Document> {
  const response = await fetch(`${API_URL}/api/documents/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return normalizeDocument(data);
}

/**
 * Get document content (for preview)
 */
export async function getDocumentContent(id: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/documents/${id}/content`);

  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * Get structured data by document ID
 */
export async function getStructuredData(documentId: string): Promise<StructuredData[]> {
  const response = await fetch(`${API_URL}/api/structured-data?documentId=${documentId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch structured data: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  if (Array.isArray(data)) {
    return data as StructuredData[];
  }
  if (isRecord(data) && Array.isArray(data.data)) {
    return data.data as StructuredData[];
  }
  return [];
}

/**
 * Search structured data (spells, monsters, items)
 */
export async function searchStructuredData(params: {
  type?: string;
  name?: string;
  limit?: number;
}): Promise<StructuredData[]> {
  const queryParams = new URLSearchParams();

  if (params.type) queryParams.append('type', params.type);
  if (params.name) queryParams.append('name', params.name);
  if (params.limit) queryParams.append('limit', params.limit.toString());

  const response = await fetch(`${API_URL}/api/structured-data?${queryParams}`);

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  if (Array.isArray(data)) {
    return data as StructuredData[];
  }
  if (isRecord(data) && Array.isArray(data.data)) {
    return data.data as StructuredData[];
  }
  return [];
}

export const DEFAULT_DOCUMENT_TYPES: readonly string[] = [
  'srd_content',
  'rulebook',
  'adventure',
  'supplement',
  'homebrew',
  'other',
];

/**
 * Get document types (for filtering)
 */
export async function getDocumentTypes(): Promise<string[]> {
  try {
    const { documents } = await listDocuments({ limit: 100 });
    const types = new Set<string>();
    for (const doc of documents) {
      if (doc.type) types.add(doc.type);
    }
    if (types.size > 0) {
      return Array.from(types).sort();
    }
  } catch {
    // Fall back to known default types
  }
  return [...DEFAULT_DOCUMENT_TYPES];
}

export const DEFAULT_TAGS: readonly string[] = [
  'srd',
  'spell',
  'monster',
  'magic-item',
  'equipment',
  'class',
  'race',
  'background',
  'feat',
  'condition',
  'rule',
];

/**
 * Get available tags
 */
export async function getAvailableTags(): Promise<string[]> {
  try {
    const { documents } = await listDocuments({ limit: 100 });
    const tags = new Set<string>();
    for (const doc of documents) {
      if (Array.isArray(doc.tags)) {
        for (const tag of doc.tags) {
          if (tag) tags.add(tag);
        }
      }
    }
    if (tags.size > 0) {
      return Array.from(tags).sort();
    }
  } catch {
    // Fall back to default tags
  }
  return [...DEFAULT_TAGS];
}

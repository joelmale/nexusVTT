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

const API_URL =
  runtimeConfig?.DOC_API_URL ||
  import.meta.env.VITE_DOC_API_URL ||
  '';

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

/**
 * Search documents
 */
export async function searchDocuments(params: {
  term?: string;
  type?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<SearchResult> {
  const queryParams = new URLSearchParams();

  if (params.term) queryParams.append('term', params.term);
  if (params.type) queryParams.append('type', params.type);
  if (params.tags) params.tags.forEach(tag => queryParams.append('tags', tag));
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());

  const response = await fetch(`${API_URL}/api/search/quick?${queryParams}`);

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get document by ID
 */
export async function getDocument(id: string): Promise<Document> {
  const response = await fetch(`${API_URL}/api/documents/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  return response.json();
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

  const data = await response.json();
  return data.data || [];
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

  const data = await response.json();
  return data.data || [];
}

/**
 * Get document types (for filtering)
 */
export async function getDocumentTypes(): Promise<string[]> {
  // This would ideally come from the API, but for now we'll use known types
  return [
    'srd_content',
    'rulebook',
    'adventure',
    'supplement',
    'homebrew',
    'other'
  ];
}

/**
 * Get available tags
 */
export async function getAvailableTags(): Promise<string[]> {
  // TODO: Implement when admin API endpoint is available
  // For now, return common SRD tags
  return [
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
    'rule'
  ];
}

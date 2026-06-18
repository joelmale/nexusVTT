/**
 * DocumentServiceClient - HTTP client for NexusCodex document services
 *
 * This client communicates with the separate NexusCodex microservices to provide
 * document management capabilities within Nexus VTT. The services remain independent
 * but are accessible through this authenticated proxy.
 */

/**
 * Document type from NexusCodex
 */
export type DocumentType =
  | 'rulebook'
  | 'campaign_note'
  | 'handout'
  | 'map'
  | 'character_sheet'
  | 'homebrew'
  | 'srd_content';

/**
 * Document format
 */
export type DocumentFormat = 'pdf' | 'markdown' | 'html';

/**
 * Document metadata from NexusCodex API
 */
export interface Document {
  id: string;
  title: string;
  description: string;
  type: DocumentType;
  format: DocumentFormat;
  storageKey: string;
  fileSize: number;
  author?: string;
  uploadedBy: string;
  tags: string[];
  collections: string[];
  campaigns: string[];
  isPublic: boolean;
  metadata: Record<string, unknown>;
  uploadedAt: Date;
  updatedAt: Date;
  thumbnailKey?: string;
}

/**
 * Parameters for creating a new document
 */
export interface CreateDocumentParams {
  title: string;
  description?: string;
  type: DocumentType;
  format: DocumentFormat;
  author?: string;
  uploadedBy: string;
  tags?: string[];
  collections?: string[];
  campaigns?: string[];
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
  fileSize: number;
  fileName: string;
}

/**
 * Response from creating a document
 */
export interface CreateDocumentResponse {
  document: Document;
  uploadUrl: string;
  expiresIn: number;
}

/**
 * Parameters for listing documents
 */
export interface ListDocumentsParams {
  skip?: number;
  limit?: number;
  type?: DocumentType;
  campaign?: string;
  tag?: string;
  search?: string;
}

/**
 * Response from listing documents
 */
export interface ListDocumentsResponse {
  documents: Document[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
  };
}

/**
 * Parameters for searching documents
 */
export interface SearchParams {
  query: string;
  type?: DocumentType;
  campaigns?: string[];
  tags?: string[];
  from?: number;
  size?: number;
}

/**
 * Search result item
 */
export interface SearchResult {
  documentId: string;
  source: {
    title: string;
    type: DocumentType;
    description: string;
    campaigns: string[];
    tags: string[];
  };
  score: number;
  highlights?: {
    content?: string[];
    title?: string[];
    description?: string[];
  };
}

/**
 * Response from search endpoint
 */
export interface SearchResponse {
  query: string;
  total: number;
  from: number;
  size: number;
  results: SearchResult[];
}

/**
 * Quick search result
 */
export interface QuickSearchResult {
  documentId: string;
  title: string;
  type: DocumentType;
  score: number;
  snippet: string;
}

/**
 * Response from quick search endpoint
 */
export interface QuickSearchResponse {
  query: string;
  results: QuickSearchResult[];
}

export interface SemanticSearchResult {
  chunkId: string;
  documentId: string;
  document: {
    id: string;
    title: string;
    type: string;
  };
  pageStart: number;
  pageEnd: number;
  contentSnippet: string;
  score: number;
}

export interface SemanticSearchResponse {
  query: string;
  total: number;
  provider: string;
  results: SemanticSearchResult[];
}

export interface AskSearchCitation {
  sourceIndex: number;
  documentId: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  chunkId: string;
  confidence: number;
}

export interface AskSearchResponse {
  question: string;
  answer: string;
  confidence: number;
  citations: AskSearchCitation[];
  snippets: string[];
  followups: string[];
}

/**
 * Configuration for DocumentServiceClient
 */
export interface DocumentServiceConfig {
  /** Base URL for doc-api service (e.g., http://doc-api:3000) */
  apiUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Client for communicating with NexusCodex document services
 *
 * This client acts as an authenticated proxy between Nexus VTT and the
 * separate NexusCodex microservices. It maintains service independence
 * while providing seamless integration.
 */
export class DocumentServiceClient {
  private apiUrl: string;
  private timeout: number;

  /**
   * Creates a new DocumentServiceClient
   * @param config - Configuration options
   */
  constructor(config: DocumentServiceConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make a request to the doc-api service
   * @private
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = (await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        throw new Error(error.error || `Request failed: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Create a new document and get a signed upload URL
   * @param params - Document creation parameters
   * @param userId - ID of the user creating the document
   */
  async createDocument(
    params: CreateDocumentParams,
    userId: string
  ): Promise<CreateDocumentResponse> {
    return this.request<CreateDocumentResponse>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        uploadedBy: userId,
      }),
    });
  }

  /**
   * List documents with optional filtering
   * @param params - List parameters
   */
  async listDocuments(params: ListDocumentsParams = {}): Promise<ListDocumentsResponse> {
    const queryParams = new URLSearchParams();

    if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.type) queryParams.append('type', params.type);
    if (params.campaign) queryParams.append('campaign', params.campaign);
    if (params.tag) queryParams.append('tag', params.tag);
    if (params.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    const endpoint = query ? `/api/documents?${query}` : '/api/documents';

    return this.request<ListDocumentsResponse>(endpoint);
  }

  /**
   * Get document metadata by ID
   * @param documentId - Document ID
   */
  async getDocument(documentId: string): Promise<Document> {
    return this.request<Document>(`/api/documents/${documentId}`);
  }

  /**
   * Get document content URL
   * @param documentId - Document ID
   * @returns URL to stream document content
   */
  getDocumentContentUrl(documentId: string): string {
    return `${this.apiUrl}/api/documents/${documentId}/content`;
  }

  /**
   * Update document metadata
   * @param documentId - Document ID
   * @param updates - Fields to update
   */
  async updateDocument(
    documentId: string,
    updates: Partial<CreateDocumentParams>
  ): Promise<Document> {
    return this.request<Document>(`/api/documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a document
   * @param documentId - Document ID
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.request<void>(`/api/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Search documents with full-text search
   * @param params - Search parameters
   */
  async searchDocuments(params: SearchParams): Promise<SearchResponse> {
    const queryParams = new URLSearchParams();

    queryParams.append('query', params.query);
    if (params.type) queryParams.append('type', params.type);
    if (params.campaigns) queryParams.append('campaigns', params.campaigns.join(','));
    if (params.tags) queryParams.append('tags', params.tags.join(','));
    if (params.from !== undefined) queryParams.append('from', params.from.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());

    return this.request<SearchResponse>(`/api/search?${queryParams.toString()}`);
  }

  /**
   * Quick search for top results
   * @param query - Search query
   * @param campaign - Optional campaign filter
   * @param size - Number of results (default: 5)
   */
  async quickSearch(
    query: string,
    campaign?: string,
    size: number = 5
  ): Promise<QuickSearchResponse> {
    const queryParams = new URLSearchParams();

    queryParams.append('query', query);
    if (campaign) queryParams.append('campaign', campaign);
    queryParams.append('size', size.toString());

    return this.request<QuickSearchResponse>(`/api/search/quick?${queryParams.toString()}`);
  }

  /**
   * Hybrid semantic search over document chunks
   * @param params - Search parameters
   */
  async semanticSearch(params: SearchParams & { topK?: number }): Promise<SemanticSearchResponse> {
    const queryParams = new URLSearchParams();

    queryParams.append('query', params.query);
    if (params.type) queryParams.append('type', params.type);
    if (params.campaigns) queryParams.append('campaigns', params.campaigns.join(','));
    if (params.tags) queryParams.append('tags', params.tags.join(','));
    if (params.topK !== undefined) queryParams.append('topK', params.topK.toString());

    return this.request<SemanticSearchResponse>(`/api/search/semantic?${queryParams.toString()}`);
  }

  /**
   * Grounded Ask Q&A search using retrieved document chunks
   * @param question - Natural language question
   * @param filters - Optional filters (type, campaigns, tags, topK)
   */
  async ask(
    question: string,
    filters?: { type?: DocumentType; campaigns?: string[]; tags?: string[]; topK?: number }
  ): Promise<AskSearchResponse> {
    return this.request<AskSearchResponse>('/api/search/ask', {
      method: 'POST',
      body: JSON.stringify({
        question,
        ...filters,
      }),
    });
  }

  /**
   * Health check for the document service
   */
  async healthCheck(): Promise<{ status: string; database: string }> {
    return this.request<{ status: string; database: string }>('/health');
  }

  /**
   * Get all structured data for a document
   */
  async getDocumentStructuredData(
    documentId: string,
    params?: { type?: string; name?: string }
  ): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.name) queryParams.append('name', params.name);
    const query = queryParams.toString();
    const endpoint = query
      ? `/api/documents/${documentId}/structured-data?${query}`
      : `/api/documents/${documentId}/structured-data`;
    return this.request<any[]>(endpoint);
  }

  /**
   * Get specific structured data entry by ID
   */
  async getStructuredDataById(id: string): Promise<any> {
    return this.request<any>(`/api/structured-data/${id}`);
  }

  /**
   * List structured data with filtering
   */
  async listStructuredData(params?: {
    documentId?: string;
    type?: string;
    name?: string;
    search?: string;
    limit?: string;
    offset?: string;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.documentId) queryParams.append('documentId', params.documentId);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.name) queryParams.append('name', params.name);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.limit) queryParams.append('limit', params.limit);
    if (params?.offset) queryParams.append('offset', params.offset);
    const query = queryParams.toString();
    const endpoint = query ? `/api/structured-data?${query}` : '/api/structured-data';
    return this.request<any[]>(endpoint);
  }
}

/**
 * Create a DocumentServiceClient instance
 * @param apiUrl - Base URL for doc-api service
 */
export function createDocumentServiceClient(apiUrl: string): DocumentServiceClient {
  return new DocumentServiceClient({ apiUrl });
}

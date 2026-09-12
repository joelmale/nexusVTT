/**
 * Document Service - Frontend API client for NexusCodex documents
 *
 * This service provides document management capabilities to the Nexus VTT frontend
 * by communicating with the Nexus VTT backend, which acts as an authenticated proxy
 * to the separate NexusCodex microservices.
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
 * Document metadata
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
    type: DocumentType;
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
 * A named trait/ability on a raw 5e SRD monster entity.
 */
export interface SrdSpecialAbility {
  name?: string;
  desc?: string;
}

/**
 * Raw 5e SRD entity payload (spell, monster, item, etc.). The shape varies by
 * entity type, so all fields are optional and consumers apply fallbacks. The
 * index signature accommodates SRD fields we don't explicitly consume.
 */
export interface SrdEntityData {
  name?: string;
  // Spell fields
  level?: number;
  school?: { name?: string } | string;
  casting_time?: string;
  range?: string;
  components?: string[] | string;
  duration?: string;
  desc?: string[] | string;
  // Monster fields
  size?: string;
  type?: string;
  alignment?: string;
  armor_class?: Array<{ value?: number }> | number;
  hit_points?: number;
  speed?: Record<string, string | number> | string;
  challenge_rating?: number;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  special_abilities?: SrdSpecialAbility[];
  [key: string]: unknown;
}

/**
 * A structured data entry extracted from a document (a spell, monster, item…).
 */
export interface StructuredEntity {
  id?: string;
  documentId?: string;
  type: string;
  name?: string;
  data: SrdEntityData;
}

/**
 * Document service class for frontend
 */
class DocumentService {
  private baseUrl: string;
  private initialized = false;

  constructor() {
    // In production, use relative path (nginx proxy handles routing)
    // In development, use localhost with port
    this.baseUrl = import.meta.env.DEV
      ? import.meta.env.VITE_API_URL || 'http://localhost:5001'
      : ''; // Empty string = relative URLs in production
    this.initialized = true;
  }

  /**
   * Make a request to the API
   * @private
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        // Surface clearer message when the document service is disabled/offline
        if (response.status === 503) {
          throw new Error(
            error.error ||
              'Document service unavailable. Start NexusCodex or set DOC_API_URL/VITE_DOC_API_URL.',
          );
        }

        throw new Error(error.error || `Request failed: ${response.status}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      console.error(`Document service error [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * Create a new document and get a signed upload URL
   * @param params - Document creation parameters
   */
  async createDocument(params: CreateDocumentParams): Promise<CreateDocumentResponse> {
    return this.request<CreateDocumentResponse>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Upload a file to the signed URL
   * @param uploadUrl - Signed upload URL from createDocument
   * @param file - File to upload
   */
  async uploadFile(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
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
   * Get document content URL for streaming/downloading
   * @param documentId - Document ID
   */
  async getDocumentContentUrl(documentId: string): Promise<string> {
    const response = await this.request<{ contentUrl: string }>(
      `/api/documents/${documentId}/content`
    );
    return response.contentUrl;
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
    return this.request<void>(`/api/documents/${documentId}`, {
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
   * @param query - Search query
   * @param filters - Optional filters (type, campaigns, tags, topK)
   */
  async semanticSearch(
    query: string,
    filters?: { type?: DocumentType; campaigns?: string[]; tags?: string[]; topK?: number }
  ): Promise<SemanticSearchResponse> {
    const queryParams = new URLSearchParams();

    queryParams.append('query', query);
    if (filters?.type) queryParams.append('type', filters.type);
    if (filters?.campaigns) queryParams.append('campaigns', filters.campaigns.join(','));
    if (filters?.tags) queryParams.append('tags', filters.tags.join(','));
    if (filters?.topK !== undefined) queryParams.append('topK', filters.topK.toString());

    return this.request<SemanticSearchResponse>(`/api/search/semantic?${queryParams.toString()}`);
  }

  /**
   * Grounded Ask Q&A search using document chunks
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
    return this.request<{ status: string; database: string }>('/api/health');
  }

  /**
   * Get all structured data for a document
   */
  async getDocumentStructuredData(
    documentId: string,
    params?: { type?: string; name?: string }
  ): Promise<StructuredEntity[]> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.name) queryParams.append('name', params.name);
    const query = queryParams.toString();
    const endpoint = query
      ? `/api/documents/${documentId}/structured-data?${query}`
      : `/api/documents/${documentId}/structured-data`;
    return this.request<StructuredEntity[]>(endpoint);
  }

  /**
   * Get specific structured data entry by ID
   */
  async getStructuredDataById(id: string): Promise<StructuredEntity> {
    return this.request<StructuredEntity>(`/api/structured-data/${id}`);
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
  }): Promise<StructuredEntity[]> {
    const queryParams = new URLSearchParams();
    if (params?.documentId) queryParams.append('documentId', params.documentId);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.name) queryParams.append('name', params.name);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.limit) queryParams.append('limit', params.limit);
    if (params?.offset) queryParams.append('offset', params.offset);
    const query = queryParams.toString();
    const endpoint = query ? `/api/structured-data?${query}` : '/api/structured-data';
    return this.request<StructuredEntity[]>(endpoint);
  }

  /**
   * Get a JWT token for the document WebSocket connection
   */
  async getWsToken(): Promise<string> {
    const response = await this.request<{ token: string }>('/api/documents/ws-token');
    return response.token;
  }
}

// Export singleton instance
export const documentService = new DocumentService();

// Export class for testing
export { DocumentService };

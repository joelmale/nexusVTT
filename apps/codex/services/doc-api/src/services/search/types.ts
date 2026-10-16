export interface SearchFilters {
  type?: string;
  campaigns?: string[];
  tags?: string[];
  uploadedBy?: string;
  uploadedAfter?: Date;
  uploadedBefore?: Date;
}

export interface SearchParams {
  query: string;
  filters?: SearchFilters;
  from?: number;
  size?: number;
}

export interface AdvancedSearchParams extends SearchParams {
  sortBy?: 'relevance' | 'uploadedAt' | 'title' | 'fileSize';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchHit {
  /** Postgres document id. */
  documentId: string;
  score: number;
  source: Record<string, any>;
  /** Highlighted fragments wrapped in <em>…</em>, keyed by field. */
  highlights?: Record<string, string[]>;
}

export interface SearchResult {
  total: number;
  hits: SearchHit[];
}

/** The read side of document search. */
export interface SearchProvider {
  search(params: SearchParams): Promise<SearchResult>;
  advancedSearch(params: AdvancedSearchParams): Promise<SearchResult>;
  searchWithinDocument(params: { documentId: string; query: string; size?: number }): Promise<SearchResult>;
  documentExists(documentId: string): Promise<boolean>;
}

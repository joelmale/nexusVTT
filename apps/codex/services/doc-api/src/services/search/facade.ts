import { elasticService } from '../elastic.service';
import { searchShadowOverlap, searchShadowTotal } from '../../observability/metrics';
import type {
  AdvancedSearchParams,
  SearchParams,
  SearchProvider,
  SearchProviderName,
  SearchResult,
} from './types';

const OVERLAP_WINDOW = 10;

function overlap(primary: SearchResult, shadow: SearchResult): number {
  const a = primary.hits.slice(0, OVERLAP_WINDOW).map((hit) => hit.documentId);
  const b = new Set(shadow.hits.slice(0, OVERLAP_WINDOW).map((hit) => hit.documentId));
  if (!a.length && !b.size) return 1;
  return a.filter((id) => b.has(id)).length / Math.max(a.length, b.size, 1);
}

/**
 * Routes search to Elasticsearch, Postgres, or both. In `both` mode
 * Elasticsearch answers the request and Postgres runs alongside it so the two
 * can be compared (metrics and a log line) before cutting over.
 */
export class SearchFacade implements SearchProvider {
  constructor(
    readonly mode: SearchProviderName,
    private readonly elastic: SearchProvider,
    private readonly postgres: SearchProvider,
  ) {}

  /** True while documents are still written to the Elasticsearch index. */
  get writesToElastic(): boolean {
    return this.mode !== 'postgres';
  }

  private async dispatch(
    operation: string,
    run: (provider: SearchProvider) => Promise<SearchResult>,
  ): Promise<SearchResult> {
    if (this.mode === 'elastic') return run(this.elastic);
    if (this.mode === 'postgres') return run(this.postgres);

    const [primary, shadow] = await Promise.allSettled([run(this.elastic), run(this.postgres)]);
    if (primary.status === 'rejected') throw primary.reason;
    if (shadow.status === 'rejected') {
      searchShadowTotal.inc({ operation, result: 'error' });
      console.warn(`[search] postgres shadow ${operation} failed: ${shadow.reason?.message ?? shadow.reason}`);
    } else {
      const score = overlap(primary.value, shadow.value);
      searchShadowTotal.inc({ operation, result: score === 1 ? 'match' : 'diff' });
      searchShadowOverlap.observe({ operation }, score);
      if (score < 1) {
        console.info(
          `[search] ${operation} overlap@${OVERLAP_WINDOW}=${score.toFixed(2)} ` +
            `elastic=${primary.value.total} postgres=${shadow.value.total}`,
        );
      }
    }
    return primary.value;
  }

  search(params: SearchParams) {
    return this.dispatch('search', (provider) => provider.search(params));
  }

  advancedSearch(params: AdvancedSearchParams) {
    return this.dispatch('advancedSearch', (provider) => provider.advancedSearch(params));
  }

  searchWithinDocument(params: { documentId: string; query: string; size?: number }) {
    return this.dispatch('searchWithinDocument', (provider) => provider.searchWithinDocument(params));
  }

  /**
   * For comparison runs: in 'both' mode a caller may choose which engine answers
   * (the x-search-provider header on /api/search/advanced). Otherwise the facade.
   */
  forRequest(requested?: string | string[]): SearchProvider {
    const name = Array.isArray(requested) ? requested[0] : requested;
    if (this.mode !== 'both') return this;
    if (name === 'elastic') return this.elastic;
    if (name === 'postgres') return this.postgres;
    return this;
  }

  documentExists(documentId: string): Promise<boolean> {
    return (this.mode === 'postgres' ? this.postgres : this.elastic).documentExists(documentId);
  }

  /** Remove a document's Elasticsearch entry; Postgres rows cascade with the document. */
  async removeFromIndex(searchIndex: string | null | undefined): Promise<void> {
    if (this.writesToElastic && searchIndex) {
      await elasticService.deleteDocument(searchIndex);
    }
  }
}


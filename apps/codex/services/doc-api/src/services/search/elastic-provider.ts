import { elasticService } from '../elastic.service';
import { prisma } from '../database.service';
import type {
  AdvancedSearchParams,
  SearchHit,
  SearchParams,
  SearchProvider,
  SearchResult,
} from './types';

/**
 * Elasticsearch ids are the Postgres document id for documents indexed by
 * doc-processor, but SRD imports were indexed without one. Resolve those back
 * to the Postgres id through documents.searchIndex so every provider reports
 * the same documentId.
 */
async function withPostgresIds(raw: { total?: number; hits: SearchHit[] }): Promise<SearchResult> {
  const result: SearchResult = { total: raw.total ?? 0, hits: raw.hits };
  const unresolved = result.hits.filter((hit) => !hit.source?.documentId).map((hit) => hit.documentId);
  if (!unresolved.length) return result;

  const rows = await prisma.document.findMany({
    where: { searchIndex: { in: unresolved } },
    select: { id: true, searchIndex: true },
  });
  const byIndex = new Map(rows.map((row) => [row.searchIndex as string, row.id]));

  const hits: SearchHit[] = result.hits.map((hit) =>
    hit.source?.documentId
      ? { ...hit, documentId: String(hit.source.documentId) }
      : { ...hit, documentId: byIndex.get(hit.documentId) ?? hit.documentId },
  );
  return { total: result.total, hits };
}

export class ElasticSearchProvider implements SearchProvider {
  async search(params: SearchParams): Promise<SearchResult> {
    return withPostgresIds(await elasticService.search(params));
  }

  async advancedSearch(params: AdvancedSearchParams): Promise<SearchResult> {
    return withPostgresIds(await elasticService.advancedSearch(params));
  }

  async searchWithinDocument(params: { documentId: string; query: string; size?: number }): Promise<SearchResult> {
    return withPostgresIds(await elasticService.searchWithinDocument(params));
  }

  documentExists(documentId: string): Promise<boolean> {
    return elasticService.documentExists(documentId);
  }
}

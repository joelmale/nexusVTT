import { Prisma } from '@prisma/client';
import { prisma } from '../database.service';
import { postgresSearchDurationSeconds } from '../../observability/metrics';
import { buildOrTsQuery, FRAGMENT_DELIMITER, splitHeadline } from './query';
import type {
  AdvancedSearchParams,
  SearchFilters,
  SearchHit,
  SearchParams,
  SearchProvider,
  SearchResult,
} from './types';

const HEADLINE_OPTIONS = `StartSel=<em>, StopSel=</em>, MaxFragments=3, MaxWords=28, MinWords=10, FragmentDelimiter="${FRAGMENT_DELIMITER}"`;
const TITLE_HEADLINE_OPTIONS = 'StartSel=<em>, StopSel=</em>, HighlightAll=true';

/** Whitelisted ORDER BY columns; never interpolate caller input. */
const SORT_COLUMNS: Record<string, string> = {
  uploadedAt: '"uploadedAt"',
  title: '"title"',
  fileSize: '"fileSize"',
};

interface Row {
  id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  collections: string[];
  campaigns: string[];
  uploadedBy: string;
  uploadedAt: Date;
  fileSize: number;
  score: number;
  total: bigint | number;
}

async function timed<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    return await run();
  } finally {
    postgresSearchDurationSeconds.observe({ operation }, Number(process.hrtime.bigint() - start) / 1e9);
  }
}

function filterClauses(filters: SearchFilters | undefined, documentId?: string): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];
  if (documentId) clauses.push(Prisma.sql`d."id" = ${documentId}`);
  if (filters?.type) clauses.push(Prisma.sql`d."type" = ${filters.type}::"DocumentType"`);
  if (filters?.campaigns?.length) clauses.push(Prisma.sql`d."campaigns" && ${filters.campaigns}::text[]`);
  if (filters?.tags?.length) clauses.push(Prisma.sql`d."tags" && ${filters.tags}::text[]`);
  if (filters?.uploadedBy) clauses.push(Prisma.sql`d."uploadedBy" = ${filters.uploadedBy}`);
  if (filters?.uploadedAfter) clauses.push(Prisma.sql`d."uploadedAt" >= ${filters.uploadedAfter}`);
  if (filters?.uploadedBefore) clauses.push(Prisma.sql`d."uploadedAt" <= ${filters.uploadedBefore}`);
  return clauses;
}

function toSource(row: Row): Record<string, unknown> {
  return {
    documentId: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    tags: row.tags,
    collections: row.collections,
    campaigns: row.campaigns,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt instanceof Date ? row.uploadedAt.toISOString() : row.uploadedAt,
    fileSize: row.fileSize,
  };
}

/**
 * Full-text search over Postgres. Three sources are ranked together:
 * document metadata (title/description/tags, weighted), extracted text
 * (document_chunks) and structured SRD entries (structured_data). Typos in the
 * title are caught by pg_trgm similarity.
 */
export class PostgresSearchProvider implements SearchProvider {
  private async run(
    operation: string,
    params: AdvancedSearchParams,
    documentId?: string,
  ): Promise<SearchResult> {
    const raw = params.query.trim();
    const tsString = buildOrTsQuery(raw);
    const hasText = raw.length > 0;
    const size = Math.max(1, params.size ?? 20);
    const from = Math.max(0, params.from ?? 0);

    const where = filterClauses(params.filters, documentId);
    if (hasText) {
      where.push(Prisma.sql`(
        d."searchVector" @@ q.tsq
        OR ch.id IS NOT NULL
        OR sd.id IS NOT NULL
        OR d."title" % ${raw}::text
      )`);
    }
    const whereSql = where.length ? Prisma.join(where, ' AND ') : Prisma.sql`TRUE`;

    const direction = params.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const sortColumn = params.sortBy && SORT_COLUMNS[params.sortBy];
    const orderSql =
      hasText && !sortColumn
        ? Prisma.sql`score ${direction}, d."uploadedAt" DESC, d."id"`
        : Prisma.sql`d.${Prisma.raw(sortColumn ?? '"uploadedAt"')} ${direction}, d."id"`;
    const scoreSql = hasText
      ? Prisma.sql`(
          COALESCE(ts_rank_cd(d."searchVector", q.tsq, 32), 0) * 3
          + COALESCE(ch.rank, 0)
          + COALESCE(sd.rank, 0) * 2
          + similarity(d."title", ${raw}::text) * 1.5
        )::float8`
      : Prisma.sql`0::float8`;

    return timed(operation, async () => {
      const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
        WITH q AS (
          SELECT CASE WHEN ${tsString}::text = '' THEN NULL ELSE to_tsquery('english', ${tsString}::text) END AS tsq
        ),
        chunk_hits AS (
          SELECT c."documentId" AS id, max(ts_rank_cd(c."searchVector", q.tsq, 32)) AS rank
          FROM "document_chunks" c, q
          WHERE q.tsq IS NOT NULL AND c."searchVector" @@ q.tsq
          GROUP BY c."documentId"
        ),
        structured_hits AS (
          SELECT s."documentId" AS id, max(ts_rank_cd(s."searchVector", q.tsq, 32)) AS rank
          FROM "structured_data" s, q
          WHERE q.tsq IS NOT NULL AND s."searchVector" @@ q.tsq
          GROUP BY s."documentId"
        )
        SELECT d."id", d."title", d."description", d."type"::text AS type, d."tags", d."collections",
               d."campaigns", d."uploadedBy", d."uploadedAt", d."fileSize",
               ${scoreSql} AS score,
               count(*) OVER () AS total
        FROM "documents" d
        CROSS JOIN q
        LEFT JOIN chunk_hits ch ON ch.id = d."id"
        LEFT JOIN structured_hits sd ON sd.id = d."id"
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${size} OFFSET ${from}
      `);

      const total = rows.length ? Number(rows[0].total) : 0;
      const highlights = hasText && rows.length ? await this.highlights(rows.map((r) => r.id), tsString) : new Map();

      const hits: SearchHit[] = rows.map((row) => ({
        documentId: row.id,
        score: row.score,
        source: toSource(row),
        highlights: highlights.get(row.id),
      }));
      return { total, hits };
    });
  }

  /** ts_headline is costly, so it only runs for the page of results being returned. */
  private async highlights(ids: string[], tsString: string) {
    const result = new Map<string, Record<string, string[]>>();
    if (!tsString) return result;

    const passages = await prisma.$queryRaw<{ id: string; headline: string }[]>(Prisma.sql`
      WITH q AS (SELECT to_tsquery('english', ${tsString}::text) AS tsq),
      passages AS (
        SELECT c."documentId" AS id, c."content" AS content,
               row_number() OVER (
                 PARTITION BY c."documentId" ORDER BY ts_rank_cd(c."searchVector", q.tsq) DESC
               ) AS rn
        FROM "document_chunks" c, q
        WHERE c."documentId" = ANY(${ids}::text[]) AND c."searchVector" @@ q.tsq
        UNION ALL
        SELECT s."documentId", s."searchText", 1::bigint
        FROM "structured_data" s, q
        WHERE s."documentId" = ANY(${ids}::text[]) AND s."searchVector" @@ q.tsq
      )
      SELECT p.id, ts_headline('english', p.content, q.tsq, ${HEADLINE_OPTIONS}::text) AS headline
      FROM passages p, q
      WHERE p.rn <= 3
    `);
    for (const { id, headline } of passages) {
      const fragments = splitHeadline(headline);
      if (!fragments.length) continue;
      const entry = result.get(id) ?? {};
      entry.content = [...(entry.content ?? []), ...fragments].slice(0, 3);
      result.set(id, entry);
    }

    const metadata = await prisma.$queryRaw<{ id: string; title: string; description: string }[]>(Prisma.sql`
      WITH q AS (SELECT to_tsquery('english', ${tsString}::text) AS tsq)
      SELECT d."id",
             CASE WHEN d."searchVector" @@ q.tsq
                  THEN ts_headline('english', d."title", q.tsq, ${TITLE_HEADLINE_OPTIONS}::text) ELSE '' END AS title,
             CASE WHEN d."searchVector" @@ q.tsq
                  THEN ts_headline('english', d."description", q.tsq, ${HEADLINE_OPTIONS}::text) ELSE '' END AS description
      FROM "documents" d, q
      WHERE d."id" = ANY(${ids}::text[])
    `);
    for (const row of metadata) {
      const title = splitHeadline(row.title);
      const description = splitHeadline(row.description);
      if (!title.length && !description.length) continue;
      const entry = result.get(row.id) ?? {};
      if (title.length) entry.title = title;
      if (description.length) entry.description = description;
      result.set(row.id, entry);
    }
    return result;
  }

  search(params: SearchParams): Promise<SearchResult> {
    return this.run('search', { ...params, sortBy: 'relevance', sortOrder: 'desc' });
  }

  advancedSearch(params: AdvancedSearchParams): Promise<SearchResult> {
    return this.run('advancedSearch', params);
  }

  searchWithinDocument(params: { documentId: string; query: string; size?: number }): Promise<SearchResult> {
    return this.run(
      'searchWithinDocument',
      { query: params.query, size: params.size ?? 5, sortBy: 'relevance', sortOrder: 'desc' },
      params.documentId,
    );
  }

  /** True once the document has anything searchable (extracted text, SRD entry, or a description). */
  async documentExists(documentId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<{ found: boolean }[]>(Prisma.sql`
      SELECT (
        EXISTS (SELECT 1 FROM "document_chunks" WHERE "documentId" = ${documentId})
        OR EXISTS (SELECT 1 FROM "structured_data" WHERE "documentId" = ${documentId})
        OR EXISTS (SELECT 1 FROM "documents" WHERE "id" = ${documentId} AND "description" <> '')
      ) AS found
    `);
    return rows[0]?.found === true;
  }
}

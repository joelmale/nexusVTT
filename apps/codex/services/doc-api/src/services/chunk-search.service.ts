import { prisma } from './database.service';
import { cosineSimilarity, embedText, getEmbeddingProviderName } from './embeddings.service';

type ChunkSearchFilters = {
  type?: string;
  campaigns?: string[];
  tags?: string[];
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, ' ')
    .split(/\\s+/)
    .filter(Boolean);

export const searchChunks = async (params: {
  query: string;
  topK?: number;
  filters?: ChunkSearchFilters;
}) => {
  const { query, topK = 10, filters } = params;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const orTerms = tokens.map((token) => ({
    content: { contains: token, mode: 'insensitive' as const },
  }));

  const where: any = {
    OR: orTerms,
  };

  if (filters?.type || filters?.campaigns || filters?.tags) {
    where.document = {};
    if (filters.type) {
      where.document.type = filters.type;
    }
    if (filters.campaigns && filters.campaigns.length > 0) {
      where.document.campaigns = { hasSome: filters.campaigns };
    }
    if (filters.tags && filters.tags.length > 0) {
      where.document.tags = { hasSome: filters.tags };
    }
  }

  const candidates = await prisma.documentChunk.findMany({
    where,
    take: Math.max(topK * 5, 50),
    include: {
      document: {
        select: {
          id: true,
          title: true,
          type: true,
          campaigns: true,
          tags: true,
        },
      },
    },
  });

  const queryEmbedding = embedText(query);
  const provider = getEmbeddingProviderName();

  const scored = candidates.map((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    const tokenHits = tokens.reduce((sum, token) => (contentLower.includes(token) ? sum + 1 : sum), 0);
    const lexicalScore = tokenHits / tokens.length;
    const embeddingScore =
      provider === 'hash' && queryEmbedding && chunk.embedding
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
    const score = provider === 'hash' ? (0.6 * embeddingScore + 0.4 * lexicalScore) : lexicalScore;
    return {
      chunk,
      score,
      lexicalScore,
      embeddingScore,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score, lexicalScore, embeddingScore }) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      source: chunk.source,
      score,
      lexicalScore,
      embeddingScore,
      contentSnippet: chunk.content.slice(0, 240),
      document: chunk.document,
    }));
};

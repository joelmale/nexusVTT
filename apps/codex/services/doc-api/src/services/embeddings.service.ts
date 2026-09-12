import { env } from '../config/env';

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, ' ')
    .split(/\\s+/)
    .filter(Boolean);

const hashToken = (token: string) => {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) % 2147483647;
  }
  return hash;
};

export const getEmbeddingProviderName = () => env.EMBEDDINGS_PROVIDER;

export const embedText = (text: string) => {
  if (env.EMBEDDINGS_PROVIDER !== 'hash') {
    return null;
  }

  const dim = env.EMBEDDINGS_DIM;
  const vector = new Array(dim).fill(0);
  const tokens = tokenize(text);
  tokens.forEach((token) => {
    const idx = hashToken(token) % dim;
    vector[idx] += 1;
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm ? vector.map((value) => value / norm) : vector;
};

export const cosineSimilarity = (a: number[], b: number[]) => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / Math.sqrt(normA * normB);
};

import { env } from '../config/env';

export type EmbeddingProvider = {
  name: string;
  embed: (inputs: string[]) => Promise<number[][]>;
};

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

const createHashProvider = (): EmbeddingProvider => ({
  name: 'hash',
  embed: async (inputs: string[]) => {
    const dim = env.EMBEDDINGS_DIM;
    return inputs.map((input) => {
      const vector = new Array(dim).fill(0);
      const tokens = tokenize(input);
      tokens.forEach((token) => {
        const idx = hashToken(token) % dim;
        vector[idx] += 1;
      });
      const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
      return norm ? vector.map((value) => value / norm) : vector;
    });
  },
});

const createNoneProvider = (): EmbeddingProvider => ({
  name: 'none',
  embed: async () => [],
});

export class EmbeddingsService {
  private provider: EmbeddingProvider;

  constructor() {
    this.provider = env.EMBEDDINGS_PROVIDER === 'hash' ? createHashProvider() : createNoneProvider();
  }

  getProviderName() {
    return this.provider.name;
  }

  async embedTexts(texts: string[]) {
    if (this.provider.name === 'none') {
      return [];
    }

    const batches: number[][][] = [];
    for (let i = 0; i < texts.length; i += env.EMBEDDINGS_BATCH_SIZE) {
      const batch = texts.slice(i, i + env.EMBEDDINGS_BATCH_SIZE);
      const vectors = await this.provider.embed(batch);
      batches.push(vectors);
    }

    return batches.flat();
  }
}

export const embeddingsService = new EmbeddingsService();

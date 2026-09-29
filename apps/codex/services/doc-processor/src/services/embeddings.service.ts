import { env } from '../config/env';

export type EmbeddingProvider = {
  name: string;
  // `model` labels the vectors (DocumentChunk.embeddingModel).
  embed: (inputs: string[]) => Promise<{ embeddings: number[][]; model: string }>;
};

export type EmbeddingResult = {
  embeddings: number[][];
  model: string;
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
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
    const embeddings = inputs.map((input) => {
      const vector = new Array(dim).fill(0);
      const tokens = tokenize(input);
      tokens.forEach((token) => {
        const idx = hashToken(token) % dim;
        vector[idx] += 1;
      });
      const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
      return norm ? vector.map((value) => value / norm) : vector;
    });
    return { embeddings, model: 'hash' };
  },
});

// Sidecar failures throw so the stage fails and BullMQ retries it. Silently
// substituting hash vectors would collapse search quality with no error.
const createSidecarProvider = (): EmbeddingProvider => ({
  name: 'sidecar',
  embed: async (inputs: string[]) => {
    if (!env.OCR_SERVICE_URL) {
      throw new Error('EMBEDDINGS_PROVIDER=sidecar but OCR_SERVICE_URL is unset');
    }

    const baseUrl = env.OCR_SERVICE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: inputs }),
      signal: AbortSignal.timeout(env.OCR_SERVICE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Sidecar /embed failed: HTTP ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { embeddings?: number[][]; model?: string };
    const embeddings = data.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== inputs.length) {
      throw new Error(
        `Sidecar /embed returned ${Array.isArray(embeddings) ? embeddings.length : 'no'} vectors for ${inputs.length} inputs`
      );
    }
    if (data.model?.startsWith('fallback')) {
      throw new Error(`Sidecar /embed is serving fallback vectors (${data.model}); its embedding model failed to load`);
    }

    return { embeddings, model: data.model || 'sidecar' };
  },
});

const createNoneProvider = (): EmbeddingProvider => ({
  name: 'none',
  embed: async () => ({ embeddings: [], model: 'none' }),
});

export class EmbeddingsService {
  private provider: EmbeddingProvider;

  constructor() {
    if (env.EMBEDDINGS_PROVIDER === 'sidecar') {
      this.provider = createSidecarProvider();
    } else if (env.EMBEDDINGS_PROVIDER === 'hash') {
      this.provider = createHashProvider();
    } else {
      this.provider = createNoneProvider();
    }
  }

  getProviderName() {
    return this.provider.name;
  }

  async embedTexts(texts: string[]) {
    return (await this.embedTextsWithModel(texts)).embeddings;
  }

  async embedTextsWithModel(texts: string[]): Promise<EmbeddingResult> {
    if (this.provider.name === 'none') {
      return { embeddings: [], model: 'none' };
    }

    const batches: number[][][] = [];
    const models = new Set<string>();
    for (let i = 0; i < texts.length; i += env.EMBEDDINGS_BATCH_SIZE) {
      const batch = texts.slice(i, i + env.EMBEDDINGS_BATCH_SIZE);
      const result = await this.provider.embed(batch);
      batches.push(result.embeddings);
      models.add(result.model);
    }

    if (models.size > 1) {
      // A sidecar restart mid-document swapped models; mixed vectors are not comparable.
      throw new Error(`Embedding model changed mid-document: ${[...models].join(', ')}`);
    }

    return { embeddings: batches.flat(), model: [...models][0] ?? this.provider.name };
  }
}

export const embeddingsService = new EmbeddingsService();

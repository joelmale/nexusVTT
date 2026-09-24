/**
 * RulesCatalogUpstreamClient / RulesCatalogCache - BFF for the Codex published
 * rules catalog (Phase 4 of the private admin control plane; see
 * apps/docs/codex/rules-registry.md, "Published catalog (read-only)").
 *
 * The VTT backend is the only thing that talks to doc-api's
 * `/api/rules/catalog/*` routes; browsers only ever reach
 * `server/routes/rulesCatalog.routes.ts`. This mirrors the existing
 * DocumentServiceClient proxy pattern (documentServiceClient.ts), but adds an
 * in-memory cache keyed by catalog version so concurrent VTT clients polling
 * the manifest do not each cause a doc-api round trip.
 */

import {
  CatalogEntitiesResponseSchema,
  CatalogManifestSchema,
  type CatalogEntitiesResponse,
  type CatalogManifest,
  type RulesEntityType,
  type Ruleset,
} from '@nexus/rules-contracts';

export interface RulesCatalogEntitiesQuery {
  type?: RulesEntityType;
  ruleset?: Ruleset;
  since: number;
}

type UpstreamResult<T> =
  | { status: 200; body: T; etag: string | null }
  | { status: 304; etag: string | null };

/**
 * What `RulesCatalogCache` needs from an upstream client. Split out so tests
 * can inject a fake without going through a real (or `fetch`-mocked) HTTP
 * client -- see tests/unit/server/services/rulesCatalogClient.test.ts.
 */
export interface RulesCatalogUpstream {
  fetchManifest(etag: string | null): Promise<UpstreamResult<CatalogManifest>>;
  fetchEntities(
    query: RulesCatalogEntitiesQuery,
    etag: string | null,
  ): Promise<UpstreamResult<CatalogEntitiesResponse>>;
}

/**
 * Thin, timeout-bounded HTTP client for doc-api's published catalog routes.
 * Responses are validated against `@nexus/rules-contracts` so a malformed or
 * incompatible upstream payload surfaces as a request failure (caught by the
 * cache below and turned into a 503) rather than corrupting client caches.
 */
export class RulesCatalogUpstreamClient implements RulesCatalogUpstream {
  private readonly apiUrl: string;
  private readonly timeout: number;

  constructor(config: { apiUrl: string; timeout?: number }) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 3000;
  }

  private async request(path: string, etag: string | null): Promise<UpstreamResult<unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const headers: Record<string, string> = {};
      if (etag) headers['If-None-Match'] = etag;
      const response = await fetch(`${this.apiUrl}${path}`, {
        headers,
        signal: controller.signal,
      });
      const responseEtag = response.headers.get('etag');
      if (response.status === 304) {
        return { status: 304, etag: responseEtag };
      }
      if (!response.ok) {
        throw new Error(`rules catalog upstream request failed: ${response.status}`);
      }
      const body = await response.json();
      return { status: 200, body, etag: responseEtag };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('rules catalog upstream request timed out', { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async fetchManifest(etag: string | null): Promise<UpstreamResult<CatalogManifest>> {
    const result = await this.request('/api/rules/catalog/manifest', etag);
    if (result.status === 304) return result;
    const parsed = CatalogManifestSchema.safeParse(result.body);
    if (!parsed.success) {
      throw new Error('rules catalog manifest failed contract validation');
    }
    return { status: 200, body: parsed.data, etag: result.etag };
  }

  async fetchEntities(
    query: RulesCatalogEntitiesQuery,
    etag: string | null,
  ): Promise<UpstreamResult<CatalogEntitiesResponse>> {
    const params = new URLSearchParams();
    if (query.type) params.set('type', query.type);
    if (query.ruleset) params.set('ruleset', query.ruleset);
    params.set('since', String(query.since));
    const result = await this.request(`/api/rules/catalog/entities?${params.toString()}`, etag);
    if (result.status === 304) return result;
    const parsed = CatalogEntitiesResponseSchema.safeParse(result.body);
    if (!parsed.success) {
      throw new Error('rules catalog entities response failed contract validation');
    }
    // Shape-checked above; entity `data` itself is validated by doc-api
    // before publication (see @nexus/rules-contracts entity.ts doc comment).
    return { status: 200, body: parsed.data as CatalogEntitiesResponse, etag: result.etag };
  }
}

export function createRulesCatalogUpstreamClient(
  apiUrl: string,
  timeout?: number,
): RulesCatalogUpstreamClient {
  return new RulesCatalogUpstreamClient({ apiUrl, timeout });
}

export type RulesCatalogCacheResponse<T> =
  | { status: 200; body: T; etag: string }
  | { status: 304 }
  | { status: 503 };

interface CacheEntry<T> {
  etag: string;
  body: T;
  expiresAt: number;
}

/**
 * In-memory cache in front of `RulesCatalogUpstreamClient`, keyed by the
 * fixed manifest/entities query keys (never a generic proxy). Within
 * `ttlMs`, repeated requests for the same key are answered without a doc-api
 * round trip. Past the TTL, the cache still sends its own ETag upstream so an
 * unchanged catalog costs doc-api only a 304, not a full payload.
 *
 * Any upstream failure (timeout, network error, contract-validation failure,
 * non-2xx/304 status) resolves as `{ status: 503 }`. The router turns that
 * into a small JSON body VTT clients treat as "use the bundled SRD" -- it
 * never serves a stale cached body silently for a hard failure, so operators
 * can tell from client behavior whether doc-api is actually reachable.
 */
export class RulesCatalogCache {
  private manifestEntry: CacheEntry<CatalogManifest> | null = null;
  private readonly entitiesEntries = new Map<string, CacheEntry<CatalogEntitiesResponse>>();

  constructor(
    private readonly upstream: RulesCatalogUpstream,
    private readonly ttlMs = 5000,
  ) {}

  private now(): number {
    return Date.now();
  }

  async getManifest(clientEtag: string | null): Promise<RulesCatalogCacheResponse<CatalogManifest>> {
    if (this.manifestEntry && this.manifestEntry.expiresAt > this.now()) {
      return this.respond(this.manifestEntry, clientEtag);
    }
    try {
      const upstreamEtag = this.manifestEntry?.etag ?? null;
      const result = await this.upstream.fetchManifest(upstreamEtag);
      if (result.status === 304) {
        if (!this.manifestEntry) {
          // Upstream should never 304 against an etag we never sent.
          throw new Error('unexpected 304 from doc-api manifest with no cached etag');
        }
        this.manifestEntry = { ...this.manifestEntry, expiresAt: this.now() + this.ttlMs };
        return this.respond(this.manifestEntry, clientEtag);
      }
      if (!result.etag) {
        // doc-api always sends a weak ETag; treat a missing one as a broken response.
        throw new Error('rules catalog manifest response missing ETag');
      }
      this.manifestEntry = { etag: result.etag, body: result.body, expiresAt: this.now() + this.ttlMs };
      return this.respond(this.manifestEntry, clientEtag);
    } catch {
      return { status: 503 };
    }
  }

  async getEntities(
    query: RulesCatalogEntitiesQuery,
    clientEtag: string | null,
  ): Promise<RulesCatalogCacheResponse<CatalogEntitiesResponse>> {
    const key = this.entitiesKey(query);
    const cached = this.entitiesEntries.get(key);
    if (cached && cached.expiresAt > this.now()) {
      return this.respond(cached, clientEtag);
    }
    try {
      const upstreamEtag = cached?.etag ?? null;
      const result = await this.upstream.fetchEntities(query, upstreamEtag);
      if (result.status === 304) {
        if (!cached) {
          throw new Error('unexpected 304 from doc-api entities with no cached etag');
        }
        const refreshed = { ...cached, expiresAt: this.now() + this.ttlMs };
        this.entitiesEntries.set(key, refreshed);
        return this.respond(refreshed, clientEtag);
      }
      if (!result.etag) {
        throw new Error('rules catalog entities response missing ETag');
      }
      const entry: CacheEntry<CatalogEntitiesResponse> = {
        etag: result.etag,
        body: result.body,
        expiresAt: this.now() + this.ttlMs,
      };
      this.entitiesEntries.set(key, entry);
      return this.respond(entry, clientEtag);
    } catch {
      return { status: 503 };
    }
  }

  private entitiesKey(query: RulesCatalogEntitiesQuery): string {
    return `${query.type ?? 'all'}|${query.ruleset ?? 'all'}|${query.since}`;
  }

  private respond<T>(entry: CacheEntry<T>, clientEtag: string | null): RulesCatalogCacheResponse<T> {
    if (clientEtag && clientEtag === entry.etag) return { status: 304 };
    return { status: 200, body: entry.body, etag: entry.etag };
  }
}

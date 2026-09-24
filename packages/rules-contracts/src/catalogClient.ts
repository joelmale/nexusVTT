import { z } from 'zod';
import { RulesEntityTypeSchema, RulesetSchema, type Ruleset, type RulesEntityType } from './common';
import type { CatalogEntity, CatalogEntitiesResponse, CatalogManifest, CatalogRemovedEntity } from './entity';

/**
 * Runtime consumption of the Codex rules registry (Phase 4 of the private
 * admin control plane; see apps/docs/codex/rules-registry.md, "How adapters
 * should consume it"). This module is pure: it has no `fetch`, DOM, or
 * IndexedDB dependency at import time. Hosts (the VTT backend/frontend,
 * Forge) inject a transport that talks to their own authenticated BFF and a
 * storage adapter for their runtime (browser, Node test, etc.).
 *
 * Ownership: this stays a pure data/merge utility. It never persists
 * anything on its own behalf beyond the injected storage adapter, and it
 * never becomes a second character-creator or a second rules editor.
 */

// ---------------------------------------------------------------------------
// Overlay: bundled SRD + published catalog -> one list
// ---------------------------------------------------------------------------

export interface OverlayCatalogOptions<TBundled> {
  entityType: RulesEntityType;
  ruleset: Ruleset;
  /** The host's bundled SRD content for this (entityType, ruleset). */
  bundled: TBundled[];
  /** Stable slug of a bundled item, used to match it against published content. */
  keyOf: (item: TBundled) => string;
  /** Currently-known published entities (already merged from manifest/entities deltas). */
  published: Iterable<CatalogEntity>;
  /** Tombstones for entities archived since the bundled baseline was authored. */
  removed?: Iterable<CatalogRemovedEntity>;
  /** Converts a published entity into the host's own item shape. */
  fromCatalogEntity: (entity: CatalogEntity) => TBundled;
}

/**
 * Overlay published rules content on a bundled SRD baseline, by slug within
 * one (entityType, ruleset) pair.
 *
 * - A published entity whose slug matches a bundled item replaces it.
 * - A published entity with a new slug is appended (custom content).
 * - A slug tombstoned in `removed` is dropped even if bundled, unless a live
 *   published entity with that slug still exists (a publish always wins over
 *   an older removal).
 *
 * Pure and synchronous; safe to call on every render.
 */
export function overlayCatalog<TBundled>(options: OverlayCatalogOptions<TBundled>): TBundled[] {
  const { entityType, ruleset, bundled, keyOf, published, removed: removedTombstones, fromCatalogEntity } = options;
  const removed = new Set(
    Array.from(removedTombstones ?? [])
      .filter((entity) => entity.entityType === entityType && entity.ruleset === ruleset)
      .map((entity) => entity.slug),
  );
  const overlay = new Map<string, TBundled>();
  for (const entity of published) {
    if (entity.entityType !== entityType || entity.ruleset !== ruleset) continue;
    overlay.set(entity.slug, fromCatalogEntity(entity));
  }

  const result: TBundled[] = [];
  for (const item of bundled) {
    const slug = keyOf(item);
    const replacement = overlay.get(slug);
    if (replacement) {
      result.push(replacement);
      overlay.delete(slug);
      continue;
    }
    if (removed.has(slug)) continue;
    result.push(item);
  }
  // Anything left in `overlay` is custom published content with no bundled
  // counterpart: new slugs the SRD never shipped.
  for (const extra of overlay.values()) result.push(extra);
  return result;
}

// ---------------------------------------------------------------------------
// Storage adapter
// ---------------------------------------------------------------------------

export interface StoredRulesCatalogState {
  /** Last catalog version fully applied to `entities`/`removedIds`. */
  catalogVersion: number;
  /** Manifest ETag as of `catalogVersion`, sent back as `If-None-Match`. */
  manifestEtag: string | null;
  /** Published entities, keyed by stable entity id. */
  entities: Record<string, CatalogEntity>;
  /** Tombstones for entities archived at or before `catalogVersion`, keyed by id. */
  removed: Record<string, CatalogRemovedEntity>;
}

export function emptyRulesCatalogState(): StoredRulesCatalogState {
  return { catalogVersion: 0, manifestEtag: null, entities: {}, removed: {} };
}

const StoredCatalogEntitySchema = z
  .object({
    id: z.string(),
    entityType: RulesEntityTypeSchema,
    ruleset: RulesetSchema,
    slug: z.string(),
    schemaVersion: z.number(),
    revisionId: z.string(),
    revisionNumber: z.number(),
    catalogVersion: z.number().nullable(),
    publishedAt: z.string().nullable(),
    sourceLicense: z.string(),
    sourceDocumentId: z.string().nullable(),
    summary: z.string(),
    data: z.unknown(),
  })
  .passthrough();

const StoredRemovedEntitySchema = z.object({
  id: z.string(),
  entityType: RulesEntityTypeSchema,
  ruleset: RulesetSchema,
  slug: z.string(),
  catalogVersion: z.number(),
});

const StoredRulesCatalogStateSchema = z.object({
  catalogVersion: z.number().int().min(0),
  manifestEtag: z.string().nullable(),
  entities: z.record(z.string(), StoredCatalogEntitySchema),
  removed: z.record(z.string(), StoredRemovedEntitySchema),
});

/** Validates a value loaded from storage. Returns `null` on any shape mismatch. */
export function parseStoredRulesCatalogState(value: unknown): StoredRulesCatalogState | null {
  const result = StoredRulesCatalogStateSchema.safeParse(value);
  return result.success ? (result.data as StoredRulesCatalogState) : null;
}

export interface RulesCatalogStorage {
  load(): Promise<StoredRulesCatalogState | null>;
  save(state: StoredRulesCatalogState): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory adapter: unit tests, and any host with no durable client cache. */
export function createInMemoryCatalogStorage(): RulesCatalogStorage {
  let state: StoredRulesCatalogState | null = null;
  return {
    async load() {
      return state ? structuredClone(state) : null;
    },
    async save(next) {
      state = structuredClone(next);
    },
    async clear() {
      state = null;
    },
  };
}

/** Subset of the browser `Storage` interface (`localStorage`/`sessionStorage`). */
export interface SyncKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Browser adapter over `localStorage` (or any `Storage`-shaped store). Never
 * throws: a private-browsing quota error, disabled storage, or corrupted JSON
 * is treated as an empty cache so the client falls back to a fresh sync (or
 * the caller's bundled SRD) instead of crashing the host app.
 */
export function createBrowserCatalogStorage(
  storage: SyncKeyValueStorage,
  key = 'nexus-rules-catalog',
): RulesCatalogStorage {
  return {
    async load() {
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        return parseStoredRulesCatalogState(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async save(next) {
      try {
        storage.setItem(key, JSON.stringify(next));
      } catch {
        // Quota exceeded or storage disabled: the in-memory sync result is
        // still returned to the caller, just not persisted across reloads.
      }
    },
    async clear() {
      try {
        storage.removeItem(key);
      } catch {
        // Nothing to do; a failed removal cannot make things worse.
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Transport: how the client reaches the host's own catalog BFF
// ---------------------------------------------------------------------------

export interface CatalogManifestFetchResult {
  status: 200 | 304;
  manifest?: CatalogManifest;
  etag?: string | null;
}

export interface CatalogEntitiesFetchQuery {
  type?: RulesEntityType;
  ruleset?: Ruleset;
  since: number;
}

export interface CatalogEntitiesFetchResult {
  status: 200 | 304;
  entities?: CatalogEntitiesResponse;
  etag?: string | null;
}

export interface RulesCatalogTransport {
  fetchManifest(etag: string | null): Promise<CatalogManifestFetchResult>;
  fetchEntities(query: CatalogEntitiesFetchQuery, etag: string | null): Promise<CatalogEntitiesFetchResult>;
}

export interface HttpCatalogTransportConfig {
  /** Base URL of the host's own BFF, e.g. the VTT backend's `/api`. */
  baseUrl: string;
  /** Injectable so this stays testable without a DOM/Node fetch polyfill. */
  fetchImpl: typeof fetch;
  /** Extra headers, e.g. credentials the host's session cookie already covers. */
  headers?: Record<string, string>;
}

/**
 * Default transport: hits `${baseUrl}/rules/catalog/manifest` and
 * `${baseUrl}/rules/catalog/entities`, matching the VTT backend BFF
 * (`server/routes/rulesCatalog.routes.ts`). A host that reaches a
 * differently-shaped BFF can implement `RulesCatalogTransport` directly
 * instead of using this helper.
 */
export function createHttpCatalogTransport(config: HttpCatalogTransportConfig): RulesCatalogTransport {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  async function request(path: string, etag: string | null): Promise<{ status: 200 | 304; body: unknown; etag: string | null }> {
    const headers: Record<string, string> = { ...config.headers };
    if (etag) headers['If-None-Match'] = etag;
    const response = await config.fetchImpl(`${baseUrl}${path}`, { headers, credentials: 'include' });
    const responseEtag = response.headers.get('etag');
    if (response.status === 304) {
      return { status: 304, body: undefined, etag: responseEtag };
    }
    if (!response.ok) {
      throw new Error(`rules catalog request failed: ${response.status}`);
    }
    return { status: 200, body: await response.json(), etag: responseEtag };
  }

  return {
    async fetchManifest(etag) {
      const result = await request('/rules/catalog/manifest', etag);
      if (result.status === 304) return { status: 304, etag: result.etag };
      return { status: 200, manifest: result.body as CatalogManifest, etag: result.etag };
    },
    async fetchEntities(query, etag) {
      const params = new URLSearchParams();
      if (query.type) params.set('type', query.type);
      if (query.ruleset) params.set('ruleset', query.ruleset);
      params.set('since', String(query.since));
      const result = await request(`/rules/catalog/entities?${params.toString()}`, etag);
      if (result.status === 304) return { status: 304, etag: result.etag };
      return { status: 200, entities: result.body as CatalogEntitiesResponse, etag: result.etag };
    },
  };
}

// ---------------------------------------------------------------------------
// Client: sync + cache, with bundled-SRD-safe offline fallback
// ---------------------------------------------------------------------------

export interface RulesCatalogClientConfig {
  storage: RulesCatalogStorage;
  transport: RulesCatalogTransport;
  /** Observability hook; never thrown, sync() always resolves. */
  onError?: (error: unknown) => void;
}

export type RulesCatalogSyncStatus = 'unchanged' | 'updated' | 'offline';

export interface RulesCatalogSyncResult {
  /**
   * `'updated'` when new entities were applied, `'unchanged'` when the
   * manifest reported the version already cached, `'offline'` when the
   * transport failed (network error, timeout, 5xx) and the caller should keep
   * using whatever it already has (cache, or bundled SRD alone).
   */
  status: RulesCatalogSyncStatus;
  catalogVersion: number;
  entities: CatalogEntity[];
  removed: CatalogRemovedEntity[];
}

/**
 * Rules catalog client: polls the manifest, applies incremental deltas, and
 * keeps the result cached through the injected storage adapter. Never throws;
 * every failure degrades to the caller's own bundled-SRD fallback (invariant:
 * "VTT/Forge remain usable while Codex is offline").
 */
export class RulesCatalogClient {
  private state: StoredRulesCatalogState | undefined;
  private readonly config: RulesCatalogClientConfig;

  constructor(config: RulesCatalogClientConfig) {
    this.config = config;
  }

  private async loadState(): Promise<StoredRulesCatalogState> {
    if (this.state) return this.state;
    let loaded: StoredRulesCatalogState | null = null;
    try {
      loaded = await this.config.storage.load();
    } catch (error) {
      this.config.onError?.(error);
      loaded = null;
    }
    if (!loaded) {
      // Either nothing cached yet, or `storage.load()` returned a value that
      // failed validation upstream (a browser adapter already returns `null`
      // for corrupt JSON) -- either way, start clean rather than throw.
      try {
        await this.config.storage.clear();
      } catch (error) {
        this.config.onError?.(error);
      }
    }
    this.state = loaded ?? emptyRulesCatalogState();
    return this.state;
  }

  private async persist(next: StoredRulesCatalogState): Promise<void> {
    this.state = next;
    try {
      await this.config.storage.save(next);
    } catch (error) {
      this.config.onError?.(error);
    }
  }

  private toResult(state: StoredRulesCatalogState, status: RulesCatalogSyncStatus): RulesCatalogSyncResult {
    return {
      status,
      catalogVersion: state.catalogVersion,
      entities: Object.values(state.entities),
      removed: Object.values(state.removed),
    };
  }

  /** Currently cached catalog, without contacting the transport. */
  async getCached(): Promise<RulesCatalogSyncResult> {
    const state = await this.loadState();
    return this.toResult(state, 'unchanged');
  }

  /**
   * Fetch the manifest and, if the catalog version advanced, the entity
   * delta since the last applied version. Resolves `'offline'` (never
   * rejects) on any transport failure, leaving the previous cache untouched.
   */
  async sync(): Promise<RulesCatalogSyncResult> {
    const state = await this.loadState();
    try {
      const manifestResult = await this.config.transport.fetchManifest(state.manifestEtag);

      if (manifestResult.status === 304) {
        if (state.manifestEtag && state.manifestEtag !== manifestResult.etag) {
          await this.persist({ ...state, manifestEtag: manifestResult.etag ?? state.manifestEtag });
        }
        return this.toResult(state, 'unchanged');
      }

      const manifest = manifestResult.manifest as CatalogManifest;
      if (manifest.catalogVersion === state.catalogVersion) {
        const nextEtag = manifestResult.etag ?? manifest.etag;
        if (nextEtag !== state.manifestEtag) {
          await this.persist({ ...state, manifestEtag: nextEtag });
        }
        return this.toResult(state, 'unchanged');
      }

      const delta = await this.config.transport.fetchEntities({ since: state.catalogVersion }, null);
      if (delta.status === 304 || !delta.entities) {
        // Should not happen (we never send an entities ETag with a version
        // bump), but treat it as "nothing new" rather than corrupt state.
        return this.toResult(state, 'unchanged');
      }

      const entities: Record<string, CatalogEntity> = { ...state.entities };
      for (const entity of delta.entities.entities) entities[entity.id] = entity;
      const removed: Record<string, CatalogRemovedEntity> = { ...state.removed };
      for (const tombstone of delta.entities.removed) {
        delete entities[tombstone.id];
        removed[tombstone.id] = tombstone;
      }
      // `skipped` rows keep whatever this client already had cached (or the
      // caller's bundled fallback, if it was never published before).

      const nextState: StoredRulesCatalogState = {
        catalogVersion: delta.entities.catalogVersion,
        manifestEtag: manifestResult.etag ?? manifest.etag,
        entities,
        removed,
      };
      await this.persist(nextState);
      return this.toResult(nextState, 'updated');
    } catch (error) {
      this.config.onError?.(error);
      return this.toResult(state, 'offline');
    }
  }
}

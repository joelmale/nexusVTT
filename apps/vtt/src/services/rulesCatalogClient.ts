/**
 * Rules Catalog Client - Frontend wiring for the Codex published rules
 * catalog (Phase 4 of the private admin control plane; see
 * apps/docs/codex/rules-registry.md, "Runtime consumption").
 *
 * This talks only to the VTT backend's own BFF
 * (server/routes/rulesCatalog.routes.ts, mounted at `/api/rules/catalog/*`),
 * never to doc-api directly, matching how documentService.ts proxies Codex
 * documents. The merge/cache logic itself lives in `@nexus/rules-contracts`
 * (`RulesCatalogClient`) so Forge can adopt the same client later.
 *
 * Ownership: this module records nothing on its own behalf. It is a data
 * source a host feature (e.g. SharedCharacterCreator) can consult; per
 * CLAUDE.md "Shared character creation", the character-creator package owns
 * no persistence, so it is the VTT host -- not the creator -- that decides
 * whether and where to record the catalog version it read from here.
 */

import {
  RulesCatalogClient,
  createBrowserCatalogStorage,
  createHttpCatalogTransport,
  createInMemoryCatalogStorage,
  type RulesCatalogStorage,
  type RulesCatalogSyncResult,
} from '@nexus/rules-contracts';

// Same base-URL resolution as documentService.ts: relative in production
// (the frontend Nginx/dev proxy already routes /api to the backend), an
// explicit override or localhost:5001 in dev.
const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL || 'http://localhost:5001'
  : '';

/** A slow or unreachable Codex must never stall character/campaign creation. */
const SYNC_TIMEOUT_MS = 2500;

function createStorage(): RulesCatalogStorage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return createBrowserCatalogStorage(window.localStorage);
    }
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts.
  }
  return createInMemoryCatalogStorage();
}

let sharedClient: RulesCatalogClient | null = null;

/** Lazily-created singleton so every caller shares one cache and one sync in flight. */
export function getRulesCatalogClient(): RulesCatalogClient {
  if (!sharedClient) {
    sharedClient = new RulesCatalogClient({
      storage: createStorage(),
      transport: createHttpCatalogTransport({
        baseUrl: `${API_BASE_URL}/api`,
        fetchImpl: (...args) => fetch(...args),
      }),
      onError: (error) => {
        console.warn('⚠️ Rules catalog sync failed; using bundled/cached SRD content', error);
      },
    });
  }
  return sharedClient;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        // RulesCatalogClient.sync() never rejects; this guards the contract anyway.
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

const OFFLINE_FALLBACK: RulesCatalogSyncResult = {
  status: 'offline',
  catalogVersion: 0,
  entities: [],
  removed: [],
};

/**
 * Best-effort published catalog version, for hosts that want to record which
 * catalog revision was in effect when a character or campaign was created
 * (apps/docs/codex/rules-registry.md, "Runtime consumption"). Resolves
 * `null` -- meaning "bundled SRD only" -- when Codex has never published
 * anything, is unreachable, or the sync does not finish within
 * `SYNC_TIMEOUT_MS`. Never throws.
 */
export async function getRulesCatalogVersion(): Promise<number | null> {
  const result = await withTimeout(getRulesCatalogClient().sync(), SYNC_TIMEOUT_MS, OFFLINE_FALLBACK);
  return result.catalogVersion > 0 ? result.catalogVersion : null;
}

/** Test-only: drop the singleton so each test gets a fresh client/cache. */
export function resetRulesCatalogClientForTests(): void {
  sharedClient = null;
}

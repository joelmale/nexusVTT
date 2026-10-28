import { Router, Request, Response } from 'express';
import type { Session } from 'express-session';
import { CatalogEntitiesQuerySchema } from '@nexus/rules-contracts';
import {
  RulesCatalogCache,
  RulesCatalogUpstreamClient,
} from '../services/rulesCatalogClient.js';

interface CustomSession extends Session {
  guestUser?: { id: string; name: string; provider: string };
}

/**
 * Read-only BFF for the Codex published rules catalog
 * (apps/docs/codex/rules-registry.md, "Published catalog (read-only)"). Mounted
 * under `/api` alongside the document routes (server/routes/documents.ts),
 * which this deliberately mirrors: same "disabled when DOC_API_URL is unset"
 * shape, same short-timeout proxy-with-validation pattern.
 *
 * Read-only queries to canonical SRD catalog entities (`/rules/catalog/entities`
 * and `/rules/catalog/entities/:id`) are permitted without authentication so the
 * public Campaign Studio demo and character creation flows can load canonical
 * SRD items, monsters, and spells. Any non-GET mutations or user/custom-scoped
 * requests still require an authenticated or guest session.
 */
function hasSession(req: Request): boolean {
  return (
    req.isAuthenticated?.() === true ||
    !!(req.session as CustomSession | undefined)?.guestUser
  );
}

function getQueryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function isPublicCanonicalEntityRead(req: Request): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  if (!req.path.startsWith('/entities')) {
    return false;
  }
  const scope = getQueryString(req.query.scope);
  const source = getQueryString(req.query.source);
  if (
    scope === 'custom' ||
    scope === 'user' ||
    source === 'homebrew' ||
    source === 'custom'
  ) {
    return false;
  }
  return true;
}

export interface RulesCatalogRouterOptions {
  /** Same env var the document routes proxy through (DOC_API_URL). */
  docApiUrl: string | undefined;
  timeoutMs?: number;
  cacheTtlMs?: number;
  /** Test seam: inject a prebuilt cache instead of constructing one from `docApiUrl`. */
  cache?: RulesCatalogCache;
}

/**
 * Creates the `/rules/catalog/*` router. Callers mount it under `/api`
 * (see bootstrap/httpApp.ts), producing `/api/rules/catalog/manifest` and
 * `/api/rules/catalog/entities` -- the exact paths documented in
 * apps/docs/codex/rules-registry.md.
 *
 * This is never a generic proxy: only the fixed `type`/`ruleset`/`since`
 * query keys are read from the request, and only these two upstream paths
 * are ever requested from doc-api.
 */
export function createRulesCatalogRouter(
  options: RulesCatalogRouterOptions,
): Router {
  const router = Router();
  const cache =
    options.cache ??
    (options.docApiUrl
      ? new RulesCatalogCache(
          new RulesCatalogUpstreamClient({
            apiUrl: options.docApiUrl,
            timeout: options.timeoutMs,
          }),
          options.cacheTtlMs,
        )
      : null);

  router.use('/rules/catalog', (req: Request, res: Response, next) => {
    if (isPublicCanonicalEntityRead(req) || hasSession(req)) {
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  });

  router.get('/rules/catalog/manifest', async (req: Request, res: Response) => {
    if (!cache) {
      return res
        .status(503)
        .json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    const clientEtag = req.headers['if-none-match'];
    const result = await cache.getManifest(
      typeof clientEtag === 'string' ? clientEtag : null,
    );
    res.setHeader('Cache-Control', 'no-cache');
    if (result.status === 503) {
      return res
        .status(503)
        .json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    if (result.status === 304) {
      return res.status(304).end();
    }
    res.setHeader('ETag', result.etag);
    return res.status(200).json(result.body);
  });

  router.get('/rules/catalog/entities', async (req: Request, res: Response) => {
    if (!cache) {
      return res
        .status(503)
        .json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    const parsedQuery = CatalogEntitiesQuerySchema.safeParse({
      type: getQueryString(req.query.type),
      ruleset: getQueryString(req.query.ruleset),
      since: getQueryString(req.query.since),
    });
    if (!parsedQuery.success) {
      return res
        .status(400)
        .json({ error: 'invalid_query', issues: parsedQuery.error.issues });
    }
    const clientEtag = req.headers['if-none-match'];
    const result = await cache.getEntities(
      parsedQuery.data,
      typeof clientEtag === 'string' ? clientEtag : null,
    );
    res.setHeader('Cache-Control', 'no-cache');
    if (result.status === 503) {
      return res
        .status(503)
        .json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    if (result.status === 304) {
      return res.status(304).end();
    }
    res.setHeader('ETag', result.etag);
    return res.status(200).json(result.body);
  });

  router.get(
    '/rules/catalog/entities/:id',
    async (req: Request, res: Response) => {
      if (!cache) {
        return res
          .status(503)
          .json({ error: 'rules_catalog_unavailable', useBundled: true });
      }
      const parsedQuery = CatalogEntitiesQuerySchema.safeParse({
        type: getQueryString(req.query.type),
        ruleset: getQueryString(req.query.ruleset),
        since: 0,
      });
      if (!parsedQuery.success) {
        return res
          .status(400)
          .json({ error: 'invalid_query', issues: parsedQuery.error.issues });
      }
      const result = await cache.getEntities(parsedQuery.data, null);
      res.setHeader('Cache-Control', 'no-cache');
      if (result.status === 503) {
        return res
          .status(503)
          .json({ error: 'rules_catalog_unavailable', useBundled: true });
      }
      if (result.status === 304) {
        return res.status(304).end();
      }
      const entityId = req.params.id;
      const entity = result.body.entities.find(
        (item) => item.id === entityId || item.slug === entityId,
      );
      if (!entity) {
        return res.status(404).json({ error: 'entity_not_found' });
      }
      res.setHeader('ETag', result.etag);
      return res.status(200).json(entity);
    },
  );

  return router;
}

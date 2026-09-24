import { Router, Request, Response } from 'express';
import type { Session } from 'express-session';
import { CatalogEntitiesQuerySchema } from '@nexus/rules-contracts';
import { RulesCatalogCache, RulesCatalogUpstreamClient } from '../services/rulesCatalogClient.js';

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
 * Guest access decision: ALLOWED. Character creation
 * (`@nexus/character-creator`, mounted by both apps at build time) works for
 * guests today with zero server round trip -- it is entirely local, reading
 * only the bundled SRD. Rules-catalog content is the same category of read:
 * public D&D reference data, not account or campaign data. Gating it behind a
 * real account would make guests see stale bundled SRD forever while
 * everyone else sees published corrections, for no privacy or integrity
 * benefit (invariant 9 already makes published content immutable and
 * versioned). We still require *a* session (guest or authenticated) rather
 * than going fully anonymous, matching the rest of `/api` and giving the
 * short in-memory cache below a natural floor against anonymous scraping.
 */
function hasSession(req: Request): boolean {
  return req.isAuthenticated() || !!(req.session as CustomSession)?.guestUser;
}

function getQueryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
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
export function createRulesCatalogRouter(options: RulesCatalogRouterOptions): Router {
  const router = Router();
  const cache =
    options.cache ??
    (options.docApiUrl
      ? new RulesCatalogCache(
          new RulesCatalogUpstreamClient({ apiUrl: options.docApiUrl, timeout: options.timeoutMs }),
          options.cacheTtlMs,
        )
      : null);

  router.use('/rules/catalog', (req: Request, res: Response, next) => {
    if (!hasSession(req)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next();
  });

  router.get('/rules/catalog/manifest', async (req: Request, res: Response) => {
    if (!cache) {
      return res.status(503).json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    const clientEtag = req.headers['if-none-match'];
    const result = await cache.getManifest(typeof clientEtag === 'string' ? clientEtag : null);
    res.setHeader('Cache-Control', 'no-cache');
    if (result.status === 503) {
      return res.status(503).json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    if (result.status === 304) {
      return res.status(304).end();
    }
    res.setHeader('ETag', result.etag);
    return res.status(200).json(result.body);
  });

  router.get('/rules/catalog/entities', async (req: Request, res: Response) => {
    if (!cache) {
      return res.status(503).json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    const parsedQuery = CatalogEntitiesQuerySchema.safeParse({
      type: getQueryString(req.query.type),
      ruleset: getQueryString(req.query.ruleset),
      since: getQueryString(req.query.since),
    });
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'invalid_query', issues: parsedQuery.error.issues });
    }
    const clientEtag = req.headers['if-none-match'];
    const result = await cache.getEntities(parsedQuery.data, typeof clientEtag === 'string' ? clientEtag : null);
    res.setHeader('Cache-Control', 'no-cache');
    if (result.status === 503) {
      return res.status(503).json({ error: 'rules_catalog_unavailable', useBundled: true });
    }
    if (result.status === 304) {
      return res.status(304).end();
    }
    res.setHeader('ETag', result.etag);
    return res.status(200).json(result.body);
  });

  return router;
}

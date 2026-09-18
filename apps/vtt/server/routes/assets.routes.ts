import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { assetWriteGuard } from '../middleware/assetWriteGuard.js';

const ASSET_CATEGORIES = {
  Maps: 'Maps',
  Tokens: 'Tokens',
  Art: 'Art',
  Handouts: 'Handouts',
  Reference: 'Reference',
};

export interface AssetRouterDependencies {
  /** Base URL of the asset service (ASSET_API_URL). */
  assetApiUrl: string;
}

/**
 * Builds the asset router: public read proxies to the asset service, the
 * authenticated per-user write proxy, and the API/asset 404 fallback.
 *
 * Mounted at the application root and registered LAST, so the trailing 404
 * middleware keeps running after every other route.
 *
 * Note: this factory calls `process.exit(1)` when ASSET_SERVICE_SECRET is
 * missing, exactly as the inline setup did.
 */
export function createAssetRouter({
  assetApiUrl,
}: AssetRouterDependencies): Router {
  const router = Router();

  const assetProxy = createProxyMiddleware({
    target: assetApiUrl,
    changeOrigin: true,
    // http-proxy-middleware v3+ (bumped to v4 by dependabot) forwards the
    // Express-stripped req.url, so `app.use('/library', proxy)` would send
    // '/' to the asset service instead of '/library'. Restore the full
    // original path (incl. query) so every mount below forwards intact.
    pathRewrite: (_path, req) =>
      (req as { originalUrl?: string }).originalUrl ?? _path,
  });

  router.use('/manifest.json', assetProxy);
  router.use('/search', assetProxy);
  router.use('/category', assetProxy);
  router.use('/asset', assetProxy);

  Object.values(ASSET_CATEGORIES).forEach((categoryName) => {
    router.use(`/${categoryName}/assets`, assetProxy);
    router.use(`/${categoryName}/thumbnails`, assetProxy);
  });
  router.use('/assets', assetProxy);
  router.use('/thumbnails', assetProxy);
  router.use('/users', assetProxy);

  // TMT library (C6): public reads per ADR-0012, same as the routes above —
  // no write-guard chain needed. /library-assets serves the manifest's
  // content-addressed thumbnail/fullImage files (see
  // services/asset-service/src/index.ts's LIBRARY_DATA_PATH static mount).
  router.use('/library', assetProxy);
  router.use('/library-assets', assetProxy);

  // ADR-0012: the VTT authenticates the session user (assetWriteGuard) and
  // only then forwards to the asset service with the shared secret. The
  // asset service itself has no dev-secret fallback (see
  // services/asset-service/src/index.ts), so a fallback here would only
  // ever succeed against a local asset-service instance where the
  // operator deliberately set ASSET_SERVICE_SECRET=dev-secret. It is
  // gated to non-production and logged so it can't silently ship.
  const assetServiceSecret = process.env.ASSET_SERVICE_SECRET;
  if (!assetServiceSecret) {
    console.error(
      '❌ ASSET_SERVICE_SECRET must be set. Asset proxy cannot mount securely.',
    );
    process.exit(1);
  }

  const userAssetProxy = createProxyMiddleware({
    target: assetApiUrl,
    changeOrigin: true,
    // Same hpm v4 strip fix as assetProxy: rebuild from originalUrl (Express
    // strips the /api/user mount prefix), then map /api/user → /user so the
    // asset service sees /user/:userId/...  (object-form '^/api/user' would
    // never match the already-stripped path).
    pathRewrite: (_path, req) =>
      ((req as { originalUrl?: string }).originalUrl ?? _path).replace(
        /^\/api\/user/,
        '/user',
      ),
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('x-nexus-auth', assetServiceSecret);
      },
    },
  });

  // Mounted at '/api/user' (not '/user') to match the client's existing
  // call site (src/services/tokenAssets.ts) and to sit alongside the
  // other /api/* routes without ambiguity vs. the public /users read
  // mount. assetWriteGuard runs first and validates the session before
  // the proxy injects the shared secret; pathRewrite strips the '/api'
  // prefix so the asset service still sees /user/:userId/...
  router.use('/api/user', assetWriteGuard, userAssetProxy);

  router.use((req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/manifest') ||
      req.path.startsWith('/search') ||
      req.path.startsWith('/category') ||
      req.path.startsWith('/asset/')
    ) {
      res.status(404).json({
        error: 'Not found',
        availableEndpoints: [
          '/health',
          '/manifest.json',
          '/search?q=term',
          '/category/:name',
          '/asset/:id',
          '/assets/:filename',
          '/thumbnails/:filename',
        ],
      });
    } else {
      next();
    }
  });

  return router;
}

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';

export const app = express();
const port = process.env.PORT || 5003;

// Base paths (using fallback to current project for local dev)
const ASSETS_PATH = process.env.ASSETS_PATH || path.resolve(__dirname, '../../../static-assets');
const MANIFEST_PATH = path.join(ASSETS_PATH, 'manifest.json');

app.use(cors());

// Load manifest
let manifest: any = null;
try {
  if (fs.existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    console.log(`Loaded manifest with ${manifest.totalAssets || 0} assets.`);
  } else {
    console.warn(`Manifest not found at ${MANIFEST_PATH}`);
  }
} catch (error) {
  console.error('Failed to load manifest:', error);
}

const CACHE_MAX_AGE = 86400; // 1 day default

const setCacheHeaders = (
  res: express.Response,
  maxAge: number = CACHE_MAX_AGE,
  immutable: boolean = true,
) => {
  const cacheDirective = immutable
    ? `public, max-age=${maxAge}, immutable`
    : `public, max-age=${maxAge}`;
  res.set({
    'Cache-Control': cacheDirective,
    Vary: 'Accept-Encoding',
  });
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/manifest.json', (req, res) => {
  if (!manifest) {
    return res.status(503).json({ error: 'Manifest not loaded' });
  }
  setCacheHeaders(res, 300, false);
  res.json(manifest);
});

app.get('/search', (req, res) => {
  if (!manifest) {
    return res.status(503).json({ error: 'Manifest not loaded' });
  }
  const query = String(req.query.q ?? '');
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  const lowercaseQuery = query.toLowerCase();
  const results = manifest.assets.filter(
    (asset: any) =>
      asset.name.toLowerCase().includes(lowercaseQuery) ||
      (asset.tags || []).some((tag: string) => tag.toLowerCase().includes(lowercaseQuery)),
  );
  setCacheHeaders(res, 60, false);
  res.json({ query, results, total: results.length });
});

app.get('/category/:category', (req, res) => {
  if (!manifest) {
    return res.status(503).json({ error: 'Manifest not loaded' });
  }
  const category = req.params.category;
  const page = parseInt(req.query.page as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  let filteredAssets = manifest.assets;
  if (category !== 'all') {
    filteredAssets = manifest.assets.filter((asset: any) => asset.category === category);
  }
  const start = page * limit;
  const end = start + limit;
  const assets = filteredAssets.slice(start, end);
  setCacheHeaders(res, 300, false);
  res.json({
    category,
    page,
    limit,
    assets,
    hasMore: end < filteredAssets.length,
    total: filteredAssets.length,
  });
});

app.get('/asset/:id', (req, res) => {
  if (!manifest) {
    return res.status(503).json({ error: 'Manifest not loaded' });
  }
  const asset = manifest.assets.find((a: any) => a.id === req.params.id);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  setCacheHeaders(res, 86400, true);
  res.json(asset);
});

// For thumbnails and assets in a category tree (back-compat)
const ASSET_CATEGORIES = {
  MAPS: 'maps',
  TOKENS: 'tokens',
  PROPS: 'props',
  BACKGROUNDS: 'backgrounds',
  UI: 'ui',
};

Object.values(ASSET_CATEGORIES).forEach((categoryName) => {
  app.use(
    `/${categoryName}/assets`,
    (req, res, next) => { setCacheHeaders(res); next(); },
    express.static(path.join(ASSETS_PATH, categoryName, 'assets')),
  );
  app.use(
    `/${categoryName}/thumbnails`,
    (req, res, next) => { setCacheHeaders(res); next(); },
    express.static(path.join(ASSETS_PATH, categoryName, 'thumbnails')),
  );
});

app.use(
  '/assets/tokens/custom',
  (req, res, next) => { setCacheHeaders(res); next(); },
  express.static(path.join(ASSETS_PATH, 'tokens', 'custom')),
);

app.use(
  '/assets',
  (req, res, next) => { setCacheHeaders(res); next(); },
  express.static(path.join(ASSETS_PATH, 'assets')),
);

app.use(
  '/users',
  (req, res, next) => { setCacheHeaders(res); next(); },
  express.static(path.join(ASSETS_PATH, 'users'))
);

// User Asset Domain
const upload = multer({ 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file max
  storage: multer.memoryStorage()
});

const USER_QUOTA_BYTES = 50 * 1024 * 1024; // 50MB

async function getUserManifest(userId: string) {
  const manifestPath = path.join(ASSETS_PATH, 'users', userId, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  return { assets: [] };
}

async function saveUserManifest(userId: string, manifest: any) {
  const dir = path.join(ASSETS_PATH, 'users', userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  const files = fs.readdirSync(dirPath);
  let size = 0;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += stat.size;
    }
  }
  return size;
}

// Auth check: rely on VTT proxy to send a specific header `x-nexus-auth: shared-secret`.
// Runs BEFORE multer on the upload route so unauthenticated requests are
// rejected before any file buffering occurs.
function requireNexusAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-nexus-auth'] !== process.env.ASSET_SERVICE_SECRET) {
    // Drain and discard any request body instead of leaving it unconsumed:
    // avoids the client seeing a socket reset while still streaming a large
    // multipart body, and avoids leaving data buffered on the socket.
    req.resume();
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.get('/user/:userId/assets', async (req, res) => {
  const userId = req.params.userId;
  if (!/^[a-zA-Z0-9-]+$/.test(userId)) return res.status(400).json({ error: 'Invalid userId' });
  const manifest = await getUserManifest(userId);
  setCacheHeaders(res, 60, false);
  res.json({ assets: manifest.assets });
});

app.post('/user/:userId/upload', requireNexusAuth, upload.single('file'), async (req, res) => {
  const userId = req.params.userId;
  if (!/^[a-zA-Z0-9-]+$/.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const userDir = path.join(ASSETS_PATH, 'users', userId);
  const currentSize = getDirSize(userDir);
  
  if (currentSize + req.file.size > USER_QUOTA_BYTES) {
    return res.status(413).json({ error: 'Quota exceeded (50MB max)' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.png', '.webp', '.jpg', '.jpeg'].includes(ext)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  const assetId = crypto.randomUUID();
  const filename = `${assetId}${ext}`;
  const filePath = path.join(userDir, filename);

  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  fs.writeFileSync(filePath, req.file.buffer);

  const manifest = await getUserManifest(userId);
  
  const newAsset = {
    id: assetId,
    name: req.body.name || req.file.originalname,
    category: req.body.category || 'custom',
    tags: ['custom'],
    fullImage: `users/${userId}/${filename}`,
    thumbnail: `users/${userId}/${filename}`, // No thumbnail generation yet, use full image
    size: req.file.size,
    source: 'user',
  };

  manifest.assets.push(newAsset);
  await saveUserManifest(userId, manifest);

  res.json({ asset: newAsset });
});

app.delete('/user/:userId/asset/:assetId', requireNexusAuth, async (req, res) => {
  const { userId, assetId } = req.params;
  if (!/^[a-zA-Z0-9-]+$/.test(userId)) return res.status(400).json({ error: 'Invalid userId' });

  const manifest = await getUserManifest(userId);
  const assetIndex = manifest.assets.findIndex((a: any) => a.id === assetId);

  if (assetIndex === -1) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  const asset = manifest.assets[assetIndex];
  const filename = path.basename(asset.fullImage);
  const filePath = path.join(ASSETS_PATH, 'users', userId, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  manifest.assets.splice(assetIndex, 1);
  await saveUserManifest(userId, manifest);

  res.json({ success: true });
});

app.use(
  '/thumbnails',
  (req, res, _next) => { setCacheHeaders(res); _next(); },
  express.static(path.join(ASSETS_PATH, 'thumbnails')),
);

// 3-arg catch-all for unmatched routes — must be registered AFTER all routes.
app.use((req: Request, res: Response) => {
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
      '/user/:userId/assets',
      '/user/:userId/upload',
      '/user/:userId/asset/:assetId',
    ],
  });
});

// 4-arg error handler — must be registered LAST so Express recognizes it as
// an error handler (arity matters to Express's dispatch logic).
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const error = err as { code?: string; message?: string } | undefined;

  if (error?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large (5MB max per file)' });
    return;
  }

  console.error('Asset service error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* istanbul ignore next -- exercised only when run as the main module */
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Asset service listening on port ${port}`);
  });
}

# Static Assets Directory

This directory contains static asset files served by the main Nexus server.

⚠️ **Note:** This is a data directory only - there is no separate asset server process. Assets are served directly by the main backend server in `server/index.ts`.

## Directory Structure

```
static-assets/
└── assets/           # Asset files (~10MB)
    ├── assets/       # Full resolution images
    ├── thumbnails/   # Thumbnail previews
    ├── tokens/       # Token images
    └── manifest.json # Asset metadata catalog
```

## Asset Serving

The main server serves these endpoints:
- `GET /manifest.json` - Asset metadata and categories
- `GET /assets/:filename` - Full resolution images
- `GET /thumbnails/:filename` - Thumbnail images (300x300)
- `GET /search?q=term` - Search assets by name/tags
- `GET /category/:name` - Get assets by category

## Configuration

Set these environment variables in the root `.env` file:
- `ASSETS_PATH` - Path to processed assets (default: ./static-assets/assets)
- `CACHE_MAX_AGE` - Cache header value in seconds (default: 86400)
- `CORS_ORIGIN` - Allowed CORS origin (default: *)

## Asset Processing

Process your map assets before starting the server:

```bash
# From project root
node scripts/process-assets.js /path/to/source/maps ./static-assets/assets
```

This creates:
- `assets/` - Optimized full images
- `thumbnails/` - 300x300 previews
- `manifest.json` - Metadata

## Usage

The assets are served automatically when you run:
```bash
npm run server:dev
# or
npm run start:all
```

Assets will be available at `http://localhost:5000/assets/`

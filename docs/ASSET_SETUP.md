# 🎨 Asset Management Setup Guide

This guide shows you how to set up the external asset server with your 77MB of map assets.

## 📋 Prerequisites

- Node.js 26.5.0+ from the Node 26 line installed
- Your map assets in `/Volumes/PS2000w/DnD_Assets/maps`
- Sharp image processing library: `npm install sharp`

## 🚀 Quick Setup

### Step 1: Install Dependencies

```bash
# Install asset processing dependencies (in project root)
npm install sharp

# Install asset server dependencies
cd asset-server
npm install
cd ..
```

### Step 2: Process Your Assets

```bash
# This will process your 77MB of assets into optimized versions
node scripts/process-assets.js /Volumes/PS2000w/DnD_Assets/maps ./asset-server/assets

# This creates:
# - asset-server/assets/assets/ (optimized WebP images, ~40-50MB)
# - asset-server/assets/thumbnails/ (300x300 previews, ~5-10MB)
# - asset-server/assets/manifest.json (metadata file, ~100KB)
```

### Step 3: Start the Asset Server

```bash
# Development mode (with hot reload)
cd asset-server
npm run dev

# The server will start on http://localhost:8080
# Check health: curl http://localhost:8080/health
```

### Step 4: Configure Frontend

```bash
# Add to your .env file in the project root:
echo "VITE_ASSET_SERVER_URL=http://localhost:8080" >> .env

# Start the main VTT application
npm run dev  # Frontend on 5173
npm run server:dev  # WebSocket server on 5000
```

### Step 5: Test the Integration

1. Open Nexus VTT: http://localhost:5173
2. Go to Settings tab
3. Look for "Asset Library" section (if implemented)
4. You should see your processed map assets!

## 📊 What Happens During Processing?

**Original Assets (77MB)** →

- **WebP Conversion**: Reduces size by ~40% with better quality
- **Resolution Limiting**: Max 2048px to prevent huge images
- **Thumbnail Generation**: 300x300 previews for fast browsing
- **Metadata Extraction**: Dimensions, file sizes, categories
- **Smart Categorization**: Based on folder structure and filenames

**Final Output (~50-60MB total)**:

```
asset-server/assets/
├── manifest.json         # Asset metadata (~100KB)
├── assets/              # Optimized full images (~40-50MB)
│   ├── abc123.webp
│   ├── def456.webp
│   └── ...
└── thumbnails/          # Small previews (~5-10MB)
    ├── abc123_thumb.webp
    ├── def456_thumb.webp
    └── ...
```

## 🐳 Docker Setup (Future)

For production deployment, you'll have this docker-compose.yml:

```yaml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: docker/frontend.Dockerfile
    ports: ['3000:3000']
    environment:
      - VITE_ASSET_SERVER_URL=http://asset-server:8080
    depends_on:
      - asset-server
      - websocket-server

  websocket-server:
    build:
      context: .
      dockerfile: docker/websocket.Dockerfile
    ports: ['5000:5000']

  asset-server:
    build:
      context: .
      dockerfile: docker/assets.Dockerfile
    ports: ['8080:8080']
    volumes:
      - './processed-assets:/app/assets:ro'
    environment:
      - PORT=8080
      - CORS_ORIGIN=*
```

## 🔧 Advanced Configuration

### Environment Variables

**Asset Server (.env in asset-server/):**

```bash
PORT=8080                    # Server port
ASSETS_PATH=./assets         # Path to processed assets
CORS_ORIGIN=*               # CORS settings (* for dev, specific domain for prod)
CACHE_MAX_AGE=86400         # Cache headers (24 hours)
```

**Frontend (.env in project root):**

```bash
VITE_ASSET_SERVER_URL=http://localhost:8080  # Asset server URL
```

### Asset Processing Options

You can customize the processing script in `scripts/process-assets.js`:

```javascript
const THUMBNAIL_SIZE = 300;     // Thumbnail dimensions
const MAX_FULL_SIZE = 2048;     # Max image size
const WEBP_QUALITY = 85;        # Image quality (1-100)
const THUMBNAIL_QUALITY = 80;   # Thumbnail quality
```

## 📈 Performance Benefits

**Without Asset Server (Bundle Everything):**

- ❌ App size: ~100MB
- ❌ Initial load: 30-60 seconds
- ❌ Memory usage: High (all assets loaded)
- ❌ Can't add new assets without app update

**With Asset Server:**

- ✅ App size: ~15MB (core app only)
- ✅ Initial load: 3-5 seconds
- ✅ Memory usage: Low (only cached assets)
- ✅ Thumbnails load instantly
- ✅ Full images load on-demand
- ✅ Smart caching (IndexedDB + HTTP cache)
- ✅ Can add new assets anytime

## 🗂️ Asset Organization Tips

**Folder Structure for Best Results:**

```
/Volumes/PS2000w/DnD_Assets/maps/
├── dungeons/
│   ├── castle-dungeon-01.jpg
│   └── underground-caves.png
├── forests/
│   ├── enchanted-grove.jpg
│   └── dark-woods-path.png
├── cities/
│   ├── medieval-town-square.jpg
│   └── tavern-interior.png
└── wilderness/
    ├── mountain-pass.jpg
    └── desert-oasis.png
```

**The processor will:**

- Use folder names as categories
- Extract keywords from filenames as tags
- Generate searchable metadata
- Create intuitive browsing experience

## 🚨 Troubleshooting

**Asset processing fails:**

```bash
# Check if Sharp is installed
npm list sharp

# Reinstall Sharp if needed
npm install sharp --save

# Check file permissions
ls -la /Volumes/PS2000w/DnD_Assets/maps
```

**Asset server won't start:**

```bash
# Check if port 8080 is in use
lsof -i :8080

# Use different port
PORT=8081 npm run dev
```

**Assets don't show in frontend:**

```bash
# Verify asset server is running
curl http://localhost:8080/health

# Check CORS headers
curl -H "Origin: http://localhost:5173" -v http://localhost:8080/manifest.json

# Check browser console for errors
```

## 🎯 Next Steps

1. **Run the asset processing** on your 77MB collection
2. **Test the asset server** locally
3. **Integrate with scene editor** (we can add an asset browser to the scene background picker)
4. **Optimize for production** when ready to deploy

This approach gives you professional asset management that scales from development to production! 🚀

# Asset Processing Guide

Nexus VTT has two related asset paths:

- Local processed assets under `apps/vtt/static-assets/assets`
- Library assets served by `apps/vtt/services/asset-service`

This guide covers the local processing scripts that prepare images for browser
use.

## Processing Commands

Process a folder of images into the local static asset tree:

```bash
cd apps/vtt
node scripts/process-assets.js /path/to/your/assets ./static-assets/assets
```

Generate thumbnails and a default manifest:

```bash
npm run generate-assets
```

Run the individual steps when needed:

```bash
npm run generate-thumbnails
npm run generate-default-manifest
```

Seed the TMT library data volume or local `assets-data` tree from the configured
asset pack:

```bash
npm run seed:library-assets
```

## Expected Local Output

The local static asset scripts write under:

```text
apps/vtt/static-assets/
  assets/
  thumbnails/
  manifest.json
```

The TMT library seed pack uses this shape:

```text
asset-packs/tmt/
  manifests/manifest-v2.json
  blobs/
  derivatives/
  browse/
  staging/
```

## Supported Source Layout

Source folders can be organized however you like. Descriptive folder and file
names improve categorization:

```text
my-assets/
  maps/
  tokens/
  portraits/
  handouts/
```

The processing script uses folder names, filenames, and metadata to categorize
assets for browsing.

## Common Workflow

1. Put source images somewhere outside the generated output directory.
2. Run `cd apps/vtt && node scripts/process-assets.js /path/to/source ./static-assets/assets`.
3. Run `npm run generate-assets`.
4. Start the app with `npm run start:all`.
5. Confirm the assets appear in the browser.

## Troubleshooting

If image processing fails, reinstall dependencies:

```bash
npm install
```

For large collections, give Node more memory:

```bash
node --max-old-space-size=4096 apps/vtt/scripts/process-assets.js /path/to/assets ./apps/vtt/static-assets/assets
```

If assets are missing in production, check the deployment guide for
`TMT_ASSET_PACK_PATH` and the asset-service volumes:

- [Homelab Deployment](../HOMELAB_DEPLOYMENT.md)
- [Asset Setup](../ASSET_SETUP.md)
- [Asset Guide](../ASSETS-GUIDE.md)

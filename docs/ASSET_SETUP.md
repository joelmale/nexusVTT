# Asset Setup

This guide covers the current Nexus VTT asset setup. The old `asset-server/`
package is no longer part of the repository.

## Current Model

- Local generated assets live under `static-assets/`.
- The standalone asset service lives in `services/asset-service/`.
- Production serves asset-service images from
  `ghcr.io/joelmale/nexusvtt/asset-service`.
- The TMT library seed pack is host-local and configured with
  `TMT_ASSET_PACK_PATH`.

## Local Static Assets

Process a source folder into the local static asset tree:

```bash
node scripts/process-assets.js /path/to/assets ./static-assets/assets
```

Generate thumbnails and a manifest:

```bash
npm run generate-assets
```

The generated tree uses:

```text
static-assets/
  assets/
  thumbnails/
  manifest.json
```

## Library Seed Pack

The TMT library is not committed to the repo. Keep the seed pack on the host:

```text
asset-packs/tmt/
  manifests/manifest-v2.json
  blobs/
  derivatives/
  browse/
  staging/
```

Seed or validate local library assets:

```bash
npm run seed:library-assets
```

In production, set:

```env
TMT_ASSET_PACK_PATH=/srv/nexus/asset-packs/tmt
```

## Asset Service

Build and test the service through the workspace:

```bash
npm run type-check:asset-service
npm run test:asset-service
npm run build:asset-service
```

Production Compose mounts these volumes for the asset service:

- `nexus-assets` at `/app/static-assets/assets`
- `nexus-user-assets` at `/app/static-assets/users`
- `nexus-library-assets` at `/app/assets-data`
- `TMT_ASSET_PACK_PATH` at `/seed/tmt:ro`

The VTT backend reaches the service through:

```env
ASSET_API_URL=http://asset-service:5003
ASSET_SERVICE_SECRET=<shared secret>
```

## Related Docs

- [Asset Processing](assets/processing.md)
- [Asset Guide](ASSETS-GUIDE.md)
- [Asset Service Contract](roadmap/contracts/asset-service-v2.md)
- [Homelab Deployment](HOMELAB_DEPLOYMENT.md)

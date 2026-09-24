---
title: Asset administration
---

# Asset administration

The asset service exposes an **internal** administration API under
`/internal/admin/*` so the private admin console can manage library images
without anyone touching the NAS filesystem (plan invariant 5, Phase 5 of the
[private admin control plane](/platform/private-admin-control-plane)).

The API is called only by `control-api` over the internal Docker network. It
is not proxied by the VTT backend (which forwards only the public read paths
and `/api/user`), nor by the frontend gateway (which forwards only `/assets`).
Browser-facing routes live in `control-api` under `/control-api/v1/assets/*`.

## Scope

The API manages the content-addressed library under `LIBRARY_DATA_PATH`
([ADR-0011](/vtt/roadmap/ADR/storage-layout)): ingested TMT assets from
`manifests/manifest-v2.json` plus assets uploaded through this API. The
bundled legacy manifest (`/manifest.json`) and per-user uploads (`/user/*`,
owned by players through the VTT) are out of scope.

### Admin overlay

`manifest-v2.json` stays owned by `tools/tmt-ingest` (`sync.mjs` rewrites it
and would tombstone anything it did not ingest). Admin changes are therefore
kept in an overlay at `LIBRARY_DATA_PATH/.admin/state.json`:

- admin uploads (full records, `origin: "admin"`, ids `adm-<uuid>`);
- metadata edits and quarantine/deletion status for ingested assets
  (`origin: "library"`);
- a per-asset `version`, provenance and a bounded change history.

The index served by `/library*` is `manifest-v2.json` with the overlay
applied. With no overlay file the served manifest is byte-for-byte the
ingest manifest. If the overlay exists but cannot be parsed, `/library*`
returns `503 source-unavailable` rather than re-publishing quarantined assets;
restore the file (or remove it deliberately) and call `POST /library/reload`.

The `.admin/` tree (overlay, quarantine) is never served:
`/library-assets` rejects any dot-prefixed path segment, including
percent-encoded forms.

## Authentication and audit

Every route requires both headers:

| Header          | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| `x-nexus-admin-auth` | `ASSET_ADMIN_SERVICE_SECRET` (constant-time compare; unset or shorter than 32 characters → all 503) |
| `x-nexus-actor` | Authenticated admin identity, `[A-Za-z0-9][A-Za-z0-9._:@+-]{0,199}` |
| `x-request-id`  | Optional; generated when absent or malformed                     |

Missing/incorrect credentials return `401` before any upload body is read.
An unconfigured admin credential returns `503`, so the endpoint fails closed.
A missing or malformed actor returns `400 actor-required`. Every response
carries `audit: { actor, requestId }` in the body plus `X-Nexus-Actor` and
`X-Request-Id` headers, and each request is logged as a structured
`asset-admin-request` line for correlation with the control-api audit
record. Responses carry asset ids and relative storage keys only — never
absolute paths, NAS locations or the service secret.

## Route reference

All paths are relative to `/internal/admin`. Errors are
`{ error: <code>, message, details?, audit }`.

| Method | Path | Body / query | Success |
| --- | --- | --- | --- |
| GET | `/assets` | `q`, `category`, `tags` (comma list, all must match), `status` (`active`\|`quarantined`\|`removed`\|`deleted`\|`all`; default hides deleted), `origin` (`admin`\|`library`), `cursor`, `limit` (≤100) | `200 { assets[], total, limit, cursor, hasMore }` |
| GET | `/facets` | — | `200 { categories[], tags[], statuses }` |
| GET | `/assets/:id` | — | `200 { asset }` + `ETag: "<id>:<version>"` |
| GET | `/assets/:id/preview` | `variant=thumbnail\|original` | image bytes (also for quarantined assets) |
| POST | `/assets` | multipart: `file` (required), `category` (required), `name`, `tags`, `attribution`, `license`, `source`, `sourceUrl`, `force` | `201 { asset, duplicate:false, duplicateOf? }`, or `200 { asset, duplicate:true, duplicateOf }` |
| PATCH | `/assets/:id` | JSON `name`, `category`, `tags`, `attribution`, `license` + `expectedVersion` (or `If-Match`) | `200 { asset }`; `409 version-conflict`; `428` without a precondition |
| POST | `/assets/:id/derivatives` | — | `200 { asset }` |
| POST | `/assets/:id/delete-preview` | `{ referencingCampaignIds?: string[] }` | `200 { asset, allowedActions, references, sharedFiles, warnings }` |
| POST | `/assets/:id/quarantine` | `{ expectedVersion, reason?, referencingCampaignIds?, acknowledgeReferences? }` | `200 { asset, movedFiles, retainedFiles }`; `409 asset-referenced` if campaigns are listed without acknowledgement |
| POST | `/assets/:id/restore` | `{ expectedVersion }` | `200 { asset, missingFiles }` |
| POST | `/assets/:id/permanent-delete` | `{ expectedVersion, confirm: true }` | `200 { asset, deletedFiles, retainedFiles }`; `409 not-quarantined`; `400 confirmation-required` |
| POST | `/jobs/manifest-rebuild` | `?wait=true` | `202 { job }` (or `200` when finished within 30 s) |
| POST | `/jobs/integrity-report` | `{ verifyHashes? }`, `?wait=true` | `202`/`200 { job }` |
| GET | `/jobs`, `/jobs/:jobId` | — | `200 { jobs[] }` / `200 { job }` |
| GET | `/integrity` | — | `200 { report }` (latest cached), `404 no-report` before the first run |

The `asset` shape: `id`, `origin`, `status`, `version`, `etag`, `name`,
`category`, `tags`, `attribution`, `license`, `source`, `sha256`, `size`,
`mimeType`, `dimensions`, `files { original, thumbnail }` (relative keys),
`publicUrls` (only while active), `derivative`, `provenance` (`createdBy`,
`createdAt`, `originalFilename`, `sourceUrl`, `sourcePath`, `updatedBy`,
`updatedAt`, …), `quarantine`, `deletion`, `history[]`.

`control-api` must pass the VTT's list of campaigns that reference an asset
as `referencingCampaignIds`; the asset service cannot see campaign data.

## Upload validation

1. Size ≤ `ASSET_ADMIN_MAX_UPLOAD_BYTES` (multer limit; `413 file-too-large`).
2. Type by magic bytes only — PNG, JPEG, WebP. SVG, GIF, executables and
   anything else return `415 unsupported-media-type`; the client filename and
   Content-Type are ignored.
3. Polyglot guard: data after the PNG `IEND`, JPEG `EOI` or WebP RIFF length
   returns `415 trailing-data`.
4. Header dimensions ≤ `ASSET_ADMIN_MAX_IMAGE_DIMENSION` per side and
   ≤ `ASSET_ADMIN_MAX_IMAGE_PIXELS` total, checked before any pixel data is
   decoded (decompression-bomb guard; `422 image-too-large`).
5. Full decode by rendering the derivative with sharp `limitInputPixels`
   (`422 image-decode-failed`).
6. SHA-256 duplicate detection against active and quarantined assets: the
   existing asset is returned unless `force=true`.
7. Admin storage quota (`ASSET_ADMIN_STORAGE_QUOTA_BYTES`, `413
   quota-exceeded`).

Files are stored at generated keys, never client filenames:
`blobs/<xx>/<sha256>.<ext>` (original bytes) and
`derivatives/v1/<xx>/<sha256>.webp` (256 px box, WebP q80 — the same spec as
`tools/tmt-ingest/derivatives.mjs`, enforced by a parity test). sharp writes
no input metadata, so EXIF/XMP/GPS is stripped from every derivative. The
original blob is kept byte-for-byte for hash integrity.

## Quarantine and deletion

1. **Preview** — `delete-preview` lists campaign references and any files
   shared with other assets (forced duplicates share a blob).
2. **Quarantine** — moves the asset's files to
   `LIBRARY_DATA_PATH/.admin/quarantine/<same key>` and marks it quarantined.
   It disappears from `/library`, `/library/facets`, `/library/asset/:id` and
   `/library-assets/*`. Files still used by another active asset stay in
   place (`retainedFiles`).
3. **Restore** — moves the files back and republishes.
4. **Permanent delete** — only for quarantined assets, only with
   `confirm: true` and a matching version. The tombstone is committed first,
   then the unshared files are unlinked; a failed unlink leaves an orphan for
   the integrity report, never a record pointing at deleted data.

Every mutation takes `expectedVersion` (or `If-Match`) and returns `409
version-conflict` with the current asset when stale.

## Path safety

Every key is validated lexically (no `..`, `.`, empty or dot-prefixed
segments, absolute paths, backslashes, drive letters, `:`, `%`, NUL) and then
resolved with `realpath`; the target and its nearest existing ancestor must be
beneath the root, and a final-component symlink is refused. Manifest entries
with unsafe keys are reported as `invalidKeys` and never read, moved or
deleted. The integrity walk never follows symlinks.

## Jobs

- **Manifest rebuild** re-reads `manifest-v2.json` and the overlay (the same
  path as `POST /library/reload`), republishes the index and regenerates any
  missing derivative for active assets.
- **Integrity report** walks `blobs/`, `derivatives/` and the quarantine area
  and reports storage usage, orphaned files, missing files, hash mismatches
  (re-hashing originals when `verifyHashes`) and invalid keys. The latest
  report is cached for `GET /integrity` and feeds the metrics. It runs on
  demand and every `ASSET_INTEGRITY_INTERVAL_MS` (first run ≤ 60 s after
  start; the schedule starts only when the service runs as its main module,
  so tests never schedule it).

One job per type runs at a time; a second start returns the running job
(`alreadyRunning: true`). Job history is in memory (last 50).

## Metrics

`GET /metrics` (Prometheus text 0.0.4). When `METRICS_AUTH_TOKEN` is set it
requires `Authorization: Bearer <token>` and fails closed, matching the VTT
backend.

| Metric | Type | Labels |
| --- | --- | --- |
| `asset_objects_total` | gauge | `status` = active, quarantined, removed, deleted |
| `asset_bytes_total` | gauge | `area` = blobs, derivatives, quarantine (latest report) |
| `asset_missing_files` | gauge | — (latest report) |
| `asset_orphaned_files` | gauge | — |
| `asset_hash_mismatches` | gauge | — |
| `asset_manifest_age_seconds` | gauge | — (since the served index was built) |
| `asset_manifest_loaded` | gauge | — |
| `asset_derivative_failures_total` | counter | `operation` = upload, regenerate, rebuild |
| `asset_uploads_total` | counter | `result` = created, duplicate, rejected |
| `asset_upload_rejections_total` | counter | `reason` |
| `asset_lifecycle_operations_total` | counter | `action` = quarantine, restore, permanent-delete |
| `asset_integrity_runs_total` | counter | `result` |
| `asset_integrity_last_run_timestamp_seconds`, `asset_integrity_last_run_duration_seconds` | gauge | — |

Report-derived gauges are absent until the first integrity report completes.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ASSET_ADMIN_SERVICE_SECRET` | _(none)_ | Required; admin API returns 503 when unset or shorter than 32 characters |
| `METRICS_AUTH_TOKEN` | _(unset = open)_ | Bearer token for `/metrics` |
| `ASSET_ADMIN_MAX_UPLOAD_BYTES` | `26214400` (25 MiB) | Per-upload limit |
| `ASSET_ADMIN_MAX_IMAGE_DIMENSION` | `16384` | Max width or height |
| `ASSET_ADMIN_MAX_IMAGE_PIXELS` | `100000000` | Max decoded pixels |
| `ASSET_ADMIN_STORAGE_QUOTA_BYTES` | `10737418240` (10 GiB) | Admin-upload quota; `0` disables |
| `ASSET_INTEGRITY_INTERVAL_MS` | `86400000` (24 h) | Scheduled report; `0` disables |
| `ASSET_INTEGRITY_VERIFY_HASHES` | `true` | Re-hash originals on scheduled runs |

Limits are read per request, so changes apply after a restart without a
rebuild.

## Operating notes

- Back up `LIBRARY_DATA_PATH/.admin/` with the rest of the library volume; it
  is the only record of admin uploads and quarantine state.
- A TMT `sync.mjs` run leaves the overlay untouched. Call
  `POST /internal/admin/jobs/manifest-rebuild` (or `POST /library/reload`)
  afterwards to republish.
- Tests: `npm run test:asset-service` (from `apps/vtt`) covers traversal,
  malicious files, size/quota limits, decompression bombs, duplicates,
  concurrency, quarantine/restore/delete, integrity and metrics, and asserts
  that no response leaks an absolute path or secret.

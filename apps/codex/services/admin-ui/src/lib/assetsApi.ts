/**
 * Asset administration through control-api (`/control-api/v1/assets/*`),
 * which mirrors asset-service `/internal/admin/*` 1:1. See
 * apps/docs/vtt/operations/asset-administration.md for the contract.
 */
import { ApiError, ASSETS_API_BASE, controlJson, jsonRequest, queryString } from './api'

export type AssetStatus = 'active' | 'quarantined' | 'removed' | 'deleted'
export type AssetStatusFilter = AssetStatus | 'all'

export interface AdminAsset {
  id: string
  origin: 'admin' | 'library'
  status: AssetStatus
  version: number
  etag: string
  name: string
  category: string
  tags: string[]
  attribution: string | null
  license: string | null
  source: string
  sha256: string | null
  size: number | null
  mimeType: string | null
  dimensions: { width: number; height: number } | null
  files: { original: string | null; thumbnail: string | null }
  publicUrls: { original: string; thumbnail: string } | null
  derivative: {
    specVersion: string
    generatedAt: string
    generatedBy: string
    width: number
    height: number
    bytes: number
  } | null
  provenance: {
    createdBy: string | null
    createdAt: string | null
    originalFilename: string | null
    sourceUrl: string | null
    sourcePath: string | null
    duplicatePathCount?: number
    removedInRelease?: string | null
    updatedBy: string | null
    updatedAt: string | null
  }
  quarantine: { at: string; by: string; reason?: string; referencingCampaignIds?: string[] } | null
  deletion: { at: string; by: string } | null
  history: Array<{ at: string; actor: string; action: string; version: number }>
}

export interface AssetListQuery {
  q?: string
  category?: string
  tags?: string[]
  status?: AssetStatusFilter
  origin?: 'admin' | 'library'
  cursor?: string | null
  limit?: number
}

export interface AssetListResponse {
  assets: AdminAsset[]
  total: number
  limit: number
  /** Cursor for the next page, or null on the last page. */
  cursor: string | null
  hasMore: boolean
}

export interface FacetCount {
  name: string
  count: number
}

export interface AssetFacets {
  categories: FacetCount[]
  tags: FacetCount[]
  statuses: Partial<Record<AssetStatus, number>>
}

export interface AssetUploadFields {
  category: string
  name?: string
  tags?: string[]
  attribution?: string
  license?: string
  source?: string
  sourceUrl?: string
  force?: boolean
}

export interface AssetUploadResult {
  asset: AdminAsset
  duplicate: boolean
  duplicateOf?: string
}

export interface AssetMetadataPatch {
  name?: string
  category?: string
  tags?: string[]
  attribution?: string | null
  license?: string | null
}

export interface DeletePreview {
  asset: AdminAsset
  allowedActions: { quarantine: boolean; restore: boolean; permanentDelete: boolean }
  references: { campaignIds: string[]; count: number }
  sharedFiles: Array<{ key: string; otherAssetIds: string[] }>
  warnings: string[]
}

export type AssetJobType = 'manifest-rebuild' | 'integrity-report'

export interface AssetJob {
  id: string
  type: AssetJobType
  status: 'running' | 'succeeded' | 'failed'
  actor: string
  requestId: string | null
  startedAt: string
  finishedAt: string | null
  result: unknown
  error: { code: string; message: string } | null
}

export interface IntegrityReport {
  id: string
  startedAt: string
  finishedAt: string
  durationMs: number
  verifyHashes: boolean
  storage: {
    blobs: { files: number; bytes: number }
    derivatives: { files: number; bytes: number }
    quarantine: { files: number; bytes: number }
    totalBytes: number
  }
  assets: Record<AssetStatus, number>
  counts: {
    orphanedFiles: number
    missingFiles: number
    hashMismatches: number
    invalidKeys: number
    symlinksSkipped: number
    hashesVerified: number
  }
  orphanedFiles: Array<{ key: string; location: 'live' | 'quarantine'; bytes?: number; assetIds?: string[] }>
  missingFiles: Array<{ key: string; location: 'live' | 'quarantine'; bytes?: number; assetIds?: string[] }>
  hashMismatches: Array<{ key: string; location: 'live' | 'quarantine'; assetIds: string[]; expected: string; actual: string }>
  invalidKeys: Array<{ assetId: string; field: 'original' | 'thumbnail' }>
  truncated: boolean
}

/**
 * Upload hints for the form. The asset service checks the real limit
 * (`ASSET_ADMIN_MAX_UPLOAD_BYTES`, 25 MiB by default) and the type by magic
 * bytes; these only let the browser reject obvious mistakes early.
 */
export const ASSET_UPLOAD_MAX_BYTES = 25 * 1024 * 1024
export const ASSET_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const ASSET_UPLOAD_ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'

/** Why a file cannot be uploaded, or null when it passes the client-side hints. */
export function assetUploadProblem(file: File): string | null {
  if (file.size > ASSET_UPLOAD_MAX_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(ASSET_UPLOAD_MAX_BYTES)}.`
  }
  if (file.size === 0) return `${file.name} is empty.`
  if (file.type && !(ASSET_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} is ${file.type}; only PNG, JPEG and WebP images are accepted.`
  }
  return null
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${units[i]}`
}

const asset = (id: string) => `${ASSETS_API_BASE}/assets/${encodeURIComponent(id)}`

/** Same-origin preview image (served for quarantined assets too). */
export function assetPreviewUrl(id: string, variant: 'thumbnail' | 'original' = 'thumbnail'): string {
  return `${asset(id)}/preview${queryString({ variant })}`
}

export function listAssets(query: AssetListQuery): Promise<AssetListResponse> {
  return controlJson(
    `${ASSETS_API_BASE}/assets${queryString({
      q: query.q?.trim(),
      category: query.category,
      tags: query.tags && query.tags.length > 0 ? query.tags.join(',') : undefined,
      status: query.status,
      origin: query.origin,
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    })}`,
  )
}

export async function getAssetFacets(): Promise<AssetFacets> {
  const raw = await controlJson<Partial<AssetFacets>>(`${ASSETS_API_BASE}/facets`)
  return { categories: raw.categories ?? [], tags: raw.tags ?? [], statuses: raw.statuses ?? {} }
}

export async function getAsset(id: string): Promise<AdminAsset> {
  return (await controlJson<{ asset: AdminAsset }>(asset(id))).asset
}

export function uploadAsset(file: File, fields: AssetUploadFields): Promise<AssetUploadResult> {
  const form = new FormData()
  form.append('category', fields.category)
  if (fields.name) form.append('name', fields.name)
  if (fields.tags && fields.tags.length > 0) form.append('tags', JSON.stringify(fields.tags))
  if (fields.attribution) form.append('attribution', fields.attribution)
  if (fields.license) form.append('license', fields.license)
  if (fields.source) form.append('source', fields.source)
  if (fields.sourceUrl) form.append('sourceUrl', fields.sourceUrl)
  if (fields.force) form.append('force', 'true')
  // The file goes last so the service sees every field before the bytes.
  form.append('file', file, file.name)
  return controlJson(`${ASSETS_API_BASE}/assets`, { method: 'POST', body: form })
}

/** PATCH with both `expectedVersion` and `If-Match`; a stale version is a 409. */
export async function updateAssetMetadata(
  id: string,
  expectedVersion: number,
  patch: AssetMetadataPatch,
): Promise<AdminAsset> {
  const result = await controlJson<{ asset: AdminAsset }>(
    asset(id),
    jsonRequest('PATCH', { ...patch, expectedVersion }, { 'If-Match': `"${id}:${expectedVersion}"` }),
  )
  return result.asset
}

export async function regenerateDerivatives(id: string): Promise<AdminAsset> {
  return (await controlJson<{ asset: AdminAsset }>(`${asset(id)}/derivatives`, jsonRequest('POST'))).asset
}

export function deletePreview(id: string): Promise<DeletePreview> {
  return controlJson(`${asset(id)}/delete-preview`, jsonRequest('POST', {}))
}

export function quarantineAsset(
  id: string,
  body: { expectedVersion: number; reason?: string; acknowledgeReferences?: boolean },
): Promise<{ asset: AdminAsset; movedFiles: string[]; retainedFiles: string[] }> {
  return controlJson(`${asset(id)}/quarantine`, jsonRequest('POST', body))
}

export function restoreAsset(
  id: string,
  expectedVersion: number,
): Promise<{ asset: AdminAsset; missingFiles: string[] }> {
  return controlJson(`${asset(id)}/restore`, jsonRequest('POST', { expectedVersion }))
}

export function permanentlyDeleteAsset(
  id: string,
  expectedVersion: number,
): Promise<{ asset: AdminAsset; deletedFiles: string[]; retainedFiles: string[] }> {
  return controlJson(`${asset(id)}/permanent-delete`, jsonRequest('POST', { expectedVersion, confirm: true }))
}

export async function listAssetJobs(): Promise<AssetJob[]> {
  return (await controlJson<{ jobs: AssetJob[] }>(`${ASSETS_API_BASE}/jobs`)).jobs ?? []
}

export async function startAssetJob(type: AssetJobType, options: { verifyHashes?: boolean } = {}): Promise<AssetJob> {
  const body = type === 'integrity-report' ? { verifyHashes: options.verifyHashes ?? false } : {}
  return (await controlJson<{ job: AssetJob }>(`${ASSETS_API_BASE}/jobs/${type}`, jsonRequest('POST', body))).job
}

/** Latest cached integrity report, or null before the first run (`404 no-report`). */
export async function getIntegrityReport(): Promise<IntegrityReport | null> {
  try {
    return (await controlJson<{ report: IntegrityReport }>(`${ASSETS_API_BASE}/integrity`)).report
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** The current asset carried by a `409 version-conflict`, if the body has it. */
export function conflictAsset(error: unknown): AdminAsset | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const body = error.body as { details?: { asset?: AdminAsset }; asset?: AdminAsset } | undefined
  return body?.details?.asset ?? body?.asset ?? null
}

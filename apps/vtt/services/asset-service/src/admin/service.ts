import crypto from 'crypto';
import fs from 'fs';
import type { LibraryManifest } from '../library';
import {
  buildCatalog,
  toAdminView,
  toPublicManifest,
  type AdminAssetView,
  type AdminViewStatus,
  type Catalog,
  type CatalogEntry,
} from './catalog';
import type { AdminConfig } from './config';
import { blobKey, derivativeKey, DERIVATIVE_SPEC_VERSION, renderDerivative } from './derivativeSpec';
import { AdminError } from './errors';
import { validateImageBuffer, sha256Hex } from './imageValidation';
import { runIntegrityScan, type IntegrityReport } from './integrity';
import { JobRunner, type JobRecord } from './jobs';
import type { AssetMetrics } from './metrics';
import { resolveWithinRoot } from './pathSafety';
import {
  emptyAdminState,
  loadAdminState,
  MAX_HISTORY_ENTRIES,
  moveFile,
  Mutex,
  quarantineRoot,
  saveAdminState,
  writeFileAtomic,
  type AdminAssetRecord,
  type AdminState,
} from './state';
import {
  defaultNameFromFilename,
  sanitizeOriginalFilename,
  type MetadataPatch,
  type UploadFields,
} from './validation';

export interface ActorContext {
  actor: string;
  requestId: string;
}

export interface AdminServiceOptions {
  libraryRoot: string;
  metrics: AssetMetrics;
  getConfig: () => AdminConfig;
  /**
   * Re-reads manifest-v2.json and the admin overlay from disk and rebuilds
   * the public library index — the existing `/library/reload` path.
   */
  reloadFromDisk: () => { ok: boolean };
  /** Rebuilds the public library index from the cached manifest + overlay. */
  publishIndex: () => void;
}

export interface ListQuery {
  q?: string;
  category?: string;
  tags?: string[];
  status?: AdminViewStatus | 'all';
  origin?: 'admin' | 'library';
  limit: number;
  offset: number;
}

const LIST_STATUSES = new Set<AdminViewStatus>(['active', 'quarantined', 'removed']);
const REBUILD_CONCURRENCY = 4;

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function entryKeys(entry: CatalogEntry): string[] {
  return [...new Set([entry.originalKey, entry.thumbnailKey].filter((k): k is string => !!k))];
}

function logAdmin(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: 'asset-admin', ...event }));
}

export class AdminAssetService {
  readonly jobs = new JobRunner();
  private readonly mutex = new Mutex();
  private state: AdminState | null = emptyAdminState();
  private base: LibraryManifest | null = null;
  private catalog: Catalog = buildCatalog(null, emptyAdminState());
  private latestIntegrity: IntegrityReport | null = null;
  private integrityTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: AdminServiceOptions) {
    options.metrics.setObjectCountSource(() => (this.state ? { ...this.catalog.counts } : null));
  }

  get libraryRoot(): string {
    return this.options.libraryRoot;
  }

  private get quarantineRoot(): string {
    return quarantineRoot(this.options.libraryRoot);
  }

  // ---------------------------------------------------------------------------
  // Public-index integration (called from index.ts)
  // ---------------------------------------------------------------------------

  /** Re-reads the overlay. Returns false (and fails closed) when unreadable. */
  loadStateFromDisk(): boolean {
    try {
      this.state = loadAdminState(this.options.libraryRoot);
    } catch (error) {
      this.state = null;
      console.error(
        JSON.stringify({
          event: 'asset-admin-state-unreadable',
          code: (error as NodeJS.ErrnoException).code ?? (error as Error).name,
        }),
      );
    }
    this.rebuildCatalog();
    return this.state !== null;
  }

  setBaseManifest(base: LibraryManifest | null): void {
    this.base = base;
    this.rebuildCatalog();
  }

  /**
   * The manifest `/library` serves. Null when the ingest manifest is missing
   * or the overlay is unreadable: an unreadable overlay must not silently
   * re-publish quarantined assets.
   */
  getPublicManifest(): LibraryManifest | null {
    if (!this.state) return null;
    return toPublicManifest(this.base, this.state);
  }

  isStateReadable(): boolean {
    return this.state !== null;
  }

  private rebuildCatalog(): void {
    this.catalog = buildCatalog(this.base, this.state ?? emptyAdminState());
  }

  private requireState(): AdminState {
    if (!this.state) {
      throw new AdminError(503, 'admin-state-unavailable', 'Asset admin state is unreadable');
    }
    return this.state;
  }

  private async commit(next: AdminState): Promise<void> {
    await saveAdminState(this.options.libraryRoot, next);
    this.state = next;
    this.rebuildCatalog();
    this.options.publishIndex();
  }

  private requireEntry(id: string): CatalogEntry {
    this.requireState();
    const entry = this.catalog.byId.get(id);
    if (!entry) throw new AdminError(404, 'asset-not-found', 'Asset not found', { assetId: id });
    return entry;
  }

  private view(id: string): AdminAssetView {
    return toAdminView(this.requireEntry(id));
  }

  private assertVersion(entry: CatalogEntry, expectedVersion: number): void {
    if (entry.version !== expectedVersion) {
      throw new AdminError(409, 'version-conflict', 'Asset was modified by another request', {
        assetId: entry.id,
        expectedVersion,
        currentVersion: entry.version,
        asset: toAdminView(entry),
      });
    }
  }

  /** Returns the overlay record for `entry` in `state`, creating a library overlay if needed. */
  private recordFor(state: AdminState, entry: CatalogEntry): AdminAssetRecord {
    const existing = state.records[entry.id];
    if (existing) return existing;
    const record: AdminAssetRecord = {
      id: entry.id,
      origin: 'library',
      version: entry.version,
      status: 'active',
      provenance: {},
      history: [],
    };
    state.records[entry.id] = record;
    return record;
  }

  private touch(record: AdminAssetRecord, context: ActorContext, action: string): void {
    record.version += 1;
    const at = now();
    record.provenance.updatedBy = context.actor;
    record.provenance.updatedAt = at;
    record.history.push({ at, actor: context.actor, action, version: record.version });
    if (record.history.length > MAX_HISTORY_ENTRIES) {
      record.history.splice(0, record.history.length - MAX_HISTORY_ENTRIES);
    }
  }

  /** Other non-deleted entries (optionally only active ones) that reference `key`. */
  private otherReferences(key: string, selfId: string, statuses: AdminViewStatus[]): string[] {
    const ids: string[] = [];
    for (const entry of this.catalog.entries) {
      if (entry.id === selfId || !statuses.includes(entry.status)) continue;
      if (entry.originalKey === key || entry.thumbnailKey === key) ids.push(entry.id);
    }
    return ids;
  }

  // ---------------------------------------------------------------------------
  // Browse
  // ---------------------------------------------------------------------------

  list(query: ListQuery) {
    this.requireState();
    const q = query.q?.trim().toLowerCase();
    const filtered = this.catalog.entries.filter((entry) => {
      if (query.status === undefined) {
        if (!LIST_STATUSES.has(entry.status)) return false;
      } else if (query.status !== 'all' && entry.status !== query.status) {
        return false;
      }
      if (query.origin && entry.origin !== query.origin) return false;
      if (query.category && entry.category !== query.category) return false;
      if (query.tags?.length && !query.tags.every((tag) => entry.tags.includes(tag))) {
        return false;
      }
      if (q && !entry.searchText.includes(q)) return false;
      return true;
    });
    const page = filtered.slice(query.offset, query.offset + query.limit);
    const nextOffset = query.offset + query.limit;
    return {
      assets: page.map(toAdminView),
      total: filtered.length,
      limit: query.limit,
      nextOffset: nextOffset < filtered.length ? nextOffset : null,
    };
  }

  facets() {
    this.requireState();
    const categories = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const entry of this.catalog.entries) {
      if (entry.status === 'deleted') continue;
      categories.set(entry.category, (categories.get(entry.category) ?? 0) + 1);
      for (const tag of entry.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
    const sorted = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      categories: sorted(categories),
      tags: sorted(tags).slice(0, 200),
      statuses: { ...this.catalog.counts },
    };
  }

  get(id: string): AdminAssetView {
    return this.view(id);
  }

  /**
   * Resolves a preview file for an asset, from the live tree or quarantine.
   * Returns an absolute path for streaming only; it never leaves the service.
   */
  async previewFile(id: string, variant: 'original' | 'thumbnail') {
    const entry = this.requireEntry(id);
    const key = variant === 'original' ? entry.originalKey : entry.thumbnailKey;
    if (!key || entry.status === 'deleted') {
      throw new AdminError(404, 'file-not-found', 'Preview is not available');
    }
    for (const root of [this.options.libraryRoot, this.quarantineRoot]) {
      if (!fs.existsSync(root)) continue;
      const resolved = await resolveWithinRoot(root, key);
      if (resolved.exists) {
        return { absolutePath: resolved.absolutePath, key, mimeType: entry.mimeType };
      }
    }
    throw new AdminError(404, 'file-not-found', 'Preview file is missing', { key });
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  private async ensureLiveFile(key: string, data: Buffer, expectedSha?: string): Promise<void> {
    const live = await resolveWithinRoot(this.options.libraryRoot, key);
    if (live.exists) {
      if (expectedSha && sha256Hex(await fs.promises.readFile(live.absolutePath)) === expectedSha) {
        return;
      }
      await writeFileAtomic(live.absolutePath, data);
      return;
    }
    if (fs.existsSync(this.quarantineRoot)) {
      const quarantined = await resolveWithinRoot(this.quarantineRoot, key);
      if (quarantined.exists) {
        await moveFile(quarantined.absolutePath, live.absolutePath);
        return;
      }
    }
    await writeFileAtomic(live.absolutePath, data);
  }

  private adminStorageBytes(state: AdminState): number {
    const seen = new Set<string>();
    let bytes = 0;
    for (const record of Object.values(state.records)) {
      if (record.origin !== 'admin' || record.status === 'deleted' || !record.sha256) continue;
      if (seen.has(record.sha256)) continue;
      seen.add(record.sha256);
      bytes += record.size ?? 0;
    }
    return bytes;
  }

  async upload(input: {
    buffer: Buffer;
    originalFilename: string | undefined;
    fields: UploadFields;
    force: boolean;
    context: ActorContext;
  }): Promise<{ asset: AdminAssetView; duplicate: boolean; duplicateOf?: string }> {
    this.requireState();
    const config = this.options.getConfig();
    const metrics = this.options.metrics;
    let image;
    let derivative;
    try {
      image = await validateImageBuffer(input.buffer, config);
      try {
        derivative = await renderDerivative(input.buffer, config.maxImagePixels);
      } catch {
        throw new AdminError(422, 'image-decode-failed', 'Image could not be decoded');
      }
    } catch (error) {
      metrics.uploads.inc('rejected');
      metrics.uploadRejections.inc(error instanceof AdminError ? error.code : 'internal');
      throw error;
    }

    return this.mutex.run(async () => {
      const state = this.requireState();
      const duplicate = this.catalog.entries.find(
        (entry) =>
          entry.sha256 === image.sha256 &&
          (entry.status === 'active' || entry.status === 'quarantined'),
      );
      if (duplicate && !input.force) {
        metrics.uploads.inc('duplicate');
        return { asset: toAdminView(duplicate), duplicate: true, duplicateOf: duplicate.id };
      }

      if (
        config.storageQuotaBytes > 0 &&
        this.adminStorageBytes(state) + image.size > config.storageQuotaBytes
      ) {
        metrics.uploads.inc('rejected');
        metrics.uploadRejections.inc('quota-exceeded');
        throw new AdminError(413, 'quota-exceeded', 'Admin asset storage quota exceeded', {
          quotaBytes: config.storageQuotaBytes,
        });
      }

      const original = blobKey(image.sha256, image.type.ext);
      const thumbnail = derivativeKey(image.sha256);
      await this.ensureLiveFile(original, input.buffer, image.sha256);
      try {
        await this.ensureLiveFile(thumbnail, derivative.data);
      } catch (error) {
        metrics.derivativeFailures.inc('upload');
        throw error;
      }

      const at = now();
      const originalFilename = sanitizeOriginalFilename(input.originalFilename);
      const id = `adm-${crypto.randomUUID()}`;
      const record: AdminAssetRecord = {
        id,
        origin: 'admin',
        version: 1,
        status: 'active',
        name: input.fields.name ?? defaultNameFromFilename(originalFilename) ?? id,
        category: input.fields.category,
        tags: input.fields.tags ?? [],
        attribution: input.fields.attribution ?? null,
        license: input.fields.license ?? null,
        sha256: image.sha256,
        ext: image.type.ext,
        mimeType: image.type.mime,
        size: image.size,
        dimensions: { width: image.width, height: image.height },
        source: input.fields.source ?? 'admin-upload',
        provenance: {
          createdBy: input.context.actor,
          createdAt: at,
          originalFilename,
          sourceUrl: input.fields.sourceUrl,
        },
        derivative: {
          specVersion: DERIVATIVE_SPEC_VERSION,
          generatedAt: at,
          generatedBy: input.context.actor,
          width: derivative.width,
          height: derivative.height,
          bytes: derivative.data.length,
        },
        history: [{ at, actor: input.context.actor, action: 'upload', version: 1 }],
      };
      const next = clone(state);
      next.records[id] = record;
      await this.commit(next);
      metrics.uploads.inc('created');
      logAdmin({ action: 'upload', assetId: id, ...input.context, duplicateOf: duplicate?.id });
      return { asset: this.view(id), duplicate: false, duplicateOf: duplicate?.id };
    });
  }

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  updateMetadata(id: string, expectedVersion: number, patch: MetadataPatch, context: ActorContext) {
    return this.mutex.run(async () => {
      const entry = this.requireEntry(id);
      if (entry.status === 'deleted') {
        throw new AdminError(409, 'asset-deleted', 'Deleted assets cannot be edited');
      }
      this.assertVersion(entry, expectedVersion);
      const next = clone(this.requireState());
      const record = this.recordFor(next, entry);
      if (patch.name !== undefined) record.name = patch.name;
      if (patch.category !== undefined) record.category = patch.category;
      if (patch.tags !== undefined) record.tags = patch.tags;
      if (patch.attribution !== undefined) record.attribution = patch.attribution;
      if (patch.license !== undefined) record.license = patch.license;
      this.touch(record, context, `metadata:${Object.keys(patch).sort().join(',')}`);
      await this.commit(next);
      logAdmin({ action: 'metadata-update', assetId: id, fields: Object.keys(patch), ...context });
      return this.view(id);
    });
  }

  // ---------------------------------------------------------------------------
  // Derivatives
  // ---------------------------------------------------------------------------

  private async regenerateFiles(entry: CatalogEntry, maxPixels: number) {
    if (!entry.originalKey || !entry.thumbnailKey) {
      throw new AdminError(409, 'invalid-keys', 'Asset has no valid storage keys');
    }
    const source = await resolveWithinRoot(this.options.libraryRoot, entry.originalKey);
    if (!source.exists) {
      throw new AdminError(409, 'original-missing', 'Original file is missing', {
        key: entry.originalKey,
      });
    }
    const target = await resolveWithinRoot(this.options.libraryRoot, entry.thumbnailKey);
    // Read into memory rather than handing libvips the path: libvips caches
    // open file handles, which on Windows blocks later quarantine moves.
    const rendered = await renderDerivative(await fs.promises.readFile(source.absolutePath), maxPixels);
    await writeFileAtomic(target.absolutePath, rendered.data);
    return rendered;
  }

  regenerateDerivative(id: string, context: ActorContext) {
    return this.mutex.run(async () => {
      const entry = this.requireEntry(id);
      if (entry.status !== 'active') {
        throw new AdminError(409, 'invalid-state', 'Only active assets can be regenerated', {
          status: entry.status,
        });
      }
      let rendered;
      try {
        rendered = await this.regenerateFiles(entry, this.options.getConfig().maxImagePixels);
      } catch (error) {
        if (error instanceof AdminError) throw error;
        this.options.metrics.derivativeFailures.inc('regenerate');
        throw new AdminError(422, 'derivative-failed', 'Derivative could not be generated');
      }
      const next = clone(this.requireState());
      const record = this.recordFor(next, entry);
      const at = now();
      record.derivative = {
        specVersion: DERIVATIVE_SPEC_VERSION,
        generatedAt: at,
        generatedBy: context.actor,
        width: rendered.width,
        height: rendered.height,
        bytes: rendered.data.length,
      };
      this.touch(record, context, 'derivative-regenerate');
      await this.commit(next);
      logAdmin({ action: 'derivative-regenerate', assetId: id, ...context });
      return this.view(id);
    });
  }

  // ---------------------------------------------------------------------------
  // Quarantine and deletion
  // ---------------------------------------------------------------------------

  deletePreview(id: string, referencingCampaignIds: string[]) {
    const entry = this.requireEntry(id);
    const sharedFiles = entryKeys(entry)
      .map((key) => ({
        key,
        otherAssetIds: this.otherReferences(key, id, ['active', 'quarantined', 'removed']),
      }))
      .filter((shared) => shared.otherAssetIds.length > 0);
    const warnings: string[] = [];
    if (referencingCampaignIds.length > 0) {
      warnings.push(
        `Referenced by ${referencingCampaignIds.length} campaign(s); scenes using this asset will show a missing image.`,
      );
    }
    for (const shared of sharedFiles) {
      warnings.push(
        `File ${shared.key} is shared with ${shared.otherAssetIds.join(', ')} and is kept while they use it.`,
      );
    }
    if (entry.status === 'quarantined') {
      warnings.push('Permanent deletion cannot be undone.');
    }
    return {
      asset: toAdminView(entry),
      allowedActions: {
        quarantine: entry.status === 'active',
        restore: entry.status === 'quarantined',
        permanentDelete: entry.status === 'quarantined',
      },
      references: { campaignIds: referencingCampaignIds, count: referencingCampaignIds.length },
      sharedFiles,
      warnings,
    };
  }

  quarantine(
    id: string,
    input: {
      expectedVersion: number;
      reason?: string;
      referencingCampaignIds: string[];
      acknowledgeReferences: boolean;
    },
    context: ActorContext,
  ) {
    return this.mutex.run(async () => {
      const entry = this.requireEntry(id);
      if (entry.status !== 'active') {
        throw new AdminError(409, 'invalid-state', 'Only active assets can be quarantined', {
          status: entry.status,
        });
      }
      this.assertVersion(entry, input.expectedVersion);
      if (input.referencingCampaignIds.length > 0 && !input.acknowledgeReferences) {
        throw new AdminError(
          409,
          'asset-referenced',
          'Asset is referenced by campaigns; resend with acknowledgeReferences=true',
          { preview: this.deletePreview(id, input.referencingCampaignIds) },
        );
      }

      await fs.promises.mkdir(this.quarantineRoot, { recursive: true });
      const moved: { key: string; from: string; to: string }[] = [];
      const retained: { key: string; sharedWith: string[] }[] = [];
      try {
        for (const key of entryKeys(entry)) {
          const sharedWith = this.otherReferences(key, id, ['active']);
          if (sharedWith.length > 0) {
            retained.push({ key, sharedWith });
            continue;
          }
          const live = await resolveWithinRoot(this.options.libraryRoot, key);
          if (!live.exists) continue;
          const target = await resolveWithinRoot(this.quarantineRoot, key);
          await moveFile(live.absolutePath, target.absolutePath);
          moved.push({ key, from: live.absolutePath, to: target.absolutePath });
        }

        const next = clone(this.requireState());
        const record = this.recordFor(next, entry);
        record.status = 'quarantined';
        record.quarantine = {
          at: now(),
          by: context.actor,
          reason: input.reason,
          referencingCampaignIds: input.referencingCampaignIds,
        };
        this.touch(record, context, 'quarantine');
        await this.commit(next);
      } catch (error) {
        for (const file of moved.reverse()) {
          await moveFile(file.to, file.from).catch(() => undefined);
        }
        throw error;
      }
      this.options.metrics.lifecycleOperations.inc('quarantine');
      logAdmin({ action: 'quarantine', assetId: id, ...context });
      return {
        asset: this.view(id),
        movedFiles: moved.map((file) => file.key),
        retainedFiles: retained,
      };
    });
  }

  restore(id: string, expectedVersion: number, context: ActorContext) {
    return this.mutex.run(async () => {
      const entry = this.requireEntry(id);
      if (entry.status !== 'quarantined') {
        throw new AdminError(409, 'invalid-state', 'Only quarantined assets can be restored', {
          status: entry.status,
        });
      }
      this.assertVersion(entry, expectedVersion);
      const moved: { from: string; to: string }[] = [];
      const missingFiles: string[] = [];
      try {
        for (const key of entryKeys(entry)) {
          const live = await resolveWithinRoot(this.options.libraryRoot, key);
          if (live.exists) continue;
          const quarantined = fs.existsSync(this.quarantineRoot)
            ? await resolveWithinRoot(this.quarantineRoot, key)
            : null;
          if (!quarantined?.exists) {
            missingFiles.push(key);
            continue;
          }
          await moveFile(quarantined.absolutePath, live.absolutePath);
          moved.push({ from: quarantined.absolutePath, to: live.absolutePath });
        }
        const next = clone(this.requireState());
        const record = this.recordFor(next, entry);
        record.status = 'active';
        delete record.quarantine;
        this.touch(record, context, 'restore');
        await this.commit(next);
      } catch (error) {
        for (const file of moved.reverse()) {
          await moveFile(file.to, file.from).catch(() => undefined);
        }
        throw error;
      }
      this.options.metrics.lifecycleOperations.inc('restore');
      logAdmin({ action: 'restore', assetId: id, ...context });
      return { asset: this.view(id), missingFiles };
    });
  }

  permanentlyDelete(
    id: string,
    input: { expectedVersion: number; confirm: boolean },
    context: ActorContext,
  ) {
    return this.mutex.run(async () => {
      const entry = this.requireEntry(id);
      if (entry.status !== 'quarantined') {
        throw new AdminError(
          409,
          'not-quarantined',
          'Only quarantined assets can be permanently deleted',
          { status: entry.status },
        );
      }
      if (!input.confirm) {
        throw new AdminError(
          400,
          'confirmation-required',
          'Permanent deletion requires confirm=true',
        );
      }
      this.assertVersion(entry, input.expectedVersion);

      const toDelete: string[] = [];
      const retained: { key: string; sharedWith: string[] }[] = [];
      for (const key of entryKeys(entry)) {
        const sharedWith = this.otherReferences(key, id, ['active', 'quarantined', 'removed']);
        if (sharedWith.length > 0) retained.push({ key, sharedWith });
        else toDelete.push(key);
      }

      // Commit the tombstone first: a failed unlink leaves an orphan the
      // integrity report finds, never a record pointing at deleted files.
      const next = clone(this.requireState());
      const record = this.recordFor(next, entry);
      record.status = 'deleted';
      record.deletion = { at: now(), by: context.actor };
      this.touch(record, context, 'permanent-delete');
      await this.commit(next);

      const deletedFiles: string[] = [];
      for (const key of toDelete) {
        for (const root of [this.quarantineRoot, this.options.libraryRoot]) {
          if (!fs.existsSync(root)) continue;
          const resolved = await resolveWithinRoot(root, key);
          if (!resolved.exists) continue;
          await fs.promises.unlink(resolved.absolutePath);
          if (!deletedFiles.includes(key)) deletedFiles.push(key);
        }
      }
      this.options.metrics.lifecycleOperations.inc('permanent-delete');
      logAdmin({ action: 'permanent-delete', assetId: id, ...context, deletedFiles });
      return { asset: this.view(id), deletedFiles, retainedFiles: retained };
    });
  }

  // ---------------------------------------------------------------------------
  // Jobs
  // ---------------------------------------------------------------------------

  startManifestRebuild(context: ActorContext) {
    return this.jobs.start('manifest-rebuild', context, async () => {
      const reloaded = await this.mutex.run(async () => this.options.reloadFromDisk());
      if (!reloaded.ok) {
        throw new AdminError(503, 'source-unavailable', 'Library manifest could not be loaded');
      }
      const maxPixels = this.options.getConfig().maxImagePixels;
      const active = this.catalog.entries.filter((entry) => entry.status === 'active');
      let checked = 0;
      let regenerated = 0;
      let failed = 0;
      const failedAssetIds: string[] = [];
      const missingOriginalIds: string[] = [];
      let missingOriginals = 0;

      const work = async (entry: CatalogEntry) => {
        checked += 1;
        try {
          if (!entry.originalKey || !entry.thumbnailKey) throw new Error('invalid-keys');
          const thumb = await resolveWithinRoot(this.options.libraryRoot, entry.thumbnailKey);
          if (thumb.exists) return;
          const original = await resolveWithinRoot(this.options.libraryRoot, entry.originalKey);
          if (!original.exists) {
            missingOriginals += 1;
            if (missingOriginalIds.length < 100) missingOriginalIds.push(entry.id);
            return;
          }
          // Under the mutex so a concurrent quarantine cannot move the
          // original while its derivative is being written back.
          const done = await this.mutex.run(async () => {
            const current = this.catalog.byId.get(entry.id);
            if (current?.status !== 'active') return false;
            await this.regenerateFiles(current, maxPixels);
            return true;
          });
          if (done) regenerated += 1;
        } catch {
          failed += 1;
          this.options.metrics.derivativeFailures.inc('rebuild');
          if (failedAssetIds.length < 100) failedAssetIds.push(entry.id);
        }
      };

      for (let i = 0; i < active.length; i += REBUILD_CONCURRENCY) {
        await Promise.all(active.slice(i, i + REBUILD_CONCURRENCY).map(work));
      }
      logAdmin({ action: 'manifest-rebuild', ...context, regenerated, failed });
      return {
        publicAssets: this.getPublicManifest()?.totalAssets ?? 0,
        statuses: { ...this.catalog.counts },
        derivatives: { checked, regenerated, failed, failedAssetIds },
        missingOriginals: { count: missingOriginals, assetIds: missingOriginalIds },
      };
    });
  }

  startIntegrityReport(context: ActorContext, verifyHashes: boolean) {
    return this.jobs.start('integrity-report', context, async (job: JobRecord) => {
      const metrics = this.options.metrics;
      try {
        const report = await runIntegrityScan({
          id: job.id,
          libraryRoot: this.options.libraryRoot,
          quarantineRoot: this.quarantineRoot,
          entries: [...this.catalog.entries],
          verifyHashes,
        });
        this.latestIntegrity = report;
        metrics.integrityRuns.inc('success');
        metrics.recordIntegrity({
          finishedAtMs: Date.parse(report.finishedAt),
          durationMs: report.durationMs,
          bytes: {
            blobs: report.storage.blobs.bytes,
            derivatives: report.storage.derivatives.bytes,
            quarantine: report.storage.quarantine.bytes,
          },
          missingFiles: report.counts.missingFiles,
          orphanedFiles: report.counts.orphanedFiles,
          hashMismatches: report.counts.hashMismatches,
        });
        return report.counts;
      } catch (error) {
        metrics.integrityRuns.inc('failure');
        throw error;
      }
    });
  }

  getLatestIntegrityReport(): IntegrityReport | null {
    return this.latestIntegrity;
  }

  /** Starts the scheduled integrity job; returns a stop function. */
  scheduleIntegrity(): () => void {
    const config = this.options.getConfig();
    if (config.integrityIntervalMs <= 0 || this.integrityTimer) return () => undefined;
    const run = () =>
      this.startIntegrityReport(
        { actor: 'system:integrity-schedule', requestId: `schedule-${Date.now()}` },
        this.options.getConfig().integrityVerifyHashes,
      );
    // First run shortly after start-up (so metrics populate), then every interval.
    this.integrityTimer = setTimeout(() => {
      run();
      this.integrityTimer = setInterval(run, config.integrityIntervalMs);
      this.integrityTimer.unref();
    }, Math.min(60_000, config.integrityIntervalMs));
    this.integrityTimer.unref();
    return () => {
      if (this.integrityTimer) clearTimeout(this.integrityTimer);
      this.integrityTimer = null;
    };
  }
}

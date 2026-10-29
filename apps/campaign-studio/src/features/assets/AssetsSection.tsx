import FileText from 'lucide-react/dist/esm/icons/file-text';
import Upload from 'lucide-react/dist/esm/icons/upload';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import {
  assetImageUrl,
  deleteAsset,
  isImageAsset,
  listAssets,
  updateAsset,
  uploadAssetFile,
  type AssetReference,
  type UserAsset,
} from '@/services/assets-api';

import { computeAssetUsage, type AssetUsage } from './assetUsage';
import styles from './AssetsSection.module.css';

type View = 'campaign' | 'all';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const UPLOAD_CATEGORIES = ['maps', 'tokens', 'custom'] as const;
const MAX_NAME_LENGTH = 120;

function formatBytes(bytes: number | undefined): string {
  if (typeof bytes !== 'number') return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function AssetImage({ asset, large }: { asset: UserAsset; large?: boolean }) {
  if (!isImageAsset(asset)) {
    return (
      <span
        aria-hidden="true"
        className={large ? styles.previewPlaceholder : styles.thumbPlaceholder}
      >
        <FileText size={large ? 48 : 28} />
      </span>
    );
  }
  return (
    <img
      alt={large ? asset.name : ''}
      className={large ? styles.previewImage : undefined}
      loading="lazy"
      src={assetImageUrl(asset)}
    />
  );
}

interface AssetDetailProps {
  asset: UserAsset;
  usage: AssetUsage[];
  basePath: string;
  onUpdate: (
    id: string,
    patch: { name?: string; tags?: string[] },
  ) => Promise<void>;
  onRemoved: (id: string) => void;
}

function AssetDetail({
  asset,
  usage,
  basePath,
  onUpdate,
  onRemoved,
}: AssetDetailProps) {
  const [name, setName] = useState(asset.name);
  const [tagsText, setTagsText] = useState((asset.tags ?? []).join(', '));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [fieldError, setFieldError] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const [references, setReferences] = useState<AssetReference[]>();

  const save = async (patch: { name?: string; tags?: string[] }) => {
    setSaveState('saving');
    setFieldError(undefined);
    try {
      await onUpdate(asset.id, patch);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setFieldError(message(error, 'Could not save changes.'));
    }
  };

  const commitName = () => {
    const next = name.trim();
    if (next === asset.name) return;
    if (!next || next.length > MAX_NAME_LENGTH) {
      setName(asset.name);
      setSaveState('error');
      setFieldError(`Name must be 1-${MAX_NAME_LENGTH} characters.`);
      return;
    }
    void save({ name: next });
  };

  const commitTags = () => {
    const next = parseTags(tagsText);
    if (next.join('\u0000') === (asset.tags ?? []).join('\u0000')) return;
    void save({ tags: next });
  };

  const closeDialog = () => {
    if (busy) return;
    setConfirmOpen(false);
    setRemoveError(undefined);
    setReferences(undefined);
  };

  const remove = async () => {
    setBusy(true);
    setRemoveError(undefined);
    try {
      const result = await deleteAsset(asset.id);
      if (result.ok) {
        setConfirmOpen(false);
        onRemoved(asset.id);
        return;
      }
      setReferences(result.references);
      setRemoveError(
        result.error ?? 'This asset is still used by campaign content.',
      );
    } catch (error) {
      setRemoveError(message(error, 'The asset could not be removed.'));
    } finally {
      setBusy(false);
    }
  };

  const inUse = usage.length > 0;
  const generated = (asset.tags ?? []).includes('generated');
  const status =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : null;

  return (
    <section aria-label={`Asset ${asset.name}`} className={styles.detail}>
      <div className={styles.preview}>
        <AssetImage asset={asset} large />
      </div>

      <div className={styles.fields}>
        <div className={styles.fieldHeader}>
          <h2>Details</h2>
          {status ? (
            <span className={styles.status} role="status">
              {status}
            </span>
          ) : null}
        </div>
        <label className={styles.field}>
          <span>Name</span>
          <input
            maxLength={MAX_NAME_LENGTH}
            onBlur={commitName}
            onChange={(event) => setName(event.target.value)}
            type="text"
            value={name}
          />
        </label>
        <label className={styles.field}>
          <span>Tags (comma separated)</span>
          <input
            onBlur={commitTags}
            onChange={(event) => setTagsText(event.target.value)}
            type="text"
            value={tagsText}
          />
        </label>
        {fieldError ? (
          <p className={styles.error} role="alert">
            {fieldError}
          </p>
        ) : null}

        <dl className={styles.facts}>
          <dt>Category</dt>
          <dd>{asset.category ?? 'Unknown'}</dd>
          <dt>Size</dt>
          <dd>{formatBytes(asset.size)}</dd>
          <dt>Source</dt>
          <dd>{generated ? 'Generated' : 'Uploaded'}</dd>
          {asset.createdAt && !Number.isNaN(Date.parse(asset.createdAt)) ? (
            <>
              <dt>Created</dt>
              <dd>{new Date(asset.createdAt).toLocaleDateString()}</dd>
            </>
          ) : null}
        </dl>

        <div>
          <h3 className={styles.subheading}>Used in this campaign</h3>
          {inUse ? (
            <ul className={styles.chips}>
              {usage.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <Link
                    className={styles.chip}
                    to={`${basePath}/${item.section}/${encodeURIComponent(item.id)}`}
                  >
                    <span className={styles.chipKind}>
                      {item.kind === 'map' ? 'Map' : 'Location'}
                    </span>
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Not used in this campaign.</p>
          )}
        </div>

        <div>
          <button
            className={styles.dangerButton}
            onClick={() => setConfirmOpen(true)}
            type="button"
          >
            Remove asset
          </button>
        </div>
      </div>

      <ConfirmDialog
        busy={busy}
        confirmLabel="Remove permanently"
        description={
          inUse
            ? 'This asset is used in this campaign. Replace or remove it from those items first.'
            : 'This permanently deletes the file from your assets. It cannot be undone.'
        }
        hideConfirm={inUse || Boolean(references)}
        onCancel={closeDialog}
        onConfirm={() => void remove()}
        open={confirmOpen}
        title={`Remove "${asset.name}"?`}
      >
        {inUse ? (
          <ul className={styles.refList}>
            {usage.map((item) => (
              <li key={`${item.kind}:${item.id}`}>{item.title}</li>
            ))}
          </ul>
        ) : null}
        {references ? (
          <div>
            <p>Still used by:</p>
            <ul className={styles.refList}>
              {references.map((ref) => (
                <li key={`${ref.campaignId}:${ref.objectId}`}>
                  {ref.campaignName}: {ref.title} ({ref.kind})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {removeError ? (
          <p className={styles.error} role="alert">
            {removeError}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

export function AssetsSection() {
  const { bundle, basePath, store } = useSectionBundle();
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<UserAsset[]>();
  const [loadError, setLoadError] = useState<string>();
  const [view, setView] = useState<View>('campaign');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [uploadCategory, setUploadCategory] =
    useState<(typeof UPLOAD_CATEGORIES)[number]>('maps');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(undefined);
    try {
      setAssets(await listAssets());
    } catch (error) {
      setLoadError(message(error, 'Could not load your assets.'));
    }
  }, []);

  useEffect(() => {
    if (store.editable) void load();
  }, [load, store.editable]);

  const usageById = useMemo(() => {
    const map = new Map<string, AssetUsage[]>();
    for (const asset of assets ?? []) {
      map.set(asset.id, computeAssetUsage(bundle, asset));
    }
    return map;
  }, [assets, bundle]);

  const categories = useMemo(
    () => [...new Set((assets ?? []).map((asset) => asset.category ?? 'other'))].sort(),
    [assets],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (assets ?? []).filter((asset) => {
      if (view === 'campaign' && !(usageById.get(asset.id)?.length ?? 0)) {
        return false;
      }
      if (category !== 'all' && (asset.category ?? 'other') !== category) {
        return false;
      }
      if (!needle) return true;
      return (
        asset.name.toLowerCase().includes(needle) ||
        (asset.tags ?? []).some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [assets, category, query, usageById, view]);

  if (!store.editable) {
    return (
      <main className={styles.container}>
        <div className={styles.header}>
          <h1>Assets</h1>
        </div>
        <EmptyState
          description="Your uploaded and generated images are available in your own campaigns. Example campaigns are read-only."
          title="Assets are available in real campaigns."
        />
      </main>
    );
  }

  const selected = assets?.find((asset) => asset.id === assetId);

  const select = (id: string) =>
    navigate(`${basePath}/assets/${encodeURIComponent(id)}`);

  const handleUpdate = async (
    id: string,
    patch: { name?: string; tags?: string[] },
  ) => {
    const updated = await updateAsset(id, patch);
    setAssets((current) =>
      current?.map((asset) => (asset.id === id ? { ...asset, ...updated } : asset)),
    );
  };

  const handleRemoved = (id: string) => {
    setAssets((current) => current?.filter((asset) => asset.id !== id));
    navigate(`${basePath}/assets`);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(undefined);
    try {
      const created = await uploadAssetFile(file, uploadCategory);
      setAssets((current) => [created, ...(current ?? [])]);
      // A fresh upload is not used anywhere yet.
      setView('all');
      setCategory('all');
      setQuery('');
      select(created.id);
    } catch (error) {
      setUploadError(message(error, 'The upload failed.'));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1>Assets</h1>
        <div className={styles.upload}>
          <label className={styles.inline}>
            <span className={styles.srOnly}>Upload category</span>
            <select
              aria-label="Upload category"
              onChange={(event) =>
                setUploadCategory(
                  event.target.value as (typeof UPLOAD_CATEGORIES)[number],
                )
              }
              value={uploadCategory}
            >
              {UPLOAD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.primaryButton}
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            type="button"
          >
            <Upload aria-hidden="true" size={16} />
            <span>{uploading ? 'Uploading…' : 'Upload image'}</span>
          </button>
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-label="Choose image to upload"
            className={styles.srOnly}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            ref={fileInput}
            tabIndex={-1}
            type="file"
          />
        </div>
      </div>
      {uploadError ? (
        <p className={styles.error} role="alert">
          {uploadError}
        </p>
      ) : null}

      <div className={styles.toolbar}>
        <div aria-label="Asset scope" className={styles.tabs} role="group">
          {(
            [
              ['campaign', 'Used in this campaign'],
              ['all', 'All my assets'],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={view === value}
              className={view === value ? styles.tabActive : styles.tab}
              key={value}
              onClick={() => setView(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="Category"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          aria-label="Search assets"
          className={styles.search}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or tag"
          type="search"
          value={query}
        />
      </div>

      {loadError ? (
        <div role="alert">
          <p className={styles.error}>{loadError}</p>
          <button onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      ) : assets === undefined ? (
        <p aria-busy="true">Loading assets…</p>
      ) : (
        <div className={styles.body}>
          {visible.length === 0 ? (
            <EmptyState
              description={
                view === 'campaign' && assets.length > 0
                  ? 'Nothing in this campaign uses an asset yet. Switch to All my assets to see everything you have uploaded.'
                  : undefined
              }
              title={
                assets.length === 0
                  ? 'No assets yet.'
                  : 'No assets match these filters.'
              }
            />
          ) : (
            <ul aria-label="Assets" className={styles.grid}>
              {visible.map((asset) => (
                <li key={asset.id}>
                  <button
                    aria-current={asset.id === assetId ? 'true' : undefined}
                    aria-label={asset.name}
                    className={
                      asset.id === assetId ? styles.cardActive : styles.card
                    }
                    onClick={() => select(asset.id)}
                    type="button"
                  >
                    <span className={styles.thumb}>
                      <AssetImage asset={asset} />
                    </span>
                    <span className={styles.cardName}>{asset.name}</span>
                    <span className={styles.cardMeta}>
                      {asset.category ?? 'other'}
                      {(usageById.get(asset.id)?.length ?? 0) > 0
                        ? ' · in use'
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected ? (
            <AssetDetail
              asset={selected}
              basePath={basePath}
              key={selected.id}
              onRemoved={handleRemoved}
              onUpdate={handleUpdate}
              usage={usageById.get(selected.id) ?? []}
            />
          ) : assetId ? (
            <p className={styles.muted}>That asset no longer exists.</p>
          ) : null}
        </div>
      )}
    </main>
  );
}

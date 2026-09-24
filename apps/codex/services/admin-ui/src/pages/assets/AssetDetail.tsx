import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assetPreviewUrl,
  conflictAsset,
  deletePreview,
  formatBytes,
  getAsset,
  permanentlyDeleteAsset,
  quarantineAsset,
  regenerateDerivatives,
  restoreAsset,
  updateAssetMetadata,
  type AdminAsset,
  type DeletePreview,
} from '@/lib/assetsApi'
import { ApiError } from '@/lib/api'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { ErrorNotice, PageHeader, Pill, Section } from '@/components/common'
import { buttonClass, formatDate, inputClass } from '@/lib/ui'
import { assetStatusTone, parseTagInput } from './assetUi'

export default function AssetDetail() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const canEdit = useCan('editAssets')
  const query = useQuery({ queryKey: ['asset', id], queryFn: () => getAsset(id), enabled: Boolean(id) })

  const setAsset = (asset: AdminAsset) => {
    queryClient.setQueryData(['asset', id], asset)
    void queryClient.invalidateQueries({ queryKey: ['assets'] })
  }

  const regenerate = useMutation({
    mutationFn: () => regenerateDerivatives(id),
    onSuccess: setAsset,
  })

  if (query.isLoading) return <p className="p-6 text-sm text-gray-500">Loading asset...</p>
  if (query.error || !query.data) {
    return (
      <div className="space-y-3 p-6">
        <Link to="/assets" className="text-sm text-indigo-600">
          Back to library
        </Link>
        <ErrorNotice error={query.error ?? new Error('Asset not found')} />
      </div>
    )
  }

  const asset = query.data
  const previewable = asset.status !== 'deleted' && Boolean(asset.files?.original || asset.files?.thumbnail)

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <Link to="/assets" className="text-sm text-indigo-600">
        Back to library
      </Link>
      <PageHeader
        title={asset.name}
        description={`${asset.id} · version ${asset.version}`}
        actions={<Pill tone={assetStatusTone(asset.status)}>{asset.status}</Pill>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Preview">
          {previewable ? (
            <div className="space-y-2">
              <img
                src={assetPreviewUrl(asset.id, asset.files?.original ? 'original' : 'thumbnail')}
                alt={asset.name}
                className="max-h-96 w-full rounded border border-gray-200 bg-gray-50 object-contain"
              />
              {asset.files?.original && (
                <a
                  className="text-sm text-indigo-600"
                  href={assetPreviewUrl(asset.id, 'original')}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open original
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No preview is available for this asset.</p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Type</dt>
            <dd>{asset.mimeType ?? '—'}</dd>
            <dt className="text-gray-500">Size</dt>
            <dd>{formatBytes(asset.size)}</dd>
            <dt className="text-gray-500">Dimensions</dt>
            <dd>{asset.dimensions ? `${asset.dimensions.width} × ${asset.dimensions.height}` : '—'}</dd>
            <dt className="text-gray-500">SHA-256</dt>
            <dd className="break-all font-mono text-xs">{asset.sha256 ?? '—'}</dd>
          </dl>
        </Section>

        <MetadataEditor key={asset.id} asset={asset} onSaved={setAsset} canEdit={canEdit} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Provenance">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Origin</dt>
            <dd>{asset.origin === 'admin' ? 'Admin upload' : 'Ingested library'}</dd>
            <dt className="text-gray-500">Source</dt>
            <dd>{asset.source || '—'}</dd>
            <dt className="text-gray-500">Created by</dt>
            <dd>{asset.provenance?.createdBy ?? '—'}</dd>
            <dt className="text-gray-500">Created</dt>
            <dd>{formatDate(asset.provenance?.createdAt)}</dd>
            <dt className="text-gray-500">Original filename</dt>
            <dd className="break-all">{asset.provenance?.originalFilename ?? '—'}</dd>
            <dt className="text-gray-500">Source URL</dt>
            <dd className="break-all">{asset.provenance?.sourceUrl ?? '—'}</dd>
            <dt className="text-gray-500">Source path</dt>
            <dd className="break-all">{asset.provenance?.sourcePath ?? '—'}</dd>
            <dt className="text-gray-500">Last updated</dt>
            <dd>
              {formatDate(asset.provenance?.updatedAt)}
              {asset.provenance?.updatedBy ? ` by ${asset.provenance.updatedBy}` : ''}
            </dd>
          </dl>
        </Section>

        <Section
          title="Derivatives"
          actions={
            <button
              className={buttonClass.secondary}
              disabled={!canEdit || regenerate.isPending || asset.status === 'deleted'}
              title={canEdit ? undefined : permissionHint('editAssets')}
              onClick={() => regenerate.mutate()}
            >
              {regenerate.isPending ? 'Regenerating...' : 'Regenerate'}
            </button>
          }
        >
          <ErrorNotice error={regenerate.error} />
          {regenerate.isSuccess && <p className="text-sm text-green-700">Derivatives regenerated.</p>}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Original key</dt>
            <dd className="break-all font-mono text-xs">{asset.files?.original ?? '—'}</dd>
            <dt className="text-gray-500">Thumbnail key</dt>
            <dd className="break-all font-mono text-xs">{asset.files?.thumbnail ?? '—'}</dd>
            {asset.derivative ? (
              <>
                <dt className="text-gray-500">Spec</dt>
                <dd>{asset.derivative.specVersion}</dd>
                <dt className="text-gray-500">Thumbnail</dt>
                <dd>
                  {asset.derivative.width} × {asset.derivative.height}, {formatBytes(asset.derivative.bytes)}
                </dd>
                <dt className="text-gray-500">Generated</dt>
                <dd>
                  {formatDate(asset.derivative.generatedAt)} by {asset.derivative.generatedBy}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-gray-500">Derivative</dt>
                <dd>Ingest-provided</dd>
              </>
            )}
          </dl>
        </Section>
      </div>

      <DeleteFlow asset={asset} onChanged={setAsset} />

      <Section title="History">
        {asset.history?.length ? (
          <ol className="space-y-1 text-sm">
            {[...asset.history].reverse().map((entry) => (
              <li key={`${entry.version}-${entry.at}-${entry.action}`} className="flex flex-wrap gap-2">
                <span className="text-gray-500">{formatDate(entry.at)}</span>
                <span className="font-medium">{entry.action}</span>
                <span>by {entry.actor}</span>
                <span className="text-gray-500">→ v{entry.version}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-gray-500">No admin changes recorded.</p>
        )}
      </Section>
    </div>
  )
}

interface MetadataForm {
  name: string
  category: string
  tags: string
  attribution: string
  license: string
}

const FIELD_LABELS: Record<keyof MetadataForm, string> = {
  name: 'Name',
  category: 'Category',
  tags: 'Tags',
  attribution: 'Attribution',
  license: 'License',
}

function formFrom(asset: AdminAsset): MetadataForm {
  return {
    name: asset.name ?? '',
    category: asset.category ?? '',
    tags: (asset.tags ?? []).join(', '),
    attribution: asset.attribution ?? '',
    license: asset.license ?? '',
  }
}

function sameForm(a: MetadataForm, b: MetadataForm): boolean {
  return (Object.keys(FIELD_LABELS) as Array<keyof MetadataForm>).every((key) => a[key] === b[key])
}

/**
 * Metadata edit with optimistic concurrency. The save carries the version the
 * form was loaded from; a `409 version-conflict` stops and asks the user to
 * reload or reapply. Nothing is ever retried or overwritten automatically.
 */
export function MetadataEditor({
  asset,
  onSaved,
  canEdit,
}: {
  asset: AdminAsset
  onSaved: (asset: AdminAsset) => void
  canEdit: boolean
}) {
  const [base, setBase] = useState(asset)
  const [form, setForm] = useState(() => formFrom(asset))
  const [conflict, setConflict] = useState<AdminAsset | null>(null)
  const [saved, setSaved] = useState(false)
  const dirty = !sameForm(form, formFrom(base))

  // Pick up newer server versions (e.g. after a regenerate) while there are no local edits.
  useEffect(() => {
    if (asset.version > base.version && !dirty && !conflict) {
      setBase(asset)
      setForm(formFrom(asset))
    }
  }, [asset, base.version, dirty, conflict])

  const save = useMutation({
    mutationFn: () => {
      const baseForm = formFrom(base)
      const patch: Record<string, unknown> = {}
      if (form.name !== baseForm.name) patch.name = form.name.trim()
      if (form.category !== baseForm.category) patch.category = form.category.trim()
      if (form.tags !== baseForm.tags) patch.tags = parseTagInput(form.tags)
      if (form.attribution !== baseForm.attribution) patch.attribution = form.attribution.trim() || null
      if (form.license !== baseForm.license) patch.license = form.license.trim() || null
      return updateAssetMetadata(asset.id, base.version, patch)
    },
    onSuccess: (updated) => {
      setBase(updated)
      setForm(formFrom(updated))
      setSaved(true)
      onSaved(updated)
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(conflictAsset(error) ?? (await getAsset(asset.id)))
      }
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSaved(false)
    save.mutate()
  }

  const reloadServer = () => {
    if (!conflict) return
    setBase(conflict)
    setForm(formFrom(conflict))
    onSaved(conflict)
    setConflict(null)
    save.reset()
  }

  const keepMine = () => {
    if (!conflict) return
    // Rebase onto the server version: keep only the fields this user changed,
    // take everything else from the server, and let them save again deliberately.
    const original = formFrom(base)
    const merged = formFrom(conflict)
    for (const key of Object.keys(FIELD_LABELS) as Array<keyof MetadataForm>) {
      if (form[key] !== original[key]) merged[key] = form[key]
    }
    setBase(conflict)
    setForm(merged)
    onSaved(conflict)
    setConflict(null)
    save.reset()
  }

  const editable = canEdit && asset.status !== 'deleted'
  const serverForm = conflict ? formFrom(conflict) : null

  return (
    <Section title="Metadata">
      <form onSubmit={submit} className="space-y-3" aria-label="Asset metadata">
        {(Object.keys(FIELD_LABELS) as Array<keyof MetadataForm>).map((key) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700" htmlFor={`asset-${key}`}>
              {FIELD_LABELS[key]}
              {key === 'tags' && <span className="font-normal text-gray-500"> (comma separated)</span>}
            </label>
            <input
              id={`asset-${key}`}
              className={inputClass}
              value={form[key]}
              disabled={!editable || Boolean(conflict)}
              onChange={(event) => {
                setSaved(false)
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }}
            />
          </div>
        ))}

        {conflict && serverForm && (
          <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              Someone else changed this asset (now version {conflict.version}; you started from version {base.version}).
              Your changes were not saved.
            </p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="py-1">Field</th>
                  <th className="py-1">Your value</th>
                  <th className="py-1">Current value</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(FIELD_LABELS) as Array<keyof MetadataForm>)
                  .filter((key) => form[key] !== serverForm[key])
                  .map((key) => (
                    <tr key={key}>
                      <td className="py-1 pr-2 font-medium">{FIELD_LABELS[key]}</td>
                      <td className="py-1 pr-2">{form[key] || '—'}</td>
                      <td className="py-1">{serverForm[key] || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass.secondary} onClick={reloadServer}>
                Discard mine and reload
              </button>
              <button type="button" className={buttonClass.secondary} onClick={keepMine}>
                Keep my changes on the current version
              </button>
            </div>
          </div>
        )}

        {save.error && !conflict && <ErrorNotice error={save.error} />}
        {saved && !dirty && <p className="text-sm text-green-700">Saved as version {base.version}.</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className={buttonClass.primary}
            disabled={!editable || !dirty || save.isPending || Boolean(conflict)}
            title={canEdit ? undefined : permissionHint('editAssets')}
          >
            {save.isPending ? 'Saving...' : 'Save metadata'}
          </button>
          {dirty && !conflict && (
            <button
              type="button"
              className={buttonClass.secondary}
              onClick={() => setForm(formFrom(base))}
            >
              Reset
            </button>
          )}
        </div>
      </form>
    </Section>
  )
}

/**
 * Delete flow: preview (references and shared files) → quarantine → restore
 * or permanent delete with a typed confirmation. Every step carries the
 * version the administrator reviewed.
 */
function DeleteFlow({ asset, onChanged }: { asset: AdminAsset; onChanged: (asset: AdminAsset) => void }) {
  const canDelete = useCan('deleteAssets')
  const [preview, setPreview] = useState<DeletePreview | null>(null)
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const loadPreview = useMutation({
    mutationFn: () => deletePreview(asset.id),
    onSuccess: (result) => {
      setPreview(result)
      setAcknowledged(false)
      setConfirmText('')
    },
  })

  const afterChange = (updated: AdminAsset, message: string) => {
    onChanged(updated)
    setNotice(message)
    setPreview(null)
    setConfirmText('')
  }

  const onConflict = async (error: unknown) => {
    if (error instanceof ApiError && error.status === 409 && error.code === 'version-conflict') {
      const latest = conflictAsset(error) ?? (await getAsset(asset.id))
      onChanged(latest)
      setPreview(null)
      setNotice('The asset changed since you reviewed it. Review the deletion again.')
    }
  }

  const quarantine = useMutation({
    mutationFn: () =>
      quarantineAsset(asset.id, {
        expectedVersion: asset.version,
        reason: reason.trim() || undefined,
        acknowledgeReferences: acknowledged || undefined,
      }),
    onSuccess: (result) => afterChange(result.asset, 'Asset quarantined. It is no longer served to the VTT.'),
    onError: onConflict,
  })
  const restore = useMutation({
    mutationFn: () => restoreAsset(asset.id, asset.version),
    onSuccess: (result) =>
      afterChange(
        result.asset,
        result.missingFiles?.length
          ? `Asset restored, but ${result.missingFiles.length} file(s) were missing.`
          : 'Asset restored and served again.',
      ),
    onError: onConflict,
  })
  const permanentDelete = useMutation({
    mutationFn: () => permanentlyDeleteAsset(asset.id, asset.version),
    onSuccess: (result) => afterChange(result.asset, 'Asset permanently deleted.'),
    onError: onConflict,
  })

  if (!canDelete) {
    return (
      <Section title="Delete">
        <p className="text-sm text-gray-500">{permissionHint('deleteAssets')} to quarantine or delete assets.</p>
      </Section>
    )
  }

  const pending = quarantine.isPending || restore.isPending || permanentDelete.isPending
  const lastError = [quarantine.error, restore.error, permanentDelete.error, loadPreview.error].find(
    (error) => error && !(error instanceof ApiError && error.code === 'version-conflict'),
  )
  const needsAck = (preview?.references.count ?? 0) > 0

  return (
    <Section title="Quarantine and delete">
      {notice && <p className="mb-2 text-sm text-blue-800">{notice}</p>}
      <ErrorNotice error={lastError} />

      {!preview ? (
        <button
          className={buttonClass.secondary}
          disabled={loadPreview.isPending || asset.status === 'deleted'}
          onClick={() => {
            setNotice(null)
            loadPreview.mutate()
          }}
        >
          {loadPreview.isPending
            ? 'Checking references...'
            : asset.status === 'quarantined'
              ? 'Review restore or permanent deletion'
              : 'Review deletion'}
        </button>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            Referenced by <strong>{preview.references.count}</strong> campaign(s)
            {preview.references.count > 0 && `: ${preview.references.campaignIds.join(', ')}`}.
          </p>
          {preview.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-amber-800" aria-label="Deletion warnings">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {preview.allowedActions.quarantine && (
            <div className="space-y-2 rounded-md border border-gray-200 p-3">
              <label className="block font-medium" htmlFor="quarantine-reason">
                Reason (optional)
              </label>
              <input id="quarantine-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              {needsAck && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                  I understand scenes in these campaigns will show a missing image.
                </label>
              )}
              <button
                className={buttonClass.danger}
                disabled={pending || (needsAck && !acknowledged)}
                onClick={() => quarantine.mutate()}
              >
                Quarantine
              </button>
            </div>
          )}

          {preview.allowedActions.restore && (
            <button className={buttonClass.secondary} disabled={pending} onClick={() => restore.mutate()}>
              Restore
            </button>
          )}

          {preview.allowedActions.permanentDelete && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
              <label className="block font-medium text-red-900" htmlFor="confirm-delete">
                Type <code className="font-mono">{asset.id}</code> to permanently delete this asset
              </label>
              <input
                id="confirm-delete"
                className={inputClass}
                value={confirmText}
                autoComplete="off"
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <button
                className={buttonClass.danger}
                disabled={pending || confirmText.trim() !== asset.id}
                onClick={() => permanentDelete.mutate()}
              >
                Permanently delete
              </button>
            </div>
          )}

          <button className={buttonClass.secondary} onClick={() => setPreview(null)} disabled={pending}>
            Cancel
          </button>
        </div>
      )}
    </Section>
  )
}

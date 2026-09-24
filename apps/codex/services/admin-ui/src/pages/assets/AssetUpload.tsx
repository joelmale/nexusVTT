import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ASSET_UPLOAD_ACCEPT,
  ASSET_UPLOAD_MAX_BYTES,
  assetUploadProblem,
  formatBytes,
  getAssetFacets,
  uploadAsset,
  type AssetUploadResult,
} from '@/lib/assetsApi'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { ErrorNotice, PageHeader, Section } from '@/components/common'
import { buttonClass, inputClass } from '@/lib/ui'
import { parseTagInput } from './assetUi'

const EMPTY = { category: '', name: '', tags: '', attribution: '', license: '', source: '', sourceUrl: '' }

export default function AssetUpload() {
  const canUpload = useCan('editAssets')
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [fields, setFields] = useState(EMPTY)
  const [force, setForce] = useState(false)
  const [result, setResult] = useState<AssetUploadResult | null>(null)
  const facets = useQuery({ queryKey: ['asset-facets'], queryFn: getAssetFacets, staleTime: 60_000 })

  const problem = file ? assetUploadProblem(file) : null

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file')
      return uploadAsset(file, {
        category: fields.category.trim(),
        name: fields.name.trim() || undefined,
        tags: parseTagInput(fields.tags),
        attribution: fields.attribution.trim() || undefined,
        license: fields.license.trim() || undefined,
        source: fields.source.trim() || undefined,
        sourceUrl: fields.sourceUrl.trim() || undefined,
        force,
      })
    },
    onSuccess: (uploaded) => {
      setResult(uploaded)
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: ['asset-facets'] })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setResult(null)
    upload.mutate()
  }

  const set = (key: keyof typeof EMPTY) => (value: string) => setFields((current) => ({ ...current, [key]: value }))

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to="/assets" className="text-sm text-indigo-600">
        Back to library
      </Link>
      <PageHeader title="Upload asset" description="Adds an image to the library through the asset service." />

      <Section title="File">
        <form onSubmit={submit} className="space-y-3" aria-label="Upload asset">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="asset-file">
              Image
            </label>
            <input
              id="asset-file"
              type="file"
              accept={ASSET_UPLOAD_ACCEPT}
              className="block text-sm"
              onChange={(event) => {
                setResult(null)
                upload.reset()
                setFile(event.target.files?.[0] ?? null)
              }}
            />
            <p className="mt-1 text-xs text-gray-500">
              PNG, JPEG or WebP, up to {formatBytes(ASSET_UPLOAD_MAX_BYTES)}. The service checks the real type from the
              file contents, strips metadata from the thumbnail and rejects very large images.
            </p>
            {file && !problem && (
              <p className="mt-1 text-xs text-gray-600">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
            {problem && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {problem}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="upload-category">
              Category (required)
            </label>
            <input
              id="upload-category"
              className={inputClass}
              list="upload-category-options"
              required
              value={fields.category}
              onChange={(event) => set('category')(event.target.value)}
            />
            <datalist id="upload-category-options">
              {(facets.data?.categories ?? []).map((facet) => (
                <option key={facet.name} value={facet.name} />
              ))}
            </datalist>
          </div>

          {(
            [
              ['name', 'Name (defaults to the file name)'],
              ['tags', 'Tags (comma separated)'],
              ['attribution', 'Attribution'],
              ['license', 'License'],
              ['source', 'Source'],
              ['sourceUrl', 'Source URL'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700" htmlFor={`upload-${key}`}>
                {label}
              </label>
              <input
                id={`upload-${key}`}
                className={inputClass}
                type={key === 'sourceUrl' ? 'url' : 'text'}
                value={fields[key]}
                onChange={(event) => set(key)(event.target.value)}
              />
            </div>
          ))}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
            Keep a separate copy even if the same image already exists
          </label>

          <ErrorNotice error={upload.error} />

          <button
            type="submit"
            className={buttonClass.primary}
            disabled={!canUpload || !file || Boolean(problem) || !fields.category.trim() || upload.isPending}
            title={canUpload ? undefined : permissionHint('editAssets')}
          >
            {upload.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </Section>

      {result && (
        <Section title={result.duplicate ? 'Already in the library' : 'Uploaded'}>
          {result.duplicate ? (
            <div role="status" className="space-y-2 text-sm">
              <p>
                An identical image (same SHA-256) is already stored as{' '}
                <Link className="text-indigo-600" to={`/assets/${encodeURIComponent(result.duplicateOf ?? result.asset.id)}`}>
                  {result.asset.name} ({result.duplicateOf ?? result.asset.id})
                </Link>
                . Nothing new was stored.
              </p>
              <p className="text-gray-600">To store a separate copy anyway, tick “Keep a separate copy” and upload again.</p>
            </div>
          ) : (
            <p role="status" className="text-sm">
              Stored as{' '}
              <Link className="text-indigo-600" to={`/assets/${encodeURIComponent(result.asset.id)}`}>
                {result.asset.name}
              </Link>
              {result.duplicateOf ? ` (a forced copy of ${result.duplicateOf})` : ''}.
            </p>
          )}
        </Section>
      )}
    </div>
  )
}

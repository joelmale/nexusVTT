import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  assetPreviewUrl,
  formatBytes,
  getAssetFacets,
  listAssets,
  type AdminAsset,
  type AssetStatusFilter,
} from '@/lib/assetsApi'
import { useCan } from '@/auth/AuthContext'
import { ErrorNotice, PageHeader, Pill } from '@/components/common'
import { buttonClass, inputClass } from '@/lib/ui'
import { assetStatusTone } from './assetUi'

const PAGE_SIZE = 24

export default function AssetsList() {
  const canUpload = useCan('editAssets')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<AssetStatusFilter | ''>('')
  const [origin, setOrigin] = useState<'' | 'admin' | 'library'>('')
  // Cursor of each page visited so far; the last one is the current page.
  const [cursors, setCursors] = useState<Array<string | null>>([null])
  const cursor = cursors[cursors.length - 1]

  const resetPaging = () => setCursors([null])

  const facets = useQuery({ queryKey: ['asset-facets'], queryFn: getAssetFacets, staleTime: 60_000 })
  const list = useQuery({
    queryKey: ['assets', { q, category, tags, status, origin, cursor }],
    queryFn: () =>
      listAssets({
        q,
        category: category || undefined,
        tags,
        status: status || undefined,
        origin: origin || undefined,
        cursor,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setQ(searchInput)
    resetPaging()
  }

  const toggleTag = (tag: string) => {
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]))
    resetPaging()
  }

  const statuses = facets.data?.statuses ?? {}

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <PageHeader
        title="Asset library"
        description="Library images served to the VTT. Changes go through the asset service; nothing touches the NAS directly."
        actions={
          <>
            {canUpload && (
              <Link to="/assets/upload" className={buttonClass.primary}>
                Upload asset
              </Link>
            )}
            <Link to="/assets/jobs" className={buttonClass.secondary}>
              Jobs and integrity
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 text-sm" aria-label="Asset filters">
          <form onSubmit={submitSearch} className="space-y-2">
            <label className="block font-medium text-gray-700" htmlFor="asset-search">
              Search
            </label>
            <input
              id="asset-search"
              className={inputClass}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, tag or id"
            />
            <button type="submit" className={buttonClass.secondary}>
              Search
            </button>
          </form>

          <div className="space-y-1">
            <label className="block font-medium text-gray-700" htmlFor="asset-status">
              Status
            </label>
            <select
              id="asset-status"
              className={inputClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as AssetStatusFilter | '')
                resetPaging()
              }}
            >
              <option value="">Not deleted</option>
              {(['active', 'quarantined', 'removed', 'deleted', 'all'] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                  {value !== 'all' && statuses[value] !== undefined ? ` (${statuses[value]})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-gray-700" htmlFor="asset-origin">
              Origin
            </label>
            <select
              id="asset-origin"
              className={inputClass}
              value={origin}
              onChange={(event) => {
                setOrigin(event.target.value as '' | 'admin' | 'library')
                resetPaging()
              }}
            >
              <option value="">Any</option>
              <option value="library">Ingested library</option>
              <option value="admin">Admin upload</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-gray-700" htmlFor="asset-category">
              Category
            </label>
            <select
              id="asset-category"
              className={inputClass}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                resetPaging()
              }}
            >
              <option value="">All categories</option>
              {(facets.data?.categories ?? []).map((facet) => (
                <option key={facet.name} value={facet.name}>
                  {facet.name} ({facet.count})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="block font-medium text-gray-700">Tags</span>
            <div className="flex max-h-64 flex-wrap gap-1 overflow-y-auto">
              {(facets.data?.tags ?? []).slice(0, 60).map((facet) => {
                const active = tags.includes(facet.name)
                return (
                  <button
                    key={facet.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(facet.name)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      active ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {facet.name} <span className="text-gray-400">{facet.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <ErrorNotice error={facets.error} />
        </aside>

        <div className="space-y-3">
          <ErrorNotice error={list.error} />
          {list.isLoading && <p className="text-sm text-gray-500">Loading assets...</p>}
          {list.data && (
            <>
              <p className="text-sm text-gray-600">
                {list.data.total.toLocaleString()} asset{list.data.total === 1 ? '' : 's'}
                {tags.length > 0 && ` tagged ${tags.join(', ')}`}
              </p>
              {list.data.assets.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  No assets match these filters.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {list.data.assets.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between">
                <button
                  className={buttonClass.secondary}
                  disabled={cursors.length <= 1}
                  onClick={() => setCursors((current) => current.slice(0, -1))}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {cursors.length}</span>
                <button
                  className={buttonClass.secondary}
                  disabled={!list.data.hasMore || !list.data.cursor}
                  onClick={() => setCursors((current) => [...current, list.data.cursor])}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AssetCard({ asset }: { asset: AdminAsset }) {
  const hasPreview = asset.status !== 'deleted' && Boolean(asset.files?.thumbnail)
  return (
    <li className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <Link to={`/assets/${encodeURIComponent(asset.id)}`} className="block hover:bg-gray-50">
        <div className="flex h-36 items-center justify-center bg-gray-100">
          {hasPreview ? (
            <img
              src={assetPreviewUrl(asset.id, 'thumbnail')}
              alt={asset.name}
              loading="lazy"
              className="max-h-36 max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-gray-400">No preview</span>
          )}
        </div>
        <div className="space-y-1 p-2">
          <div className="truncate text-sm font-medium text-gray-900" title={asset.name}>
            {asset.name}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
            <Pill tone={assetStatusTone(asset.status)}>{asset.status}</Pill>
            <span>{asset.category}</span>
            <span>· {formatBytes(asset.size)}</span>
          </div>
        </div>
      </Link>
    </li>
  )
}

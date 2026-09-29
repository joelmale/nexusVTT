import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileUp, Plus, Trash2, Wand2 } from 'lucide-react'
import { codexFetch } from '@/lib/api'
import {
  buildDraftLabel,
  clampBBox,
  GOLD_CATEGORIES,
  GOLD_REGION_CLASSES,
  parseLabel,
  serializeLabel,
  validateLabel,
  type GoldEntity,
  type GoldLabel,
  type GoldRegionClass,
  type StructuredDataRow,
} from './goldset'
import type { EntityType, PageDetail } from './types'

const readFileText = (file: File): Promise<string> =>
  typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsText(file)
      })

const draftKey = (documentId: string, pageNumber: number) => `codex-goldset-draft:${documentId}:${pageNumber}`

const loadDraft = (documentId: string, pageNumber: number): GoldLabel | null => {
  try {
    const raw = window.localStorage.getItem(draftKey(documentId, pageNumber))
    return raw ? parseLabel(raw) : null
  } catch {
    return null
  }
}

const saveDraft = (documentId: string, pageNumber: number, label: GoldLabel | null) => {
  try {
    if (label) window.localStorage.setItem(draftKey(documentId, pageNumber), serializeLabel(label))
    else window.localStorage.removeItem(draftKey(documentId, pageNumber))
  } catch {
    // Browser storage is a convenience only; the downloaded JSON is the record.
  }
}

function EntityEditor({
  entity,
  index,
  onChange,
  onRemove,
}: {
  entity: GoldEntity
  index: number
  onChange: (entity: GoldEntity) => void
  onRemove: () => void
}) {
  const [text, setText] = useState(() => JSON.stringify(entity.data, null, 2))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setText(JSON.stringify(entity.data, null, 2)), [entity.data])

  return (
    <li className="space-y-1 rounded border border-gray-200 p-2" data-testid={`gold-entity-${index}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          aria-label={`Entity ${index + 1} type`}
          value={entity.type}
          onChange={(e) => onChange({ ...entity, type: e.target.value as EntityType })}
          className="rounded border border-gray-300 px-1 py-0.5"
        >
          <option value="monster">monster</option>
          <option value="spell">spell</option>
          <option value="item">item</option>
        </select>
        <span className="font-semibold">{entity.data.name || '(unnamed)'}</span>
        <label className="ml-auto flex items-center gap-1">
          <input
            type="checkbox"
            checked={Boolean(entity.numbersChecked)}
            onChange={(e) => onChange({ ...entity, numbersChecked: e.target.checked })}
          />
          Numbers checked
        </label>
        <button type="button" onClick={onRemove} aria-label={`Remove entity ${index + 1}`} className="text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        aria-label={`Entity ${index + 1} data (JSON)`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            const data = JSON.parse(text)
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Entity data must be a JSON object')
            setError(null)
            onChange({ ...entity, data })
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        }}
        rows={8}
        spellCheck={false}
        className="w-full rounded border border-gray-300 p-1 font-mono text-[11px]"
      />
      {error && <p className="text-[11px] text-red-600" role="alert">{error}</p>}
    </li>
  )
}

export interface GoldsetEditorProps {
  documentId: string
  documentTitle?: string
  contentHash?: string | null
  page: PageDetail
  label: GoldLabel | null
  onChange: (label: GoldLabel | null) => void
  selectedRegion: number | null
  onSelectRegion: (index: number | null) => void
}

/**
 * Gold-set edit mode of the Live Proof canvas. Draft by machine (the
 * pipeline's text, boxes and entities for this page), verify by a person:
 * fix the text, adjust or draw boxes on the page, correct every entity field,
 * do the second pass on numbers, then download the label JSON into
 * apps/codex/eval/goldset/pages/. Guide: apps/docs/codex/goldset-review.md.
 */
export function GoldsetEditor({
  documentId,
  documentTitle,
  contentHash,
  page,
  label,
  onChange,
  selectedRegion,
  onSelectRegion,
}: GoldsetEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { data: rows, isFetching } = useQuery<StructuredDataRow[]>({
    queryKey: ['structured-data', documentId],
    queryFn: async () => {
      const response = await codexFetch(`/api/documents/${documentId}/structured-data`)
      if (!response.ok) throw new Error('Failed to load extracted entities')
      return response.json()
    },
  })

  // Restore a browser-local draft for this page, if one exists.
  useEffect(() => {
    if (!label) {
      const draft = loadDraft(documentId, page.pageNumber)
      if (draft) onChange(draft)
    }
    // Only when the page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, page.pageNumber])

  useEffect(() => {
    if (label) saveDraft(documentId, page.pageNumber, label)
  }, [documentId, page.pageNumber, label])

  const draftFromPipeline = () =>
    onChange(buildDraftLabel({ page, contentHash: contentHash || 'unknown-source', rows: rows ?? [], documentTitle }))

  const openFile = async (file: File) => {
    try {
      onChange(parseLabel(await readFileText(file)))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!label) {
    return (
      <div className="space-y-2 text-xs" data-testid="goldset-editor">
        <p className="text-gray-600">
          No label for page {page.pageNumber} yet. Draft one from the pipeline's output, then verify every field against the printed page.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={draftFromPipeline} disabled={isFetching} className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-white disabled:opacity-50">
            <Wand2 className="h-3.5 w-3.5" /> Draft from pipeline
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1">
            <FileUp className="h-3.5 w-3.5" /> Open label JSON
          </button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="Label file" onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} />
        {loadError && <p className="text-red-600" role="alert">{loadError}</p>}
      </div>
    )
  }

  const problems = validateLabel(label)
  const set = (patch: Partial<GoldLabel>) => onChange({ ...label, ...patch })
  const setRegion = (index: number, patch: Partial<GoldLabel['regions'][number]>) =>
    set({ regions: label.regions.map((region, i) => (i === index ? { ...region, ...patch } : region)) })
  const setEntity = (index: number, entity: GoldEntity) => set({ entities: label.entities.map((e, i) => (i === index ? entity : e)) })

  const download = () => {
    const blob = new Blob([serializeLabel(label)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${label.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3 text-xs" data-testid="goldset-editor">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={download} disabled={problems.length > 0 && label.status === 'verified'} className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-white disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Download label JSON
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1">
          <FileUp className="h-3.5 w-3.5" /> Open label JSON
        </button>
        <button type="button" onClick={draftFromPipeline} className="rounded border border-gray-300 px-2 py-1">
          Re-draft from pipeline
        </button>
        <button
          type="button"
          onClick={() => {
            saveDraft(documentId, page.pageNumber, null)
            onChange(null)
          }}
          className="rounded border border-gray-300 px-2 py-1 text-red-600"
        >
          Discard draft
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="Label file" onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} />
      </div>
      {loadError && <p className="text-red-600" role="alert">{loadError}</p>}

      <fieldset className="grid grid-cols-2 gap-2 rounded border border-gray-200 p-2">
        <legend className="px-1 font-semibold">Page</legend>
        <label className="flex flex-col gap-0.5">
          Label id
          <input value={label.id} onChange={(e) => set({ id: e.target.value })} className="rounded border border-gray-300 px-1 py-0.5 font-mono" />
        </label>
        <label className="flex flex-col gap-0.5">
          Category
          <select value={label.category} onChange={(e) => set({ category: e.target.value as GoldLabel['category'] })} className="rounded border border-gray-300 px-1 py-0.5">
            {GOLD_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={label.heldOut} onChange={(e) => set({ heldOut: e.target.checked })} />
          Held out (not for tuning)
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={label.review.numbersChecked}
            onChange={(e) => set({ review: { ...label.review, numbersChecked: e.target.checked } })}
          />
          Second pass on numbers done
        </label>
        <label className="flex flex-col gap-0.5">
          Verified by
          <input
            value={label.review.verifiedBy ?? ''}
            onChange={(e) => set({ review: { ...label.review, verifiedBy: e.target.value || null } })}
            className="rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Status
          <select
            aria-label="Label status"
            value={label.status}
            onChange={(e) => {
              const status = e.target.value as GoldLabel['status']
              set({ status, review: { ...label.review, verifiedAt: status === 'verified' ? new Date().toISOString() : null } })
            }}
            className="rounded border border-gray-300 px-1 py-0.5"
          >
            <option value="draft">draft</option>
            <option value="verified">verified</option>
          </select>
        </label>
        <p className="col-span-2 font-mono text-[10px] text-gray-500">
          source {label.source.sha256.slice(0, 12)}… page {label.source.pageNumber}
        </p>
      </fieldset>

      {problems.length > 0 && (
        <ul className="list-disc rounded border border-amber-300 bg-amber-50 py-1 pl-5 text-amber-900" aria-label="Label problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <label className="flex flex-col gap-0.5">
        <span className="font-semibold">Reading-order text</span>
        <span className="text-gray-500">Correct text in reading order, excluding art, headers and footers. Blank line between paragraphs.</span>
        <textarea value={label.text} onChange={(e) => set({ text: e.target.value })} rows={10} className="rounded border border-gray-300 p-1 font-mono text-[11px]" />
      </label>

      <section aria-label="Region boxes">
        <h4 className="font-semibold">Region boxes</h4>
        <p className="text-gray-500">Drag on the page to add a box; click a box to select it.</p>
        <ul className="mt-1 space-y-1">
          {label.regions.map((region, index) => (
            <li
              key={index}
              className={`flex flex-wrap items-center gap-1 rounded border p-1 ${selectedRegion === index ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}
              data-testid={`gold-region-${index}`}
            >
              <button type="button" onClick={() => onSelectRegion(index)} className="font-mono text-gray-500">#{index + 1}</button>
              <select
                aria-label={`Region ${index + 1} class`}
                value={region.class}
                onChange={(e) => setRegion(index, { class: e.target.value as GoldRegionClass })}
                className="rounded border border-gray-300 px-1 py-0.5"
              >
                {GOLD_REGION_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
              {region.bbox.map((value, coordinate) => (
                <input
                  key={coordinate}
                  aria-label={`Region ${index + 1} ${['x0', 'y0', 'x1', 'y1'][coordinate]}`}
                  type="number"
                  min={0}
                  max={1}
                  step={0.005}
                  value={value}
                  onChange={(e) => {
                    const bbox = [...region.bbox]
                    bbox[coordinate] = Number(e.target.value)
                    setRegion(index, { bbox: clampBBox(bbox) })
                  }}
                  className="w-16 rounded border border-gray-300 px-1 py-0.5 font-mono"
                />
              ))}
              <button
                type="button"
                aria-label={`Remove region ${index + 1}`}
                onClick={() => {
                  set({ regions: label.regions.filter((_, i) => i !== index) })
                  onSelectRegion(null)
                }}
                className="text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Entities">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Entities</h4>
          <button
            type="button"
            onClick={() => set({ entities: [...label.entities, { type: 'monster', data: { name: '' }, numbersChecked: false }] })}
            className="inline-flex items-center gap-1 rounded border border-gray-300 px-1.5 py-0.5"
          >
            <Plus className="h-3 w-3" /> Add entity
          </button>
        </div>
        <p className="text-gray-500">Check every field against the printed page, not only the ones that look wrong.</p>
        <ul className="mt-1 space-y-2">
          {label.entities.map((entity, index) => (
            <EntityEditor
              key={index}
              entity={entity}
              index={index}
              onChange={(next) => setEntity(index, next)}
              onRemove={() => set({ entities: label.entities.filter((_, i) => i !== index) })}
            />
          ))}
        </ul>
      </section>

      <label className="flex flex-col gap-0.5">
        Notes
        <textarea value={label.review.notes ?? ''} onChange={(e) => set({ review: { ...label.review, notes: e.target.value } })} rows={2} className="rounded border border-gray-300 p-1" />
      </label>
    </div>
  )
}

export default GoldsetEditor

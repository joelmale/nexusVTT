import { AlertTriangle, CheckCircle2, Crosshair } from 'lucide-react'
import type { ExtractedEntityPayload } from './types'

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

const modifier = (score: number) => {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`
}

const str = (value: unknown) => (value === undefined || value === null ? '—' : String(value))
const list = (value: unknown) => (Array.isArray(value) ? (value as string[]) : [])

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1">
      <div className="font-mono text-[9px] uppercase tracking-wider text-indigo-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function ReviewBadge({ review }: { review: ExtractedEntityPayload['review'] }) {
  if (review.status === 'auto') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        All values grounded · {Math.round(review.confidence * 100)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Needs review · {Math.round(review.confidence * 100)}%
    </span>
  )
}

export interface EntityCardProps {
  entity: ExtractedEntityPayload
  isNew?: boolean
  reducedMotion?: boolean
  onShowSource?: (entity: ExtractedEntityPayload) => void
}

/**
 * Typed stat card for one extracted entity (monster, spell or item). New
 * cards get a brief highlight unless the viewer prefers reduced motion.
 */
export function EntityCard({ entity, isNew = false, reducedMotion = false, onShowSource }: EntityCardProps) {
  const s = entity.summary
  const needsReview = entity.review.status === 'needs_review'
  const highlight = isNew && !reducedMotion ? 'animate-pulse ring-2 ring-purple-300' : ''

  return (
    <article
      className={`rounded-lg border bg-white p-3 shadow-sm ${needsReview ? 'border-amber-300' : 'border-purple-200'} ${highlight}`}
      data-testid={`entity-card-${entity.name}`}
      aria-label={`${entity.type} ${entity.name}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-purple-600">
            {entity.type} · p. {entity.source.pageNumber}
            {entity.cached ? ' · cached' : ''}
          </div>
          <h4 className="text-base font-bold text-gray-900">{entity.name}</h4>
          {entity.type === 'monster' && <p className="text-xs italic text-gray-500">{str(s.sizeType)}</p>}
        </div>
        <ReviewBadge review={entity.review} />
      </header>

      {entity.type === 'monster' && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Pill label="Armor class" value={str(s.armorClass)} />
            <Pill label="Hit points" value={`${str(s.hitPoints)}${s.hitDice ? ` (${s.hitDice})` : ''}`} />
            <Pill label="Speed" value={str(s.speed)} />
            <Pill label="Challenge" value={str(s.challengeRating)} />
          </div>
          {s.abilities && typeof s.abilities === 'object' ? (
            <dl className="grid grid-cols-6 rounded-md border border-gray-200 bg-gray-50 text-center" aria-label="Ability scores">
              {ABILITIES.map((ability) => {
                const score = (s.abilities as Record<string, number>)[ability]
                return (
                  <div key={ability} className="py-1">
                    <dt className="font-mono text-[9px] uppercase text-gray-500">{ability}</dt>
                    <dd className="text-xs font-semibold text-gray-900">
                      {typeof score === 'number' ? `${score} (${modifier(score)})` : '—'}
                    </dd>
                  </div>
                )
              })}
            </dl>
          ) : null}
          {list(s.traits).length > 0 && (
            <p className="text-xs text-gray-700">
              <span className="font-mono text-[10px] font-bold uppercase text-fuchsia-600">Traits </span>
              {list(s.traits).join(' · ')}
            </p>
          )}
          {list(s.actions).length > 0 && (
            <p className="text-xs text-gray-700">
              <span className="font-mono text-[10px] font-bold uppercase text-fuchsia-600">Actions </span>
              {list(s.actions).join(' · ')}
            </p>
          )}
          {list(s.legendaryActions).length > 0 && (
            <p className="text-xs text-gray-700">
              <span className="font-mono text-[10px] font-bold uppercase text-fuchsia-600">Legendary </span>
              {list(s.legendaryActions).join(' · ')}
            </p>
          )}
        </div>
      )}

      {entity.type === 'spell' && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Pill label="Level" value={s.level === 0 ? 'Cantrip' : str(s.level)} />
          <Pill label="School" value={str(s.school)} />
          <Pill label="Casting time" value={str(s.castingTime)} />
          <Pill label="Range" value={str(s.range)} />
          <Pill label="Components" value={str(s.components)} />
          <Pill label="Duration" value={str(s.duration)} />
        </div>
      )}

      {entity.type === 'item' && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Pill label="Type" value={str(s.itemType)} />
          <Pill label="Rarity" value={str(s.rarity)} />
          <Pill label="Attunement" value={s.requiresAttunement ? 'Required' : 'No'} />
        </div>
      )}

      {needsReview && entity.review.reasons.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[11px] text-amber-800" aria-label="Review reasons">
          {entity.review.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {onShowSource && (
        <button
          type="button"
          onClick={() => onShowSource(entity)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
        >
          <Crosshair className="h-3 w-3" aria-hidden="true" />
          Show source
        </button>
      )}
    </article>
  )
}

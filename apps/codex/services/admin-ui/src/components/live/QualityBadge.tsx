import { qualityLevel, type QualityLevel } from './quality'

const STYLES: Record<QualityLevel, { className: string; word: string }> = {
  good: { className: 'border-emerald-300 bg-emerald-50 text-emerald-800', word: 'clean' },
  warn: { className: 'border-amber-300 bg-amber-50 text-amber-800', word: 'check' },
  fail: { className: 'border-red-300 bg-red-50 text-red-800', word: 'noisy' },
  unknown: { className: 'border-gray-300 bg-gray-50 text-gray-600', word: 'not scored' },
}

export interface QualityBadgeProps {
  value?: number
  label?: string
  lowPages?: number[]
  onSelectPage?: (pageNumber: number) => void
}

export function QualityBadge({ value, label = 'Text cleanliness', lowPages = [], onSelectPage }: QualityBadgeProps) {
  const level = qualityLevel(value)
  const style = STYLES[level]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${style.className}`}
        title="Share of words found in an English dictionary plus a game lexicon. Thresholds are provisional until the gold set sets them."
        data-level={level}
      >
        {label}: {value === undefined ? '—' : `${(value * 100).toFixed(1)}%`} ({style.word})
      </span>
      {lowPages.length > 0 && (
        <span className="text-xs text-gray-600">
          Check these pages:{' '}
          {lowPages.slice(0, 12).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onSelectPage?.(page)}
              className="mr-1 font-mono text-indigo-600 underline hover:text-indigo-800"
            >
              p.{page}
            </button>
          ))}
          {lowPages.length > 12 && `+${lowPages.length - 12} more`}
        </span>
      )}
    </div>
  )
}

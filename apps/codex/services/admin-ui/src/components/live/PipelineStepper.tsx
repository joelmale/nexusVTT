import { AlertTriangle, Check, Loader2, MinusCircle, RotateCcw } from 'lucide-react'
import { formatDuration, type PipelineStep, type StepStatus } from './pipeline'

const STATUS: Record<StepStatus, { word: string; badge: string; ring: string }> = {
  pending: {
    word: 'Waiting',
    badge: 'border-gray-300 bg-white text-gray-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500',
    ring: 'border-gray-200 dark:border-slate-700',
  },
  active: {
    word: 'Running',
    badge: 'border-indigo-500 bg-indigo-500 text-white',
    ring: 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40',
  },
  done: {
    word: 'Done',
    badge: 'border-emerald-500 bg-emerald-500 text-white',
    ring: 'border-emerald-200 dark:border-emerald-800',
  },
  failed: {
    word: 'Failed',
    badge: 'border-red-500 bg-red-500 text-white',
    ring: 'border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-950/40',
  },
  skipped: {
    word: 'Skipped',
    badge: 'border-gray-300 bg-gray-100 text-gray-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400',
    ring: 'border-gray-200 border-dashed dark:border-slate-700',
  },
}

function Badge({ status, index }: { status: StepStatus; index: number }) {
  const className = `flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${STATUS[status].badge}`
  return (
    <span className={className} aria-hidden="true">
      {status === 'done' ? (
        <Check className="h-3.5 w-3.5" />
      ) : status === 'active' ? (
        <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
      ) : status === 'failed' ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : status === 'skipped' ? (
        <MinusCircle className="h-3.5 w-3.5" />
      ) : (
        index + 1
      )}
    </span>
  )
}

export interface PipelineStepperProps {
  steps: PipelineStep[]
  /** Clock for live elapsed timers (ms since epoch). */
  now: number
  selected: string | null
  onSelect: (stepId: string | null) => void
  onRetryStage?: (stepId: string) => void
  isRetrying?: boolean
}

/**
 * The run as five steps (v2). Each shows its status in words as well as
 * colour, a live elapsed timer while running and its duration when done.
 * Clicking a step filters the artifact stream and console to it; clicking it
 * again clears the filter.
 */
export function PipelineStepper({ steps, now, selected, onSelect, onRetryStage, isRetrying }: PipelineStepperProps) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Pipeline steps">
      {steps.map((step, index) => {
        const style = STATUS[step.status]
        const elapsed =
          step.startedAt === undefined ? undefined : (step.endedAt ?? (step.status === 'active' ? now : step.startedAt)) - step.startedAt
        const isSelected = selected === step.id
        return (
          <li key={step.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelect(isSelected ? null : step.id)}
              aria-pressed={isSelected}
              data-testid={`step-${step.id}`}
              data-status={step.status}
              className={`flex h-full w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 ${style.ring} ${
                isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2 min-w-0 pr-6">
                  <Badge status={step.status} index={index} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-gray-900 dark:text-slate-100">{step.label}</span>
                    <span className="block truncate font-mono text-[10px] text-gray-500 dark:text-slate-400">{step.engine}</span>
                  </span>
                </span>
              </div>
              <span className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-gray-600 dark:text-slate-300">{style.word}</span>
                {elapsed !== undefined && (
                  <span className="text-gray-500 tabular-nums dark:text-slate-400" data-testid={`step-${step.id}-elapsed`}>
                    {formatDuration(elapsed)}
                  </span>
                )}
              </span>
              {step.progress !== undefined && (
                <span className="h-1 w-full overflow-hidden rounded bg-gray-200 dark:bg-slate-700" aria-hidden="true">
                  <span
                    className={`block h-full ${step.status === 'failed' ? 'bg-red-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.round(step.progress * 100)}%` }}
                  />
                </span>
              )}
              {step.detail && <span className="font-mono text-[11px] text-gray-700 dark:text-slate-300">{step.detail}</span>}
            </button>
            {onRetryStage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRetryStage(step.id)
                }}
                disabled={isRetrying}
                title={`Retry ${step.label} stage`}
                aria-label={`Retry ${step.label} stage`}
                data-testid={`retry-step-${step.id}`}
                className={`absolute top-2 right-2 rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:text-indigo-300 transition-opacity ${
                  step.status === 'failed' ? 'opacity-100 text-red-500 hover:text-red-700' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}

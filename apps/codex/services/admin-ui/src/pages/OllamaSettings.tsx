import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getOllamaSettings,
  saveOllamaSettings,
  testOllama,
  type OllamaCheck,
  type OllamaField,
  type OllamaSettingsPatch,
  type OllamaSettingsView,
} from '@/lib/settingsApi'
import { ErrorNotice, PageHeader, Pill, Section } from '@/components/common'
import { buttonClass, formatDate, inputClass } from '@/lib/ui'
import { FIELDS, CROP_FIELDS, buildPatch, draftFrom, toText, type Draft, type FieldSpec } from './ollamaForm'

function problemWith(spec: FieldSpec, text: string): string | null {
  const value = text.trim()
  if (!value) return spec.allowEmpty ? null : 'Required. Use Reset to go back to the environment value.'
  if (spec.numeric) {
    const n = Number(value)
    const { min, max } = spec.numeric
    if (!Number.isInteger(n) || n < min || n > max) return `A whole number from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`
  }
  return null
}

function CheckResult({ result, target }: { result: OllamaCheck; target: string }) {
  if (!result.ok) {
    return (
      <p role="status" className="text-sm text-red-700">
        {target}: {result.reason}
      </p>
    )
  }
  return (
    <div role="status" className="space-y-1 text-sm">
      <p className="text-green-800">
        {target}: connected to {result.url}
        {result.version ? ` (Ollama ${result.version})` : ''}.
      </p>
      {result.model &&
        (result.hasModel ? (
          <p className="text-green-800">{result.model} is installed.</p>
        ) : (
          <p className="text-amber-800">
            {result.model} is not installed on this server.{' '}
            {result.models.length > 0 ? `It has: ${result.models.join(', ')}.` : 'It has no models.'} Pull it with “ollama pull {result.model}”.
          </p>
        ))}
    </div>
  )
}

/**
 * Overrides for the Ollama environment variables doc-processor reads at the
 * start of each extract stage. A saved value wins over the environment; reset a
 * field to fall back to what the stack gives. Changes apply to the next
 * extraction run; a document already being processed keeps what it started with.
 */
export default function OllamaSettingsPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['ollama-settings'], queryFn: getOllamaSettings })
  const view = settings.data

  const [draft, setDraft] = useState<Draft>(draftFrom({}))
  const [notice, setNotice] = useState<string | null>(null)
  const [checks, setChecks] = useState<Partial<Record<'local' | 'remote', OllamaCheck>>>({})

  // Fill the form from the effective settings whenever they (re)load.
  useEffect(() => {
    if (view) setDraft(draftFrom(view.effective))
  }, [view])

  const accept = (next: OllamaSettingsView) => {
    queryClient.setQueryData(['ollama-settings'], next)
    setChecks({})
  }

  const save = useMutation({
    mutationFn: (patch: OllamaSettingsPatch) => saveOllamaSettings(patch),
    onSuccess: (next) => {
      accept(next)
      setNotice('Saved. The next extraction run uses these settings.')
    },
  })
  const test = useMutation({
    mutationFn: (target: 'local' | 'remote') => testOllama(target).then((result) => ({ target, result })),
    onSuccess: ({ target, result }) => setChecks((current) => ({ ...current, [target]: result })),
  })

  const patch = view ? buildPatch(view, draft) : {}
  const dirty = Object.keys(patch).length > 0
  const problems = FIELDS.map((spec) => [spec.key, problemWith(spec, draft[spec.key])] as const)
  const invalid = problems.some(([, problem]) => problem)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setNotice(null)
    save.mutate(patch)
  }
  const reset = (key: OllamaField) => {
    setNotice(null)
    save.mutate({ [key]: null })
  }
  const cropsChangedWithoutVersion = CROP_FIELDS.some((key) => key in patch) && !('promptVersion' in patch)

  const renderField = (spec: FieldSpec) => {
    const isSaved = view?.saved[spec.key] !== undefined
    const envValue = view?.environment ? toText(view.environment[spec.key]) : null
    const problem = problems.find(([key]) => key === spec.key)?.[1]
    const id = `ollama-${spec.key}`
    return (
      <div key={spec.key} className="space-y-1 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-sm font-medium text-gray-800">
            {spec.label}
          </label>
          {view && <Pill tone={isSaved ? 'blue' : 'gray'}>{isSaved ? 'Saved in Settings' : 'From the environment'}</Pill>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={id}
            className={`${inputClass} min-w-72 flex-1`}
            type="text"
            inputMode={spec.numeric ? 'numeric' : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={spec.placeholder}
            value={draft[spec.key]}
            onChange={(e) => setDraft({ ...draft, [spec.key]: e.target.value })}
          />
          {isSaved && (
            <button type="button" className={buttonClass.secondary} disabled={save.isPending} onClick={() => reset(spec.key)} aria-label={`Reset ${spec.label}`}>
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600">{spec.help}</p>
        {envValue !== null && isSaved && (
          <p className="text-xs text-gray-500">
            Environment: <span className="font-mono">{envValue || '(empty)'}</span>
          </p>
        )}
        {problem && (
          <p role="alert" className="text-xs text-red-700">
            {problem}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <PageHeader
        title="Ollama settings"
        description="Where extraction sends its vision-model calls. Saved values override the stack environment and apply to the next extraction run. Changes are recorded in the audit log."
      />
      {notice && (
        <p role="status" className="text-sm text-blue-800">
          {notice}
        </p>
      )}
      <ErrorNotice error={settings.error} />
      {view && !view.environment && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The environment values are not known yet: doc-processor publishes them when it starts. Saving still works; “Reset” will fall back to the environment once it has.
        </p>
      )}

      <form onSubmit={submit} className="space-y-4" aria-label="Ollama settings">
        <Section title="1. Endpoints and model">
          <div className="space-y-4">{FIELDS.filter((spec) => spec.group === 'ollama').map(renderField)}</div>
        </Section>

        <Section title="2. Stat-block images and cache">
          <div className="space-y-4">
            {FIELDS.filter((spec) => spec.group === 'crops').map(renderField)}
            {cropsChangedWithoutVersion && (
              <p role="note" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Crop changes only affect documents that are not already extracted. To re-read the ones that are, also change the extraction version.
              </p>
            )}
          </div>
        </Section>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button type="submit" className={buttonClass.primary} disabled={!dirty || invalid || save.isPending}>
              {save.isPending ? 'Saving...' : 'Save settings'}
            </button>
            {view?.updatedAt && (
              <span className="text-xs text-gray-500">
                Last changed {formatDate(view.updatedAt)}
                {view.updatedBy ? ` by ${view.updatedBy}` : ''}
              </span>
            )}
          </div>
          <ErrorNotice error={save.error} />
        </div>
      </form>

      <Section title="3. Test the saved settings">
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">Checks that each Ollama answers and has its model. It tests what is saved, so save first. The check runs from doc-api, which is the network the extraction worker sits on.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass.secondary} disabled={test.isPending} onClick={() => test.mutate('local')}>
              Test local
            </button>
            <button type="button" className={buttonClass.secondary} disabled={test.isPending || !view?.effective.remoteUrl} onClick={() => test.mutate('remote')}>
              Test remote
            </button>
          </div>
          {checks.local && <CheckResult result={checks.local} target="Local" />}
          {checks.remote && <CheckResult result={checks.remote} target="Remote" />}
          <ErrorNotice error={test.error} />
        </div>
      </Section>
    </div>
  )
}

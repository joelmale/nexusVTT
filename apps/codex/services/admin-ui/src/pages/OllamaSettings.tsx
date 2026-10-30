import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getOllamaSettings,
  saveOllamaSettings,
  testOllama,
  type OllamaCheck,
  type OllamaField,
  type OllamaSettings,
  type OllamaSettingsPatch,
  type OllamaSettingsView,
} from '@/lib/settingsApi'
import { ErrorNotice, PageHeader, Pill, Section } from '@/components/common'
import { buttonClass, formatDate, inputClass } from '@/lib/ui'

interface FieldSpec {
  key: OllamaField
  label: string
  help: string
  placeholder?: string
  /** Empty is a valid saved value (switches the remote off / "same model"). */
  allowEmpty?: boolean
  /** A whole number within these bounds. */
  numeric?: { min: number; max: number }
  group: 'ollama' | 'crops'
}

const FIELDS: FieldSpec[] = [
  {
    key: 'url',
    label: 'Local Ollama URL',
    help: 'The Ollama on the stack host. It shares the GPU with the layout models, so extraction hands the GPU over first. Point this at another machine only if you do not have a remote set below.',
    group: 'ollama',
  },
  { key: 'model', label: 'Model', help: 'One model reads both text and page images. It is part of the extraction cache key, so changing it re-reads documents instead of reusing cached answers.', group: 'ollama' },
  {
    key: 'remoteUrl',
    label: 'Remote Ollama URL',
    help: 'Optional second Ollama, for example a workstation GPU. It is used when it answers quickly and already has the model; otherwise extraction falls back to the local one. A remote Ollama skips the GPU handoff. Leave empty for none.',
    placeholder: 'http://192.168.100.148:11434',
    allowEmpty: true,
    group: 'ollama',
  },
  { key: 'remoteModel', label: 'Remote model', help: 'Model to use on the remote Ollama. Empty means the same as Model.', allowEmpty: true, group: 'ollama' },
  {
    key: 'numCtx',
    label: 'Context size (tokens)',
    help: 'Fixed per request so the host setting cannot inflate the KV cache past what the GPU holds. Image crops, text and the schema must all fit, or the prompt is truncated.',
    numeric: { min: 1024, max: 262144 },
    group: 'ollama',
  },
  { key: 'keepAlive', label: 'Keep alive', help: 'How long Ollama keeps the model loaded after a call, such as 10m, 3600 (seconds), or -1 for never unload.', group: 'ollama' },
  {
    key: 'cropDpi',
    label: 'Crop render DPI',
    help: 'Resolution pages are rendered at before a stat block is cropped out. Raising it only helps when the crop is still under the size limits below.',
    numeric: { min: 72, max: 600 },
    group: 'crops',
  },
  {
    key: 'cropMaxWidth',
    label: 'Crop max width (px)',
    help: 'A larger crop is shrunk to fit inside this box. A vision model spends about one token per 28×28 pixels, so 1200×1600 is roughly 2,500 tokens and 2000×2800 roughly 7,000. Keep the context size well above that.',
    numeric: { min: 256, max: 8192 },
    group: 'crops',
  },
  { key: 'cropMaxHeight', label: 'Crop max height (px)', help: 'See max width.', numeric: { min: 256, max: 8192 }, group: 'crops' },
  {
    key: 'promptVersion',
    label: 'Extraction version',
    help: 'Part of the extraction cache key. Crop settings are not, so after changing them set a new version (for example 2) to re-read documents that were already extracted.',
    group: 'crops',
  },
]

const CROP_FIELDS: OllamaField[] = ['cropDpi', 'cropMaxWidth', 'cropMaxHeight']

type Draft = Record<OllamaField, string>

const toText = (value: string | number | undefined | null) => (value === undefined || value === null ? '' : String(value))

const draftFrom = (settings: OllamaSettings): Draft =>
  Object.fromEntries(FIELDS.map((spec) => [spec.key, toText(settings[spec.key])])) as Draft

/**
 * The patch that turns what is shown into what the form says: a changed field is
 * saved, unless it now equals the environment value, in which case the override
 * is dropped (null). Unchanged fields are left out.
 */
export function buildPatch(view: OllamaSettingsView, draft: Draft): OllamaSettingsPatch {
  const patch: Record<string, string | number | null> = {}
  for (const spec of FIELDS) {
    const text = draft[spec.key].trim()
    if (text === toText(view.effective[spec.key])) continue
    const envText = view.environment ? toText(view.environment[spec.key]) : null
    patch[spec.key] = envText !== null && text === envText ? null : spec.numeric ? Number(text) : text
  }
  return patch as OllamaSettingsPatch
}

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

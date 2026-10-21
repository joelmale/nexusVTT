import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  getLlmSettings,
  removeDeepSeekKey,
  saveDeepSeekKey,
  saveLlmSettings,
  testDeepSeek,
  type DeepSeekCheck,
  type EntityKind,
  type LlmBackend,
  type LlmMode,
  type LlmSettingsView,
} from '@/lib/settingsApi'
import { ErrorNotice, PageHeader, Pill, Section } from '@/components/common'
import { buttonClass, formatDate, inputClass } from '@/lib/ui'

const MODES: Array<{ value: LlmMode; label: string; help: string }> = [
  { value: 'auto', label: 'Automatic (recommended)', help: 'Each kind of entry goes where you choose below. Spells and items are plain text, so they suit DeepSeek; stat blocks need the page image, so they stay local.' },
  { value: 'ollama', label: 'Always local (Ollama)', help: 'Everything is read by the model on your own server. Nothing leaves the building. Slower, and it shares the GPU.' },
  { value: 'deepseek', label: 'Always DeepSeek', help: 'Everything is read by DeepSeek. Stat blocks are read from text alone (no image) and are marked "needs review".' },
]

const KINDS: Array<{ kind: EntityKind; label: string; note?: string }> = [
  { kind: 'spell', label: 'Spells' },
  { kind: 'item', label: 'Magic items' },
  { kind: 'monster', label: 'Stat blocks', note: 'DeepSeek cannot see images, so a stat block sent there is read from text only and flagged for review.' },
]

const ERROR_TEXT: Record<string, string> = {
  settings_key_missing: 'To save a key here, set CODEX_SETTINGS_KEY (24+ characters) on doc-api and doc-processor in the stack environment, redeploy, then try again.',
}

function friendly(error: unknown): unknown {
  if (error instanceof ApiError && error.code && ERROR_TEXT[error.code]) return new Error(ERROR_TEXT[error.code])
  return error
}

const KEY_SOURCE_LABEL = { env: 'Set by the environment', saved: 'Saved in Settings', none: 'Not set' } as const
const KEY_SOURCE_TONE = { env: 'blue', saved: 'green', none: 'gray' } as const

function CheckResult({ result }: { result: DeepSeekCheck }) {
  if (!result.ok) {
    return (
      <p role="status" className="text-sm text-red-700">
        Connection failed: {result.reason}
      </p>
    )
  }
  const balance = result.balances.map((entry) => `${entry.total} ${entry.currency}`).join(', ')
  return (
    <p role="status" className="text-sm text-green-800">
      Connected. {result.available ? 'The account can make calls' : 'The account has no usable balance'}
      {balance ? ` (balance ${balance})` : ''}.
    </p>
  )
}

/**
 * Which model reads each kind of entry, and the DeepSeek API key. Changes apply
 * to the next extraction run; a document already being processed keeps what it
 * started with. The key is write-only: after saving, only its last four
 * characters are ever shown.
 */
export default function Settings() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['llm-settings'], queryFn: getLlmSettings })
  const view = settings.data

  const [mode, setMode] = useState<LlmMode>('auto')
  const [routes, setRoutes] = useState<Record<EntityKind, LlmBackend>>({ monster: 'ollama', spell: 'deepseek', item: 'deepseek' })
  const [model, setModel] = useState('')
  const [maxTokens, setMaxTokens] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [check, setCheck] = useState<DeepSeekCheck | null>(null)

  // Fill the form from the saved settings whenever they (re)load.
  useEffect(() => {
    if (!view) return
    setMode(view.settings.mode)
    setRoutes(view.settings.routes)
    setModel(view.deepseek.model)
    setMaxTokens(String(view.deepseek.maxTokens))
  }, [view])

  const accept = (next: LlmSettingsView) => queryClient.setQueryData(['llm-settings'], next)

  const saveRouting = useMutation({
    mutationFn: () =>
      saveLlmSettings({
        mode,
        routes,
        deepseekModel: model.trim() && model.trim() !== view?.deepseek.model ? model.trim() : undefined,
        deepseekMaxTokens: Number(maxTokens) && Number(maxTokens) !== view?.deepseek.maxTokens ? Number(maxTokens) : undefined,
      }),
    onSuccess: (next) => {
      accept(next)
      setNotice('Saved. The next extraction run uses these settings.')
    },
  })
  const saveKey = useMutation({
    mutationFn: () => saveDeepSeekKey(apiKey.trim()),
    onSuccess: (next) => {
      accept(next)
      setApiKey('')
      setCheck(null)
      setNotice('Key saved. It is encrypted and will not be shown again.')
    },
  })
  const removeKey = useMutation({
    mutationFn: removeDeepSeekKey,
    onSuccess: (next) => {
      accept(next)
      setConfirmRemove(false)
      setCheck(null)
      setNotice('Saved key removed.')
    },
  })
  const test = useMutation({ mutationFn: testDeepSeek, onSuccess: setCheck })

  const dirty =
    !!view &&
    (mode !== view.settings.mode ||
      KINDS.some(({ kind }) => routes[kind] !== view.settings.routes[kind]) ||
      (model.trim() !== '' && model.trim() !== view.deepseek.model) ||
      (Number(maxTokens) > 0 && Number(maxTokens) !== view.deepseek.maxTokens))

  const keyActive = view?.deepseek.keySource !== 'none'
  const envOwnsKey = view?.deepseek.keySource === 'env'

  const submitRouting = (event: FormEvent) => {
    event.preventDefault()
    setNotice(null)
    saveRouting.mutate()
  }
  const submitKey = (event: FormEvent) => {
    event.preventDefault()
    setNotice(null)
    saveKey.mutate()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <PageHeader
        title="Extraction settings"
        description="Choose which model reads your documents. Changes apply to the next extraction run and are recorded in the audit log."
      />
      {notice && (
        <p role="status" className="text-sm text-blue-800">
          {notice}
        </p>
      )}
      <ErrorNotice error={settings.error} />

      <Section title="1. Which model reads each kind of entry">
        <form onSubmit={submitRouting} className="space-y-4" aria-label="Extraction routing">
          <fieldset className="space-y-2">
            <legend className="sr-only">Provider</legend>
            {MODES.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 p-3 text-sm has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
                <input type="radio" name="mode" className="mt-1" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} />
                <span>
                  <span className="font-medium text-gray-900">{option.label}</span>
                  {view && view.environment.mode === option.value && <span className="ml-2 text-xs text-gray-500">(environment default)</span>}
                  <span className="block text-gray-600">{option.help}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className={mode === 'auto' ? '' : 'opacity-50'} aria-disabled={mode !== 'auto'}>
            <h3 className="mb-1 text-sm font-semibold text-gray-800">In automatic mode</h3>
            <table className="w-full text-sm">
              <tbody>
                {KINDS.map(({ kind, label, note }) => (
                  <tr key={kind} className="border-t border-gray-100 align-top">
                    <th scope="row" className="w-40 py-2 text-left font-medium text-gray-700">
                      {label}
                    </th>
                    <td className="py-2">
                      <select
                        aria-label={`${label} go to`}
                        className={inputClass}
                        disabled={mode !== 'auto'}
                        value={routes[kind]}
                        onChange={(e) => setRoutes({ ...routes, [kind]: e.target.value as LlmBackend })}
                      >
                        <option value="ollama">Local model (Ollama)</option>
                        <option value="deepseek">DeepSeek (cloud)</option>
                      </select>
                      {note && routes[kind] === 'deepseek' && <p className="mt-1 text-xs text-amber-800">{note}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mode !== 'auto' && <p className="mt-1 text-xs text-gray-500">These only apply in automatic mode.</p>}
          </div>

          {view && !keyActive && mode !== 'ollama' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No DeepSeek key is set, so everything is read by the local model until you add one in step 2.
            </p>
          )}
          <p className="text-xs text-gray-500">
            Anything sent to DeepSeek leaves your server: the text of those pages is processed by DeepSeek. Local model choices never do.
          </p>
          <div className="flex items-center gap-3">
            <button type="submit" className={buttonClass.primary} disabled={!dirty || saveRouting.isPending}>
              {saveRouting.isPending ? 'Saving...' : 'Save routing'}
            </button>
            {view?.updatedAt && (
              <span className="text-xs text-gray-500">
                Last changed {formatDate(view.updatedAt)}
                {view.updatedBy ? ` by ${view.updatedBy}` : ''}
              </span>
            )}
          </div>
          <ErrorNotice error={friendly(saveRouting.error)} />
        </form>
      </Section>

      <Section title="2. DeepSeek API key">
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Get a key at platform.deepseek.com. A key set in the stack environment (DEEPSEEK_API_KEY) always wins over one saved here.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-700">Status:</span>
            {view ? (
              <>
                <Pill tone={KEY_SOURCE_TONE[view.deepseek.keySource]}>{KEY_SOURCE_LABEL[view.deepseek.keySource]}</Pill>
                {view.deepseek.keyHint && <span className="font-mono text-xs text-gray-600">key {view.deepseek.keyHint}</span>}
              </>
            ) : (
              <span className="text-gray-500">Loading...</span>
            )}
          </div>
          {view?.deepseek.savedKeyOverridden && (
            <p className="text-xs text-gray-600">A key is also saved here, but the environment key is used. Remove the environment variable to use the saved one.</p>
          )}
          {view?.deepseek.savedKeyUnreadable && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              A key is saved but cannot be decrypted. CODEX_SETTINGS_KEY has changed or is missing on a service. Save the key again or restore the old value.
            </p>
          )}
          {view && !view.deepseek.canSaveKey && !envOwnsKey && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Saving a key here is switched off until CODEX_SETTINGS_KEY (24+ random characters) is set on doc-api and doc-processor in the stack environment. It is used to encrypt the key in the database.
            </p>
          )}

          <form onSubmit={submitKey} className="flex flex-wrap items-end gap-3" aria-label="Save API key">
            <label className="min-w-64 flex-1 space-y-1">
              <span className="block font-medium text-gray-700">{keyActive && !envOwnsKey ? 'Replace key' : 'API key'}</span>
              <input
                className={inputClass}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={envOwnsKey ? 'Set by the environment' : 'sk-...'}
                disabled={envOwnsKey || !view?.deepseek.canSaveKey}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
            <button type="submit" className={buttonClass.primary} disabled={!apiKey.trim() || saveKey.isPending || envOwnsKey || !view?.deepseek.canSaveKey}>
              {saveKey.isPending ? 'Saving...' : 'Save key'}
            </button>
            {view?.deepseek.keySource === 'saved' &&
              (confirmRemove ? (
                <>
                  <button type="button" className={buttonClass.danger} disabled={removeKey.isPending} onClick={() => removeKey.mutate()}>
                    Confirm remove
                  </button>
                  <button type="button" className={buttonClass.secondary} onClick={() => setConfirmRemove(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className={buttonClass.secondary} onClick={() => setConfirmRemove(true)}>
                  Remove saved key
                </button>
              ))}
          </form>
          <p className="text-xs text-gray-500">Setting or removing a key needs a Google sign-in within the last 10 minutes. The key is stored encrypted and never shown again.</p>
          <ErrorNotice error={friendly(saveKey.error)} />
          <ErrorNotice error={friendly(removeKey.error)} />

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass.secondary} disabled={!keyActive || test.isPending} onClick={() => test.mutate()}>
              {test.isPending ? 'Testing...' : 'Test connection'}
            </button>
            {check && <CheckResult result={check} />}
          </div>
          <ErrorNotice error={test.error} />

          <details className="rounded-md border border-gray-200 p-3">
            <summary className="cursor-pointer font-medium text-gray-700">Advanced: model and answer limit</summary>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="space-y-1">
                <span className="block font-medium text-gray-700">Model</span>
                <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="block font-medium text-gray-700">Max tokens per answer</span>
                <input className={inputClass} type="number" min={256} max={8192} value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">Save these with “Save routing” above. The limit stops a runaway answer from spending your balance.</p>
          </details>
        </div>
      </Section>
    </div>
  )
}

import type { OllamaField, OllamaSettings, OllamaSettingsPatch, OllamaSettingsView } from '@/lib/settingsApi'

export interface FieldSpec {
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

export const FIELDS: FieldSpec[] = [
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

export const CROP_FIELDS: OllamaField[] = ['cropDpi', 'cropMaxWidth', 'cropMaxHeight']

export type Draft = Record<OllamaField, string>

export const toText = (value: string | number | undefined | null) => (value === undefined || value === null ? '' : String(value))

export const draftFrom = (settings: OllamaSettings): Draft =>
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


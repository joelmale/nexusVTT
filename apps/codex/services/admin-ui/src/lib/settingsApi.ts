/**
 * Extraction LLM settings (doc-api admin/settings/llm, via control-api). The
 * DeepSeek API key is write-only: nothing here ever receives it back, only
 * where it comes from and its last four characters.
 */
import { codexJson, jsonRequest } from './api'

export type LlmMode = 'auto' | 'ollama' | 'deepseek'
export type LlmBackend = 'ollama' | 'deepseek'
export type EntityKind = 'monster' | 'spell' | 'item'
export type KeySource = 'env' | 'saved' | 'none'

export interface LlmSettingsView {
  settings: {
    mode: LlmMode
    routes: Record<EntityKind, LlmBackend>
    deepseekModel?: string
    deepseekMaxTokens?: number
  }
  deepseek: {
    keySource: KeySource
    keyHint: string | null
    savedKeyOverridden: boolean
    canSaveKey: boolean
    savedKeyUnreadable: boolean
    url: string
    model: string
    maxTokens: number
  }
  environment: { mode: LlmMode; routes: Record<EntityKind, LlmBackend> }
  updatedAt: string | null
  updatedBy: string | null
}

export type DeepSeekCheck =
  | { ok: true; available: boolean; balances: Array<{ currency: string; total: string }> }
  | { ok: false; reason: string }

export interface LlmSettingsPatch {
  mode?: LlmMode
  routes?: Partial<Record<EntityKind, LlmBackend>>
  deepseekModel?: string | null
  deepseekMaxTokens?: number | null
}

/** Ollama / VLM endpoint overrides (doc-api admin/settings/ollama). An absent field means "use the environment". */
export interface OllamaSettings {
  url?: string
  model?: string
  remoteUrl?: string
  remoteModel?: string
  numCtx?: number
  keepAlive?: string
  cropDpi?: number
  cropMaxWidth?: number
  cropMaxHeight?: number
  promptVersion?: string
}

export type OllamaField = keyof OllamaSettings

export interface OllamaSettingsView {
  saved: OllamaSettings
  /** What doc-processor's environment gives; null until doc-processor has started once. */
  environment: OllamaSettings | null
  effective: OllamaSettings
  updatedAt: string | null
  updatedBy: string | null
}

/** A value to save, or null to drop the override and fall back to the environment. */
export type OllamaSettingsPatch = { [K in OllamaField]?: OllamaSettings[K] | null }

export type OllamaCheck =
  | { ok: true; url: string; version: string | null; model: string; hasModel: boolean; models: string[] }
  | { ok: false; url: string | null; reason: string }

const base = '/api/admin/settings/llm'
const ollamaBase = '/api/admin/settings/ollama'

export const getOllamaSettings = (): Promise<OllamaSettingsView> => codexJson(ollamaBase)
export const saveOllamaSettings = (patch: OllamaSettingsPatch): Promise<OllamaSettingsView> => codexJson(ollamaBase, jsonRequest('PUT', patch))
export const testOllama = (target: 'local' | 'remote'): Promise<OllamaCheck> => codexJson(`${ollamaBase}/test`, jsonRequest('POST', { target }))

export const getLlmSettings = (): Promise<LlmSettingsView> => codexJson(base)
export const saveLlmSettings = (patch: LlmSettingsPatch): Promise<LlmSettingsView> => codexJson(base, jsonRequest('PUT', patch))
export const saveDeepSeekKey = (apiKey: string): Promise<LlmSettingsView> => codexJson(`${base}/key`, jsonRequest('PUT', { apiKey }))
export const removeDeepSeekKey = (): Promise<LlmSettingsView> => codexJson(`${base}/key`, { method: 'DELETE' })
export const testDeepSeek = (): Promise<DeepSeekCheck> => codexJson(`${base}/test`, { method: 'POST' })

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

const base = '/api/admin/settings/llm'

export const getLlmSettings = (): Promise<LlmSettingsView> => codexJson(base)
export const saveLlmSettings = (patch: LlmSettingsPatch): Promise<LlmSettingsView> => codexJson(base, jsonRequest('PUT', patch))
export const saveDeepSeekKey = (apiKey: string): Promise<LlmSettingsView> => codexJson(`${base}/key`, jsonRequest('PUT', { apiKey }))
export const removeDeepSeekKey = (): Promise<LlmSettingsView> => codexJson(`${base}/key`, { method: 'DELETE' })
export const testDeepSeek = (): Promise<DeepSeekCheck> => codexJson(`${base}/test`, { method: 'POST' })

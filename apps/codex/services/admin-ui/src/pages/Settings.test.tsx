import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import Settings from './Settings'
import type { LlmSettingsView } from '@/lib/settingsApi'
import { json, meWith, renderPage, requestsTo, stubFetch } from '@/test/utils'

const SETTINGS_PATH = '/control-api/v1/codex/admin/settings/llm'
const KEY_PATH = `${SETTINGS_PATH}/key`
const TEST_PATH = `${SETTINGS_PATH}/test`
const SECRET = 'sk-live-abcdef1234567890wxyz'

const view: LlmSettingsView = {
  settings: { mode: 'auto', routes: { monster: 'ollama', spell: 'deepseek', item: 'deepseek' } },
  deepseek: {
    keySource: 'saved',
    keyHint: '…wxyz',
    savedKeyOverridden: false,
    canSaveKey: true,
    savedKeyUnreadable: false,
    url: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    maxTokens: 4096,
  },
  environment: { mode: 'auto', routes: { monster: 'ollama', spell: 'deepseek', item: 'deepseek' } },
  updatedAt: '2026-10-20T12:00:00.000Z',
  updatedBy: 'admin-1',
}

const withDeepSeek = (patch: Partial<LlmSettingsView['deepseek']>): LlmSettingsView => ({ ...view, deepseek: { ...view.deepseek, ...patch } })

afterEach(() => cleanup())

const open = async (data: LlmSettingsView = view, extra: Array<[string, string | RegExp, Parameters<typeof stubFetch>[0][number][2]]> = []) => {
  const requests = stubFetch([['GET', SETTINGS_PATH, () => json(200, data)], ...extra])
  renderPage(<Settings />, { me: meWith('platform_admin') })
  await screen.findByRole('radio', { name: /Automatic/ })
  // The form renders before the data arrives; wait until the key status has loaded.
  await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull())
  await waitFor(() => expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe(data.deepseek.model))
  return requests
}

describe('Settings page', () => {
  it('shows the current routing and where the key comes from, never the key', async () => {
    await open()
    expect(screen.getByRole('heading', { name: 'Extraction settings' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: /Automatic/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Spells go to') as HTMLSelectElement).value).toBe('deepseek')
    expect((screen.getByLabelText('Stat blocks go to') as HTMLSelectElement).value).toBe('ollama')
    expect(screen.getByText('Saved in Settings')).toBeTruthy()
    expect(screen.getByText('key …wxyz')).toBeTruthy()
    expect(document.body.textContent).not.toContain(SECRET)
  })

  it('keeps Save routing disabled until something changes, then saves the mode', async () => {
    const requests = await open(view, [['PUT', SETTINGS_PATH, () => json(200, { ...view, settings: { ...view.settings, mode: 'ollama' } })]])
    const save = screen.getByRole('button', { name: 'Save routing' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: /Always local/ }))
    expect(save.disabled).toBe(false)
    fireEvent.click(save)

    await waitFor(() => expect(requestsTo(requests, 'PUT', SETTINGS_PATH)).toHaveLength(1))
    expect(requestsTo(requests, 'PUT', SETTINGS_PATH)[0].json()).toMatchObject({ mode: 'ollama' })
    expect(await screen.findByText('Saved. The next extraction run uses these settings.')).toBeTruthy()
  })

  it('lets each kind of entry be routed, and warns that a stat block sent to DeepSeek is read without its image', async () => {
    const requests = await open(view, [['PUT', SETTINGS_PATH, () => json(200, view)]])
    expect(screen.queryByText(/read from text only and flagged for review/)).toBeNull()

    fireEvent.change(screen.getByLabelText('Stat blocks go to'), { target: { value: 'deepseek' } })
    expect(screen.getByText(/read from text only and flagged for review/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save routing' }))

    await waitFor(() => expect(requestsTo(requests, 'PUT', SETTINGS_PATH)).toHaveLength(1))
    expect(requestsTo(requests, 'PUT', SETTINGS_PATH)[0].json()).toMatchObject({ mode: 'auto', routes: { monster: 'deepseek', spell: 'deepseek', item: 'deepseek' } })
  })

  it('disables the per-type choices outside automatic mode', async () => {
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /Always DeepSeek/ }))
    expect((screen.getByLabelText('Spells go to') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText('These only apply in automatic mode.')).toBeTruthy()
  })

  it('warns when DeepSeek is chosen but no key is set', async () => {
    await open(withDeepSeek({ keySource: 'none', keyHint: null }))
    expect(screen.getByText(/No DeepSeek key is set, so everything is read by the local model/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Test connection' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('saves a key write-only: sends it once, clears the field, and shows only the hint', async () => {
    const requests = await open(withDeepSeek({ keySource: 'none', keyHint: null }), [
      ['PUT', KEY_PATH, () => json(200, withDeepSeek({ keySource: 'saved', keyHint: '…wxyz' }))],
    ])
    const input = screen.getByLabelText('API key') as HTMLInputElement
    expect(input.type).toBe('password')

    fireEvent.change(input, { target: { value: SECRET } })
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }))

    await waitFor(() => expect(requestsTo(requests, 'PUT', KEY_PATH)).toHaveLength(1))
    expect(requestsTo(requests, 'PUT', KEY_PATH)[0].json()).toEqual({ apiKey: SECRET })
    expect(await screen.findByText('Key saved. It is encrypted and will not be shown again.')).toBeTruthy()
    await waitFor(() => expect((screen.getByLabelText(/key/i, { selector: 'input[type=password]' }) as HTMLInputElement).value).toBe(''))
    expect(screen.getByText('key …wxyz')).toBeTruthy()
    expect(document.body.textContent).not.toContain(SECRET)
  })

  it('explains why a key cannot be saved without CODEX_SETTINGS_KEY, and disables the field', async () => {
    await open(withDeepSeek({ keySource: 'none', keyHint: null, canSaveKey: false }))
    expect(screen.getByText(/Saving a key here is switched off until CODEX_SETTINGS_KEY/)).toBeTruthy()
    expect((screen.getByLabelText('API key') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Save key' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('turns a 409 from doc-api into the fix', async () => {
    await open(withDeepSeek({ keySource: 'none', keyHint: null }), [
      ['PUT', KEY_PATH, () => json(409, { error: 'raw server text', code: 'settings_key_missing' })],
    ])
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: SECRET } })
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('set CODEX_SETTINGS_KEY (24+ characters)')
    expect(alert.textContent).not.toContain(SECRET)
  })

  it('shows an environment key as read-only and notes a saved key it overrides', async () => {
    await open(withDeepSeek({ keySource: 'env', keyHint: '…0000', savedKeyOverridden: true }))
    expect(screen.getByText('Set by the environment')).toBeTruthy()
    expect((screen.getByLabelText('API key') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/also saved here, but the environment key is used/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove saved key' })).toBeNull()
  })

  it('removes a saved key only after a confirmation', async () => {
    const requests = await open(view, [['DELETE', KEY_PATH, () => json(200, withDeepSeek({ keySource: 'none', keyHint: null }))]])
    fireEvent.click(screen.getByRole('button', { name: 'Remove saved key' }))
    expect(requestsTo(requests, 'DELETE', KEY_PATH)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(requestsTo(requests, 'DELETE', KEY_PATH)).toHaveLength(1))
    expect(await screen.findByText('Saved key removed.')).toBeTruthy()
    expect(screen.getByText('Not set')).toBeTruthy()
  })

  it('tests the connection and shows the balance', async () => {
    await open(view, [['POST', TEST_PATH, () => json(200, { ok: true, available: true, balances: [{ currency: 'USD', total: '15.50' }] })]])
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText('Connected. The account can make calls (balance 15.50 USD).')).toBeTruthy()
  })

  it('shows the reason when the connection test fails', async () => {
    await open(view, [['POST', TEST_PATH, () => json(200, { ok: false, reason: 'DeepSeek rejected the key.' })]])
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText('Connection failed: DeepSeek rejected the key.')).toBeTruthy()
  })

  it('flags a saved key that can no longer be decrypted', async () => {
    await open(withDeepSeek({ keySource: 'none', keyHint: null, savedKeyUnreadable: true }))
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText(/cannot be decrypted/)).toBeTruthy()
  })

  it('sends changed model and token limits with the routing', async () => {
    const requests = await open(view, [['PUT', SETTINGS_PATH, () => json(200, view)]])
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'deepseek-reasoner' } })
    fireEvent.change(screen.getByLabelText('Max tokens per answer'), { target: { value: '2048' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save routing' }))
    await waitFor(() => expect(requestsTo(requests, 'PUT', SETTINGS_PATH)).toHaveLength(1))
    expect(requestsTo(requests, 'PUT', SETTINGS_PATH)[0].json()).toMatchObject({ deepseekModel: 'deepseek-reasoner', deepseekMaxTokens: 2048 })
  })
})

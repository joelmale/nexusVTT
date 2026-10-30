import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import OllamaSettingsPage from './OllamaSettings'
import { buildPatch } from './ollamaForm'
import type { OllamaSettingsView } from '@/lib/settingsApi'
import { json, meWith, renderPage, requestsTo, stubFetch } from '@/test/utils'

const PATH = '/control-api/v1/codex/admin/settings/ollama'
const REMOTE = 'http://192.168.100.148:11434'

const environment = {
  url: 'http://ollama:11434',
  model: 'qwen3-vl:4b-instruct',
  remoteUrl: '',
  remoteModel: '',
  numCtx: 8192,
  keepAlive: '10m',
  cropDpi: 200,
  cropMaxWidth: 1200,
  cropMaxHeight: 1600,
  promptVersion: '1',
}
const view: OllamaSettingsView = {
  saved: { remoteUrl: REMOTE },
  environment,
  effective: { ...environment, remoteUrl: REMOTE },
  updatedAt: '2026-10-30T12:00:00.000Z',
  updatedBy: 'admin-1',
}

afterEach(() => cleanup())

const open = async (data: OllamaSettingsView = view, extra: Parameters<typeof stubFetch>[0] = []) => {
  const requests = stubFetch([['GET', PATH, () => json(200, data)], ...extra])
  renderPage(<OllamaSettingsPage />, { me: meWith('platform_admin') })
  await waitFor(() => expect((screen.getByLabelText('Remote Ollama URL') as HTMLInputElement).value).toBe(data.effective.remoteUrl ?? ''))
  return requests
}

describe('buildPatch', () => {
  const draft = (over: Record<string, string> = {}) => ({
    url: environment.url,
    model: environment.model,
    remoteUrl: REMOTE,
    remoteModel: '',
    numCtx: '8192',
    keepAlive: '10m',
    cropDpi: '200',
    cropMaxWidth: '1200',
    cropMaxHeight: '1600',
    promptVersion: '1',
    ...over,
  })

  it('leaves unchanged fields out', () => {
    expect(buildPatch(view, draft())).toEqual({})
  })

  it('saves a changed field, numbers as numbers', () => {
    expect(buildPatch(view, draft({ numCtx: '16384', model: 'qwen3-vl:8b-instruct' }))).toEqual({ numCtx: 16384, model: 'qwen3-vl:8b-instruct' })
  })

  it('drops the override when the value goes back to the environment', () => {
    expect(buildPatch(view, draft({ remoteUrl: '' }))).toEqual({ remoteUrl: null })
  })

  it('saves an empty remote URL to switch an environment remote off', () => {
    const withEnvRemote: OllamaSettingsView = { ...view, saved: {}, environment: { ...environment, remoteUrl: REMOTE }, effective: { ...environment, remoteUrl: REMOTE } }
    expect(buildPatch(withEnvRemote, draft({ remoteUrl: '' }))).toEqual({ remoteUrl: '' })
  })
})

describe('Ollama settings page', () => {
  it('shows each value and whether it is saved or from the environment', async () => {
    await open()
    expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe('qwen3-vl:4b-instruct')
    expect((screen.getByLabelText('Context size (tokens)') as HTMLInputElement).value).toBe('8192')
    expect(screen.getAllByText('Saved in Settings')).toHaveLength(1)
    expect(screen.getAllByText('From the environment')).toHaveLength(9)
  })

  it('saves crop settings as numbers and warns that cached documents are not re-read until the version changes', async () => {
    const requests = await open(view, [['PUT', PATH, () => json(200, view)]])
    expect(screen.queryByText(/Crop changes only affect documents that are not already extracted/)).toBeNull()

    fireEvent.change(screen.getByLabelText('Crop max width (px)'), { target: { value: '1600' } })
    fireEvent.change(screen.getByLabelText('Crop max height (px)'), { target: { value: '2200' } })
    expect(screen.getByText(/Crop changes only affect documents that are not already extracted/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Extraction version'), { target: { value: '2' } })
    expect(screen.queryByText(/Crop changes only affect documents that are not already extracted/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(requestsTo(requests, 'PUT', PATH)).toHaveLength(1))
    expect(requestsTo(requests, 'PUT', PATH)[0].json()).toEqual({ cropMaxWidth: 1600, cropMaxHeight: 2200, promptVersion: '2' })
  })

  it('refuses an out-of-range crop DPI', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Crop render DPI'), { target: { value: '9000' } })
    expect((screen.getByRole('button', { name: 'Save settings' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('A whole number from 72 to 600.')).toBeTruthy()
  })

  it('keeps Save disabled until something changes, then saves only the change', async () => {
    const requests = await open(view, [['PUT', PATH, () => json(200, view)]])
    const save = screen.getByRole('button', { name: 'Save settings' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Context size (tokens)'), { target: { value: '16384' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)

    await waitFor(() => expect(requestsTo(requests, 'PUT', PATH)).toHaveLength(1))
    expect(requestsTo(requests, 'PUT', PATH)[0].json()).toEqual({ numCtx: 16384 })
    expect(await screen.findByText('Saved. The next extraction run uses these settings.')).toBeTruthy()
  })

  it('refuses an out-of-range context size', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Context size (tokens)'), { target: { value: '12' } })
    expect((screen.getByRole('button', { name: 'Save settings' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/A whole number from 1,024/)).toBeTruthy()
  })

  it('resets a saved field back to the environment', async () => {
    const requests = await open(view, [['PUT', PATH, () => json(200, { ...view, saved: {}, effective: environment })]])
    fireEvent.click(screen.getByRole('button', { name: 'Reset Remote Ollama URL' }))
    await waitFor(() => expect(requestsTo(requests, 'PUT', PATH)).toHaveLength(1))
    expect(requestsTo(requests, 'PUT', PATH)[0].json()).toEqual({ remoteUrl: null })
  })

  it('tests the remote and reports a missing model', async () => {
    const requests = await open(view, [
      ['POST', `${PATH}/test`, () => json(200, { ok: true, url: REMOTE, version: '0.40.13', model: 'qwen3-vl:4b-instruct', hasModel: false, models: ['qwen3-vl:8b'] })],
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Test remote' }))
    expect(await screen.findByText(/is not installed on this server/)).toBeTruthy()
    expect(requestsTo(requests, 'POST', `${PATH}/test`)[0].json()).toEqual({ target: 'remote' })
  })
})

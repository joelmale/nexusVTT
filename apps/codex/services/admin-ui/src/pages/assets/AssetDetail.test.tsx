import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import AssetDetail from './AssetDetail'
import { LOGIN_PATH, browser, setCsrfToken } from '@/lib/api'
import type { AdminAsset } from '@/lib/assetsApi'
import { json, meWith, renderPage, requestsTo, stubFetch } from '@/test/utils'

const BASE = '/control-api/v1/assets/assets/adm-1'

function makeAsset(overrides: Partial<AdminAsset> = {}): AdminAsset {
  return {
    id: 'adm-1',
    origin: 'admin',
    status: 'active',
    version: 3,
    etag: '"adm-1:3"',
    name: 'Goblin token',
    category: 'tokens',
    tags: ['goblin'],
    attribution: null,
    license: 'CC-BY-4.0',
    source: 'admin-upload',
    sha256: 'a'.repeat(64),
    size: 2048,
    mimeType: 'image/png',
    dimensions: { width: 256, height: 256 },
    files: { original: 'blobs/aa/a.png', thumbnail: 'derivatives/v1/aa/a.webp' },
    publicUrls: null,
    derivative: null,
    provenance: {
      createdBy: 'editor@example.com',
      createdAt: '2026-09-20T10:00:00.000Z',
      originalFilename: 'goblin.png',
      sourceUrl: null,
      sourcePath: null,
      updatedBy: null,
      updatedAt: null,
    },
    quarantine: null,
    deletion: null,
    history: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.spyOn(browser, 'redirect').mockImplementation(() => {})
  vi.spyOn(browser, 'currentPath').mockReturnValue('/assets/adm-1')
})

afterEach(() => {
  cleanup()
  setCsrfToken(null)
})

const render = (role: Parameters<typeof meWith>[0] = 'platform_admin') =>
  renderPage(<AssetDetail />, { me: meWith(role), route: '/assets/adm-1', path: '/assets/:id' })

describe('asset metadata concurrency', () => {
  it('saves with the loaded version as expectedVersion and If-Match', async () => {
    const fetchMock = stubFetch([
      ['GET', BASE, () => json(200, { asset: makeAsset() })],
      ['PATCH', BASE, () => json(200, { asset: makeAsset({ version: 4, name: 'Goblin boss' }) })],
    ])
    render()
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Goblin boss' } })
    fireEvent.click(screen.getByText('Save metadata'))

    expect(await screen.findByText('Saved as version 4.')).toBeTruthy()
    const [patch] = requestsTo(fetchMock, 'PATCH', BASE)
    expect(patch.json()).toEqual({ name: 'Goblin boss', expectedVersion: 3 })
    expect(patch.headers.get('If-Match')).toBe('"adm-1:3"')
    expect(patch.headers.get('X-CSRF-Token')).toBe('csrf-test')
  })

  it('stops on 409 with a reload/merge prompt and never overwrites silently', async () => {
    const server = makeAsset({ version: 5, name: 'Goblin (renamed elsewhere)', tags: ['goblin', 'monster'] })
    const fetchMock = stubFetch([
      ['GET', BASE, () => json(200, { asset: makeAsset() })],
      [
        'PATCH',
        BASE,
        () =>
          json(409, {
            error: 'version-conflict',
            message: 'Asset was modified by another request',
            details: { assetId: 'adm-1', expectedVersion: 3, currentVersion: 5, asset: server },
          }),
      ],
    ])
    render()
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Goblin chief' } })
    fireEvent.click(screen.getByText('Save metadata'))

    const prompt = await screen.findByText(/Someone else changed this asset/)
    expect(prompt.textContent).toContain('now version 5')
    const table = prompt.closest('[role="alert"]') as HTMLElement
    expect(within(table).getByText('Goblin chief')).toBeTruthy()
    expect(within(table).getByText('Goblin (renamed elsewhere)')).toBeTruthy()
    // Exactly one write; the conflict is never retried automatically.
    expect(requestsTo(fetchMock, 'PATCH', BASE)).toHaveLength(1)
    expect((screen.getByText('Save metadata') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByText('Discard mine and reload'))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Goblin (renamed elsewhere)')
    expect((screen.getByLabelText(/Tags/) as HTMLInputElement).value).toBe('goblin, monster')
  })

  it('lets the user keep their values and save again on the current version', async () => {
    const server = makeAsset({ version: 5, license: 'OGL-1.0a' })
    let patches = 0
    const fetchMock = stubFetch([
      ['GET', BASE, () => json(200, { asset: makeAsset() })],
      [
        'PATCH',
        BASE,
        () => {
          patches += 1
          return patches === 1
            ? json(409, { error: 'version-conflict', message: 'stale', details: { asset: server } })
            : json(200, { asset: makeAsset({ version: 6, name: 'Goblin chief', license: 'OGL-1.0a' }) })
        },
      ],
    ])
    render()
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Goblin chief' } })
    fireEvent.click(screen.getByText('Save metadata'))
    fireEvent.click(await screen.findByText('Keep my changes on the current version'))

    fireEvent.click(screen.getByText('Save metadata'))
    expect(await screen.findByText('Saved as version 6.')).toBeTruthy()
    const second = requestsTo(fetchMock, 'PATCH', BASE)[1]
    expect(second.json()).toEqual({ name: 'Goblin chief', expectedVersion: 5 })
  })

  it('disables editing without assets:write', async () => {
    stubFetch([['GET', BASE, () => json(200, { asset: makeAsset() })]])
    render('auditor')
    expect(((await screen.findByLabelText('Name')) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByText('Regenerate') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Requires assets:delete/)).toBeTruthy()
    expect(screen.queryByText('Review deletion')).toBeNull()
  })
})

describe('asset delete flow', () => {
  const quarantined = makeAsset({
    status: 'quarantined',
    version: 7,
    quarantine: { at: '2026-09-24T09:00:00.000Z', by: 'admin@example.com' },
  })

  it('requires typed confirmation and handles reauth_required on permanent delete', async () => {
    const fetchMock = stubFetch([
      ['GET', BASE, () => json(200, { asset: quarantined })],
      [
        'POST',
        `${BASE}/delete-preview`,
        () =>
          json(200, {
            asset: quarantined,
            allowedActions: { quarantine: false, restore: true, permanentDelete: true },
            references: { campaignIds: ['camp-1'], count: 1 },
            sharedFiles: [],
            warnings: ['Referenced by 1 campaign(s); scenes using this asset will show a missing image.', 'Permanent deletion cannot be undone.'],
          }),
      ],
      ['POST', `${BASE}/permanent-delete`, () => json(401, { error: 'reauth_required' })],
    ])
    render()
    fireEvent.click(await screen.findByText('Review restore or permanent deletion'))

    const warnings = await screen.findByLabelText('Deletion warnings')
    expect(within(warnings).getByText('Permanent deletion cannot be undone.')).toBeTruthy()
    const button = screen.getByText('Permanently delete') as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/to permanently delete this asset/), { target: { value: 'adm-2' } })
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/to permanently delete this asset/), { target: { value: 'adm-1' } })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)

    await waitFor(() =>
      expect(browser.redirect).toHaveBeenCalledWith(`${LOGIN_PATH}?returnTo=${encodeURIComponent('/assets/adm-1')}`),
    )
    expect((await screen.findByText(/needs a fresh sign-in/)).textContent).toContain('Redirecting you to Google')
    const [request] = requestsTo(fetchMock, 'POST', `${BASE}/permanent-delete`)
    expect(request.json()).toEqual({ expectedVersion: 7, confirm: true })
  })

  it('requires acknowledging campaign references before quarantine', async () => {
    const fetchMock = stubFetch([
      ['GET', BASE, () => json(200, { asset: makeAsset() })],
      [
        'POST',
        `${BASE}/delete-preview`,
        () =>
          json(200, {
            asset: makeAsset(),
            allowedActions: { quarantine: true, restore: false, permanentDelete: false },
            references: { campaignIds: ['camp-1', 'camp-2'], count: 2 },
            sharedFiles: [],
            warnings: ['Referenced by 2 campaign(s); scenes using this asset will show a missing image.'],
          }),
      ],
      ['POST', `${BASE}/quarantine`, () => json(200, { asset: quarantined, movedFiles: [], retainedFiles: [] })],
    ])
    render()
    fireEvent.click(await screen.findByText('Review deletion'))
    const quarantine = (await screen.findByText('Quarantine')) as HTMLButtonElement
    expect(quarantine.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/scenes in these campaigns will show a missing image/))
    fireEvent.click(quarantine)

    expect(await screen.findByText(/Asset quarantined/)).toBeTruthy()
    const [request] = requestsTo(fetchMock, 'POST', `${BASE}/quarantine`)
    expect(request.json()).toEqual({ expectedVersion: 3, acknowledgeReferences: true })
  })
})

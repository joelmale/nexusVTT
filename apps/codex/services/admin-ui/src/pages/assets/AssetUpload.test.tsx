import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import AssetUpload from './AssetUpload'
import { setCsrfToken } from '@/lib/api'
import { ASSET_UPLOAD_MAX_BYTES } from '@/lib/assetsApi'
import { json, meWith, renderPage, requestsTo, stubFetch } from '@/test/utils'

const UPLOAD = '/control-api/v1/assets/assets'
const FACETS = '/control-api/v1/assets/facets'

afterEach(() => {
  cleanup()
  setCsrfToken(null)
})

function image(name = 'goblin.png', type = 'image/png', size?: number): File {
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type })
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size })
  return file
}

const asset = (id: string, name: string) => ({ id, name, status: 'active', version: 1 })

function fill(file: File) {
  fireEvent.change(screen.getByLabelText('Image'), { target: { files: [file] } })
  fireEvent.change(screen.getByLabelText('Category (required)'), { target: { value: 'tokens' } })
}

describe('AssetUpload', () => {
  it('uploads the file and metadata as multipart and links the new asset', async () => {
    const fetchMock = stubFetch([
      ['GET', FACETS, () => json(200, { categories: [{ name: 'tokens', count: 4 }], tags: [], statuses: {} })],
      ['POST', UPLOAD, () => json(201, { asset: asset('adm-9', 'Goblin'), duplicate: false })],
    ])
    renderPage(<AssetUpload />, { me: meWith('content_editor') })
    fill(image())
    fireEvent.change(screen.getByLabelText('Tags (comma separated)'), { target: { value: 'goblin, monster, goblin' } })
    fireEvent.click(screen.getByText('Upload'))

    const link = await screen.findByText('Goblin')
    expect(link.getAttribute('href')).toBe('/assets/adm-9')
    const [request] = requestsTo(fetchMock, 'POST', UPLOAD)
    const body = request.body as FormData
    expect(body.get('category')).toBe('tokens')
    expect(body.get('tags')).toBe(JSON.stringify(['goblin', 'monster']))
    expect((body.get('file') as File).name).toBe('goblin.png')
    expect(body.has('force')).toBe(false)
    expect(request.headers.get('X-CSRF-Token')).toBe('csrf-test')
    // The browser sets the multipart boundary.
    expect(request.headers.has('Content-Type')).toBe(false)
  })

  it('shows the duplicate-hash result instead of storing a copy', async () => {
    stubFetch([
      ['GET', FACETS, () => json(200, { categories: [], tags: [], statuses: {} })],
      ['POST', UPLOAD, () => json(200, { asset: asset('lib-42', 'Existing goblin'), duplicate: true, duplicateOf: 'lib-42' })],
    ])
    renderPage(<AssetUpload />, { me: meWith('content_editor') })
    fill(image())
    fireEvent.click(screen.getByText('Upload'))

    expect(await screen.findByText('Already in the library')).toBeTruthy()
    expect(screen.getByText(/Existing goblin \(lib-42\)/)).toBeTruthy()
    expect(screen.getByText(/Nothing new was stored/)).toBeTruthy()
  })

  it('rejects oversized and non-image files before uploading', async () => {
    const fetchMock = stubFetch([['GET', FACETS, () => json(200, { categories: [], tags: [], statuses: {} })]])
    renderPage(<AssetUpload />, { me: meWith('content_editor') })

    fill(image('huge.png', 'image/png', ASSET_UPLOAD_MAX_BYTES + 1))
    expect((await screen.findByRole('alert')).textContent).toMatch(/the limit is 25 MB/)
    expect((screen.getByText('Upload') as HTMLButtonElement).disabled).toBe(true)

    fill(image('vector.svg', 'image/svg+xml'))
    expect(screen.getByRole('alert').textContent).toMatch(/only PNG, JPEG and WebP/)
    expect((screen.getByText('Upload') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByText('Upload'))
    expect(requestsTo(fetchMock, 'POST', UPLOAD)).toHaveLength(0)
  })

  it('surfaces server-side rejections', async () => {
    stubFetch([
      ['GET', FACETS, () => json(200, { categories: [], tags: [], statuses: {} })],
      ['POST', UPLOAD, () => json(415, { error: 'unsupported-media-type', message: 'Only PNG, JPEG and WebP images are accepted' })],
    ])
    renderPage(<AssetUpload />, { me: meWith('platform_admin') })
    fill(image())
    fireEvent.click(screen.getByText('Upload'))
    expect((await screen.findByRole('alert')).textContent).toContain('Only PNG, JPEG and WebP images are accepted')
  })

  it('disables upload without assets:write', () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { categories: [], tags: [], statuses: {} })))
    renderPage(<AssetUpload />, { me: meWith('operator') })
    fill(image())
    const button = screen.getByText('Upload') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('Requires assets:write')
  })
})

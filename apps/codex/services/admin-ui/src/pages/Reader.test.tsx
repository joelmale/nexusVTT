import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import Reader from './Reader'
import { setCsrfToken } from '@/lib/api'
import { json, meWith, renderPage, stubFetch } from '@/test/utils'

afterEach(() => {
  cleanup()
  setCsrfToken(null)
})

describe('Reader page images', () => {
  it('loads page images same-origin through control-api, never from object storage', async () => {
    stubFetch([
      [
        'GET',
        '/control-api/v1/codex/documents/doc-1/page-images',
        () =>
          json(200, {
            documentId: 'doc-1',
            title: 'Monster Manual',
            count: 2,
            pages: [
              { key: 'pages/doc-1/page-1.png', url: 'http://minio:9000/bucket/page-1.png?X-Amz-Signature=x', pageNumber: 1 },
              { key: 'pages/doc-1/cover.png', url: 'http://minio:9000/bucket/cover.png', pageNumber: null },
            ],
          }),
      ],
      ['GET', '/control-api/v1/codex/documents/doc-1/annotations', () => json(200, { annotations: [] })],
      ['GET', '/control-api/v1/codex/references', () => json(200, { references: [] })],
    ])
    renderPage(<Reader />, { me: meWith('content_editor'), route: '/reader/doc-1', path: '/reader/:id' })

    const first = (await screen.findByAltText('Page 1')) as HTMLImageElement
    expect(first.getAttribute('src')).toBe('/control-api/v1/codex/documents/doc-1/pages/1/image')
    const second = screen.getByAltText('Page 2') as HTMLImageElement
    expect(second.getAttribute('src')).toBe('/control-api/v1/codex/documents/doc-1/pages/2/image')
    for (const img of document.querySelectorAll('img')) {
      expect(img.getAttribute('src')).not.toMatch(/minio|X-Amz/)
    }
  })
})

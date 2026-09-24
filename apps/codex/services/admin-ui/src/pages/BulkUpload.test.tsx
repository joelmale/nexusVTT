import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import BulkUpload from './BulkUpload'
import { setCsrfToken } from '@/lib/api'
import { DOCUMENT_UPLOAD_MAX_BYTES } from '@/lib/codexUpload'
import { json, meWith, renderPage, requestsTo, stubFetch } from '@/test/utils'

const UPLOAD = '/control-api/v1/codex/documents/upload'

afterEach(() => {
  cleanup()
  setCsrfToken(null)
})

function doc(name: string, size?: number): File {
  const file = new File(['%PDF-1.7'], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'text/markdown' })
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('BulkUpload', () => {
  it('uploads each file through control-api multipart with its metadata', async () => {
    const fetchMock = stubFetch([
      [
        'POST',
        UPLOAD,
        (request) => {
          const title = (request.body as FormData).get('title')
          return json(201, { document: { id: `doc-${title}`, title, status: 'queued' } })
        },
      ],
    ])
    renderPage(<BulkUpload />, { me: meWith('content_editor') })
    fireEvent.change(screen.getByLabelText('Documents to upload'), {
      target: { files: [doc('Players Handbook.pdf'), doc('notes.md')] },
    })
    fireEvent.change(screen.getAllByPlaceholderText('Description')[0], { target: { value: 'Core rules' } })
    fireEvent.click(screen.getByText('Upload Files'))

    expect(await screen.findByText('2 Successful')).toBeTruthy()
    expect(screen.getAllByTestId('upload-result')).toHaveLength(2)

    const requests = requestsTo(fetchMock, 'POST', UPLOAD)
    expect(requests).toHaveLength(2)
    const first = requests[0].body as FormData
    expect(first.get('title')).toBe('Players Handbook')
    expect(first.get('description')).toBe('Core rules')
    expect(first.get('type')).toBe('rulebook')
    expect(first.get('format')).toBe('pdf')
    expect(first.get('tags')).toBe('[]')
    expect((first.get('file') as File).name).toBe('Players Handbook.pdf')
    expect((requests[1].body as FormData).get('format')).toBe('markdown')
    expect(requests[0].headers.get('X-CSRF-Token')).toBe('csrf-test')
    // Nothing is sent anywhere but control-api (no pre-signed object-storage URL).
    for (const [url] of fetchMock.mock.calls) expect(String(url).startsWith('/control-api/v1/')).toBe(true)
  })

  it('keeps failed files for retry and reports the server error', async () => {
    stubFetch([
      [
        'POST',
        UPLOAD,
        (request) =>
          (request.body as FormData).get('title') === 'bad'
            ? json(422, { error: 'unsupported_document', requestId: 'req-7' })
            : json(201, { document: { id: 'doc-1', title: 'good' } }),
      ],
    ])
    renderPage(<BulkUpload />, { me: meWith('platform_admin') })
    fireEvent.change(screen.getByLabelText('Documents to upload'), { target: { files: [doc('good.pdf'), doc('bad.pdf')] } })
    fireEvent.click(screen.getByText('Upload Files'))

    expect(await screen.findByText('1 Failed')).toBeTruthy()
    expect(screen.getByText(/unsupported_document/)).toBeTruthy()
    expect(screen.getByText('Files to Upload (1)')).toBeTruthy()
    expect(screen.getAllByText('bad.pdf')).toHaveLength(2) // retry list and result row
    expect(screen.queryByText('good.pdf')).toBeNull()
  })

  it('rejects oversized and unsupported files before uploading', () => {
    const fetchMock = stubFetch([])
    renderPage(<BulkUpload />, { me: meWith('content_editor') })
    fireEvent.change(screen.getByLabelText('Documents to upload'), {
      target: { files: [doc('huge.pdf', DOCUMENT_UPLOAD_MAX_BYTES + 1)] },
    })
    expect(screen.getByRole('alert').textContent).toMatch(/the limit is 200 MB/)
    const upload = screen.getByText('Upload Files') as HTMLButtonElement
    expect(upload.disabled).toBe(true)

    fireEvent.click(screen.getByText('Remove'))
    fireEvent.change(screen.getByLabelText('Documents to upload'), { target: { files: [doc('image.png')] } })
    expect(screen.getByRole('alert').textContent).toMatch(/only PDF and Markdown/)
    fireEvent.click(upload)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('disables uploading without codex:write', () => {
    stubFetch([])
    renderPage(<BulkUpload />, { me: meWith('auditor') })
    fireEvent.change(screen.getByLabelText('Documents to upload'), { target: { files: [doc('a.pdf')] } })
    const upload = screen.getByText('Upload Files') as HTMLButtonElement
    expect(upload.disabled).toBe(true)
    expect(upload.title).toBe('Requires codex:write')
  })
})

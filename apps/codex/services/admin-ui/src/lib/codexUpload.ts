/**
 * Codex document upload through control-api. The file bytes go to
 * `POST /control-api/v1/codex/documents/upload` as multipart; control-api
 * stores them and queues processing, so the browser never needs a pre-signed
 * object-storage URL (the admin CSP allows `connect-src 'self'` only).
 */
import { CODEX_API_BASE, controlJson } from './api'
import { formatBytes } from './assetsApi'

export const CODEX_UPLOAD_PATH = `${CODEX_API_BASE}/documents/upload`

/** The gateway allows one extra MiB for multipart framing and metadata. */
export const DOCUMENT_UPLOAD_MAX_BYTES = 320 * 1024 * 1024
export const DOCUMENT_UPLOAD_ACCEPT = '.pdf,.md,.markdown'
const DOCUMENT_EXTENSIONS = ['pdf', 'md', 'markdown']

export interface DocumentUploadFields {
  title: string
  description?: string
  type: string
  tags?: string[]
  campaigns?: string[]
  collections?: string[]
}

export interface UploadedDocument {
  id: string
  title: string
  status?: string
}

/** Why a file cannot be uploaded, or null when it passes the client-side hints. */
export function documentUploadProblem(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!DOCUMENT_EXTENSIONS.includes(extension)) {
    return `${file.name}: only PDF and Markdown files can be uploaded.`
  }
  if (file.size === 0) return `${file.name} is empty.`
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)}.`
  }
  return null
}

export function documentFormat(fileName: string): 'pdf' | 'markdown' {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension === 'md' || extension === 'markdown' ? 'markdown' : 'pdf'
}

export async function codexUploadDocument(file: File, fields: DocumentUploadFields): Promise<UploadedDocument> {
  const form = new FormData()
  form.append('title', fields.title)
  if (fields.description) form.append('description', fields.description)
  form.append('type', fields.type)
  form.append('format', documentFormat(file.name))
  form.append('tags', JSON.stringify(fields.tags ?? []))
  form.append('campaigns', JSON.stringify(fields.campaigns ?? []))
  form.append('collections', JSON.stringify(fields.collections ?? []))
  // The file goes last so the metadata is known before the bytes stream in.
  form.append('file', file, file.name)
  const body = await controlJson<{ document?: UploadedDocument; documents?: UploadedDocument[] } & Partial<UploadedDocument>>(CODEX_UPLOAD_PATH, {
    method: 'POST',
    body: form,
  })
  const document = body?.document ?? body?.documents?.[0] ?? (body?.id ? (body as UploadedDocument) : undefined)
  if (!document) throw new Error('Upload succeeded but the response did not describe the document')
  return document
}

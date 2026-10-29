import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { codexFetch, codexUrl } from '@/lib/api'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { useQuery } from '@tanstack/react-query'
import Processing from './Processing'
import Deduplication from './Deduplication'
import DataQuality from './DataQuality'
import { DocumentUploadZone } from '@/components/documents/DocumentUploadZone'
import { Upload, ChevronUp } from 'lucide-react'

interface Document {
  id: string
  title: string
  type: string
  format: string
  status: string
  fileSize: number
  uploadedAt: string
  thumbnailKey?: string
  tags: string[]
  processingSummary?: {
    textLength: number
    textCharsPerPage?: number
    textSample?: string
    ocrDetected?: boolean
    ocrPerformed?: boolean
    ocrStatus?: string
    isIndexed?: boolean
    pageImagesCount?: number
    pageImagesTotalBytes?: number
  }
}

interface DocumentsResponse {
  documents: Document[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type DocumentTab = 'catalog' | 'processing' | 'duplicates' | 'quality'

export default function Documents() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as DocumentTab) || 'catalog'
  const [uploadOpen, setUploadOpen] = useState(searchParams.get('upload') === 'open')

  const canEdit = useCan('editDocument')
  const canReprocess = useCan('reprocessDocument')
  const canDelete = useCan('deleteDocument')
  const canUpload = useCan('uploadDocuments')

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  // Live stats for Queue badge
  const { data: queueStats } = useQuery<{ active?: number; waiting?: number }>({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const response = await codexFetch('/api/admin/queue/stats')
      if (!response.ok) return { active: 0, waiting: 0 }
      return response.json()
    },
    refetchInterval: 10000,
  })

  const { data, isLoading, error, refetch } = useQuery<DocumentsResponse>({
    queryKey: ['documents', page, status, type, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(status && { status }),
        ...(type && { type }),
        ...(search && { search }),
      })
      const response = await codexFetch(`/api/admin/documents?${params}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      return response.json()
    },
    enabled: activeTab === 'catalog',
  })

  const handleSelectTab = (tab: DocumentTab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'catalog') {
      next.delete('tab')
    } else {
      next.set('tab', tab)
    }
    setSearchParams(next)
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      indexed: 'bg-blue-100 text-blue-800',
    } as const

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatTextLength = (length?: number) => {
    if (!length) return 'none'
    if (length < 1000) return `${length} chars`
    return `${(length / 1000).toFixed(1)}k chars`
  }

  const getTextQualityBadge = (length?: number) => {
    if (!length) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">no text</span>
    }
    if (length < 200) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">low text</span>
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">ok</span>
  }

  const getIndexBadge = (indexed?: boolean) => {
    if (indexed) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">indexed</span>
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">missing</span>
  }

  const getOcrBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">ocr ok</span>
      case 'processing':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">ocr running</span>
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">ocr pending</span>
      case 'failed':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">ocr failed</span>
      case 'not_required':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">ocr n/a</span>
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">ocr unknown</span>
    }
  }

  const formatLabel = (format: string) => {
    return format.toUpperCase()
  }

  const handleView = (doc: Document) => {
    window.open(codexUrl(`/api/documents/${encodeURIComponent(doc.id)}/content`), '_blank')
  }

  const handleReader = (doc: Document) => {
    window.open(`${import.meta.env.BASE_URL}reader/${encodeURIComponent(doc.id)}`, '_blank')
  }

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc)
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }

    setDeletingDocId(docId)
    try {
      const response = await codexFetch(`/api/admin/documents/${docId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete document')
      }

      refetch()
      alert('Document deleted successfully')
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete document')
    } finally {
      setDeletingDocId(null)
    }
  }

  const handleReprocess = async (docId: string) => {
    try {
      const response = await codexFetch(`/api/admin/documents/${docId}/reprocess`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to reprocess document')
      }

      alert('Document reprocessing queued successfully')
      refetch()
    } catch (error) {
      console.error('Reprocess error:', error)
      alert('Failed to reprocess document')
    }
  }

  const activeJobCount = (queueStats?.active ?? 0) + (queueStats?.waiting ?? 0)

  return (
    <div className="p-6">
      {/* Sub-view navigation tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          type="button"
          onClick={() => handleSelectTab('catalog')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
            activeTab === 'catalog'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span>All Documents</span>
          {data?.pagination?.total !== undefined && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-semibold">
              {data.pagination.total}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSelectTab('processing')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
            activeTab === 'processing'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span>Queue & Processing</span>
          {activeJobCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              {activeJobCount} active
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSelectTab('duplicates')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'duplicates'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Duplicates
        </button>
        <button
          type="button"
          onClick={() => handleSelectTab('quality')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'quality'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Quality Audit
        </button>
      </div>

      {/* Embedded Sub-views */}
      {activeTab === 'processing' && <Processing embedded />}
      {activeTab === 'duplicates' && <Deduplication />}
      {activeTab === 'quality' && <DataQuality />}

      {/* Main Catalog View */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Document Catalog</h1>
              <p className="text-sm text-gray-500 mt-1">
                Browse, search, edit, inspect, and bulk upload rulebooks and notes.
              </p>
            </div>
            {canUpload && (
              <button
                onClick={() => setUploadOpen((prev) => !prev)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2 text-sm font-medium shadow-sm transition"
              >
                {uploadOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Upload
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Documents
                  </>
                )}
              </button>
            )}
          </div>

          {/* Collapsible Bulk Upload Drawer */}
          {uploadOpen && (
            <DocumentUploadZone
              onUploaded={() => {
                refetch()
              }}
              onClose={() => setUploadOpen(false)}
            />
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              Error loading documents: {error.message}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All statuses</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="indexed">Indexed</option>
              </select>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All types</option>
                <option value="rulebook">Rulebook</option>
                <option value="campaign_note">Campaign Note</option>
                <option value="handout">Handout</option>
                <option value="map">Map</option>
                <option value="character_sheet">Character Sheet</option>
                <option value="homebrew">Homebrew</option>
              </select>
              <button
                onClick={() => {
                  setSearch('')
                  setStatus('')
                  setType('')
                  setPage(1)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">
                Documents ({data?.pagination.total || 0})
              </h3>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading documents...</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Formats & Size
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Text
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Search
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Uploaded
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data?.documents.map((doc) => (
                          <tr key={doc.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {doc.title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {doc.type.replace('_', ' ')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(doc.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {formatLabel(doc.format)}
                                  </span>
                                  <span>{formatFileSize(doc.fileSize)}</span>
                                </div>
                                {doc.processingSummary?.pageImagesCount ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      WEBP x{doc.processingSummary.pageImagesCount}
                                    </span>
                                    <span>
                                      {formatFileSize(doc.processingSummary.pageImagesTotalBytes || 0)}
                                      {doc.processingSummary?.pageImagesTotalBytes
                                        ? ` (${Math.round((doc.processingSummary.pageImagesTotalBytes / doc.fileSize) * 100)}%)`
                                        : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400">No page images</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                {getTextQualityBadge(doc.processingSummary?.textLength)}
                                <span>{formatTextLength(doc.processingSummary?.textLength)}</span>
                                {getOcrBadge(doc.processingSummary?.ocrStatus)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {getIndexBadge(doc.processingSummary?.isIndexed)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(doc)}
                                  disabled={!canEdit}
                                  title={canEdit ? undefined : permissionHint('editDocument')}
                                  className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleView(doc)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleReader(doc)}
                                  className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                                  disabled={!doc.processingSummary?.pageImagesCount}
                                >
                                  Reader
                                </button>
                                <button
                                  onClick={() => handleReprocess(doc.id)}
                                  disabled={!canReprocess}
                                  className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                                  title={canReprocess ? 'Reprocess document' : permissionHint('reprocessDocument')}
                                >
                                  Reprocess
                                </button>
                                <button
                                  onClick={() => handleDelete(doc.id)}
                                  disabled={!canDelete || deletingDocId === doc.id}
                                  title={canDelete ? undefined : permissionHint('deleteDocument')}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  {deletingDocId === doc.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {data && data.pagination.totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {page} of {data.pagination.totalPages}
                      </span>
                      <button
                        disabled={page === data.pagination.totalPages}
                        onClick={() => setPage(page + 1)}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Edit Document</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const updates = {
                  title: formData.get('title'),
                  type: formData.get('type'),
                  tags: (formData.get('tags') as string).split(',').map((t) => t.trim()).filter(Boolean),
                }

                try {
                  const response = await codexFetch(`/api/admin/documents/${editingDoc.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates),
                  })

                  if (!response.ok) throw new Error('Failed to update document')

                  alert('Document updated successfully')
                  setEditingDoc(null)
                  refetch()
                } catch (error) {
                  console.error('Update error:', error)
                  alert('Failed to update document')
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    name="title"
                    defaultValue={editingDoc.title}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    name="type"
                    defaultValue={editingDoc.type}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="rulebook">Rulebook</option>
                    <option value="campaign_note">Campaign Note</option>
                    <option value="handout">Handout</option>
                    <option value="map">Map</option>
                    <option value="character_sheet">Character Sheet</option>
                    <option value="homebrew">Homebrew</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                  <input
                    name="tags"
                    defaultValue={editingDoc.tags.join(', ')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="dnd5e, monsters, spells"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

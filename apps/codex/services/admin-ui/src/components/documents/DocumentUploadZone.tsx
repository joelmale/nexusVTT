import { useState, useCallback, useId } from 'react'
import { codexUploadDocument, DOCUMENT_UPLOAD_ACCEPT, DOCUMENT_UPLOAD_MAX_BYTES, documentUploadProblem } from '@/lib/codexUpload'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { errorText } from '@/lib/ui'
import { formatBytes } from '@/lib/assetsApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, File, CheckCircle, XCircle, Trash2, X } from 'lucide-react'

export interface UploadFileItem {
  file: File
  title: string
  description: string
  type: string
  tags: string[]
  campaigns: string[]
  collections: string[]
}

export interface UploadOutcome {
  fileName: string
  success: boolean
  document?: { id: string; title: string; status?: string }
  error?: string
}

export interface DocumentUploadZoneProps {
  onUploaded?: () => void
  onClose?: () => void
}

export function DocumentUploadZone({ onUploaded, onClose }: DocumentUploadZoneProps) {
  const canUpload = useCan('uploadDocuments')
  const [files, setFiles] = useState<UploadFileItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<UploadOutcome[] | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputId = useId()

  const addFiles = useCallback((incomingFiles: File[]) => {
    const newItems: UploadFileItem[] = incomingFiles.map((file) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ''),
      description: '',
      type: 'rulebook',
      tags: [],
      campaigns: [],
      collections: [],
    }))
    setFiles((prev) => [...prev, ...newItems])
    setUploadResults(null)
  }, [])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    addFiles(selected)
    event.target.value = ''
  }, [addFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }, [addFiles])

  const updateFile = (index: number, updates: Partial<UploadFileItem>) => {
    setFiles((prev) => prev.map((file, i) => (i === index ? { ...file, ...updates } : file)))
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const problems = files.map((file) => documentUploadProblem(file.file))
  const hasProblems = problems.some(Boolean)

  const handleUploadFiles = async () => {
    if (files.length === 0 || hasProblems) return

    setIsUploading(true)
    setUploadProgress(0)
    const outcomes: UploadOutcome[] = []
    const failedFiles: UploadFileItem[] = []

    for (const [index, file] of files.entries()) {
      try {
        const document = await codexUploadDocument(file.file, {
          title: file.title,
          description: file.description,
          type: file.type,
          tags: file.tags,
          campaigns: file.campaigns,
          collections: file.collections,
        })
        outcomes.push({ fileName: file.file.name, success: true, document })
      } catch (error) {
        outcomes.push({ fileName: file.file.name, success: false, error: errorText(error) })
        failedFiles.push(file)
      }
      setUploadProgress(((index + 1) / files.length) * 100)
    }

    setUploadResults(outcomes)
    setFiles(failedFiles)
    setIsUploading(false)
    if (outcomes.some((o) => o.success)) {
      onUploaded?.()
    }
  }

  const successful = uploadResults?.filter((result) => result.success).length ?? 0
  const failed = (uploadResults?.length ?? 0) - successful

  return (
    <Card className="border-indigo-100 bg-indigo-50/20 dark:border-indigo-950 dark:bg-slate-900/60 shadow-md">
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Drag and drop or select PDF and Markdown rulebooks, adventures, or notes (up to {formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)} each).
          </CardDescription>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            aria-label="Close upload panel"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30'
              : 'border-gray-300 hover:border-gray-400 dark:border-slate-700 bg-white dark:bg-slate-800'
          }`}
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          <input
            id={fileInputId}
            type="file"
            multiple
            accept={DOCUMENT_UPLOAD_ACCEPT}
            aria-label="Documents to upload"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
          <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Drop PDF or Markdown files here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Batch upload with automated Ingestion v2 pipeline processing</p>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100">
            <div className="flex justify-between text-xs font-medium">
              <span>Uploading & Queuing Processing...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Upload Results banner */}
        {uploadResults && (
          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 space-y-2">
            <div className="flex items-center gap-3 text-xs font-medium">
              {successful > 0 && (
                <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" /> {successful} uploaded & queued
                </span>
              )}
              {failed > 0 && (
                <span className="flex items-center gap-1 text-red-700 dark:text-red-400">
                  <XCircle className="h-4 w-4" /> {failed} failed
                </span>
              )}
            </div>
            {uploadResults.map((result, i) => (
              <div key={i} className="text-xs flex items-center justify-between text-gray-600 dark:text-slate-400">
                <span>{result.fileName}</span>
                {result.success ? (
                  <span className="text-green-600 font-mono">queued</span>
                ) : (
                  <span className="text-red-500">{result.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Staged Files list */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                Staged Files ({files.length})
              </h4>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFiles([])}
                  disabled={isUploading}
                >
                  Clear All
                </Button>
                <Button
                  size="sm"
                  onClick={handleUploadFiles}
                  disabled={!canUpload || files.length === 0 || hasProblems || isUploading}
                  title={canUpload ? undefined : permissionHint('uploadDocuments')}
                >
                  {isUploading ? 'Uploading...' : `Upload ${files.length} ${files.length === 1 ? 'File' : 'Files'}`}
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {files.map((file, index) => {
                const problem = problems[index]
                return (
                  <div
                    key={index}
                    className="border rounded-md p-3 bg-white dark:bg-slate-800 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span className="text-xs font-semibold truncate text-gray-800 dark:text-slate-200">
                          {file.file.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {formatBytes(file.file.size)}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                        className="text-gray-400 hover:text-red-600 p-1 rounded"
                        title="Remove file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {problem ? (
                      <p className="text-xs text-red-600 font-medium">{problem}</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Title</label>
                          <Input
                            value={file.title}
                            onChange={(e) => updateFile(index, { title: e.target.value })}
                            disabled={isUploading}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Type</label>
                          <select
                            value={file.type}
                            onChange={(e) => updateFile(index, { type: e.target.value })}
                            disabled={isUploading}
                            className="h-7 w-full text-xs rounded border border-gray-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900"
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
                          <label className="block text-[10px] text-gray-500 mb-0.5">Tags (comma-separated)</label>
                          <Input
                            value={file.tags.join(', ')}
                            onChange={(e) =>
                              updateFile(index, {
                                tags: e.target.value
                                  .split(',')
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              })
                            }
                            disabled={isUploading}
                            placeholder="core, 5e, monsters"
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


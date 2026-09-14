import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { AlertTriangle, CheckCircle, FileX, Database, Search } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

interface ValidationResult {
  orphanedFiles: {
    orphanedDocuments: Array<{
      id: string
      title: string
      storageKey: string
      uploadedAt: string
      issue: string
    }>
    total: number
  }
  metadataInconsistencies: {
    inconsistentDocuments: Array<{
      id: string
      title: string
      issues: string[]
    }>
    total: number
  }
  elasticIssues: {
    elasticIssues: Array<{
      id: string
      title: string
      issue: string
      searchIndex?: string
      error?: string
    }>
    total: number
  }
  summary: {
    totalOrphaned: number
    totalMetadataIssues: number
    totalElasticIssues: number
    totalIssues: number
  }
}

interface ProcessingSummary {
  totalDocuments: number
  processed: number
  processing: number
  pending: number
  failed: number
  indexed: number
  withText: number
  noText: number
  lowText: number
  ocrPending: number
  ocrFailed: number
  lowTextThreshold: number
  recentIssues: Array<{
    id: string
    title: string
    issue: string
    textLength: number
  }>
}

interface ProcessingIssue {
  id: string
  documentId: string
  title: string
  type: string
  severity: 'error' | 'warning'
  description: string
  textLength: number
  ocrStatus: string
  indexed: boolean
}

interface ProcessingIssuesResponse {
  issues: ProcessingIssue[]
  total: number
  summary: {
    errors: number
    warnings: number
  }
  byType: Record<string, number>
}

interface SearchCheckResult {
  documentId: string
  query: string
  total: number
  hits: Array<{
    documentId: string
    score: number
    source: Record<string, unknown>
    highlights?: Record<string, string[]>
  }>
}

export default function DataQuality() {
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingSummary, setProcessingSummary] = useState<ProcessingSummary | null>(null)
  const [processingIssues, setProcessingIssues] = useState<ProcessingIssuesResponse | null>(null)
  const [searchDocId, setSearchDocId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<SearchCheckResult | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const runValidation = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/validation/comprehensive`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to run validation')
      }

      setValidation(data)
      await Promise.all([loadProcessingSummary(), loadProcessingIssues()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadProcessingSummary = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/processing/summary`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to load processing summary')
      }
      setProcessingSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const loadProcessingIssues = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/processing/issues`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to load processing issues')
      }
      setProcessingIssues(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  useEffect(() => {
    runValidation()
    loadProcessingSummary()
    loadProcessingIssues()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getSeverityColor = (count: number) => {
    if (count === 0) return 'text-green-600'
    if (count < 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSeverityBadge = (count: number) => {
    if (count === 0) return <Badge variant="default" className="bg-green-100 text-green-800">Good</Badge>
    if (count < 5) return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Warning</Badge>
    return <Badge variant="default" className="bg-red-100 text-red-800">Critical</Badge>
  }

  const handleSearchCheck = async () => {
    if (!searchDocId || !searchQuery) return
    setSearchLoading(true)
    setSearchResult(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/processing/search-check/${searchDocId}?q=${encodeURIComponent(searchQuery)}`
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to run search check')
      }
      setSearchResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSearchLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Data Quality Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          Phase 3: Search & Deduplication
        </Badge>
      </div>

      {/* Summary Cards */}
      {validation && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orphaned Files</CardTitle>
              <FileX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getSeverityColor(validation.summary.totalOrphaned)}`}>
                {validation.summary.totalOrphaned}
              </div>
              <p className="text-xs text-muted-foreground">
                Files missing from storage
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Metadata Issues</CardTitle>
              <Database className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getSeverityColor(validation.summary.totalMetadataIssues)}`}>
                {validation.summary.totalMetadataIssues}
              </div>
              <p className="text-xs text-muted-foreground">
                Inconsistent document data
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Search Index Issues</CardTitle>
              <Search className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getSeverityColor(validation.summary.totalElasticIssues)}`}>
                {validation.summary.totalElasticIssues}
              </div>
              <p className="text-xs text-muted-foreground">
                ElasticSearch inconsistencies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
              {validation.summary.totalIssues === 0 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getSeverityBadge(validation.summary.totalIssues)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total data quality issues
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Processing Quality Summary */}
      {processingSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents With Text</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {processingSummary.withText}
              </div>
              <p className="text-xs text-muted-foreground">
                {processingSummary.noText} without extracted text
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Text Volume</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {processingSummary.lowText}
              </div>
              <p className="text-xs text-muted-foreground">
                Under {processingSummary.lowTextThreshold} characters
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Indexed Documents</CardTitle>
              <Search className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {processingSummary.indexed}
              </div>
              <p className="text-xs text-muted-foreground">
                Searchable in ElasticSearch
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">OCR Pending</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {processingSummary.ocrPending}
              </div>
              <p className="text-xs text-muted-foreground">
                OCR not completed
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-red-600">
              <strong>Error:</strong> {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Data quality validation checks for orphaned files, metadata inconsistencies, and search index issues.
          Run validation regularly to maintain data integrity.
        </p>
        <Button onClick={runValidation} disabled={loading}>
          {loading ? 'Running Validation...' : 'Run Validation'}
        </Button>
      </div>

      {/* Processing Issues */}
      {processingIssues && processingIssues.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Processing Quality Issues ({processingIssues.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Text Length</TableHead>
                  <TableHead>Indexed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processingIssues.issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">{issue.title}</TableCell>
                    <TableCell>{issue.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={issue.severity === 'error' ? 'text-red-600' : 'text-yellow-600'}>
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{issue.textLength}</TableCell>
                    <TableCell>
                      {issue.indexed ? (
                        <Badge variant="outline" className="text-green-600">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">No</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Searchability Probe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Searchability Probe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Document ID"
              value={searchDocId}
              onChange={(e) => setSearchDocId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Query (e.g., fireball)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleSearchCheck} disabled={searchLoading || !searchDocId || !searchQuery}>
              {searchLoading ? 'Checking...' : 'Run Check'}
            </Button>
          </div>

          {searchResult && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                Results: {searchResult.total} hits
              </div>
              {searchResult.hits.map((hit, index) => (
                <div key={`${hit.documentId}-${index}`} className="border rounded-md p-3 text-sm">
                  {hit.highlights?.content?.map((fragment, fragmentIndex) => (
                    <div key={`${hit.documentId}-${fragmentIndex}`} dangerouslySetInnerHTML={{ __html: fragment }} />
                  ))}
                  {!hit.highlights?.content && <div>No highlighted snippet available.</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orphaned Files */}
      {validation && validation.orphanedFiles.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileX className="h-5 w-5 text-red-500" />
              Orphaned Files ({validation.orphanedFiles.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Storage Key</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validation.orphanedFiles.orphanedDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell className="font-mono text-sm">{doc.storageKey}</TableCell>
                    <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{doc.issue}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Metadata Issues */}
      {validation && validation.metadataInconsistencies.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-500" />
              Metadata Inconsistencies ({validation.metadataInconsistencies.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validation.metadataInconsistencies.inconsistentDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {doc.issues.map((issue, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ElasticSearch Issues */}
      {validation && validation.elasticIssues.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-500" />
              Search Index Issues ({validation.elasticIssues.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validation.elasticIssues.elasticIssues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">{issue.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{issue.issue}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {issue.searchIndex || issue.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No Issues */}
      {validation && validation.summary.totalIssues === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">All Systems Healthy</h3>
              <p className="text-gray-600">
                No data quality issues found. Your document library is in excellent condition.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

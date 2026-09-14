 import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

interface SearchResult {
  documentId: string
  score: number
  source: {
    title: string
    description: string
    type: string
    uploadedBy: string
    uploadedAt: string
    fileSize: number
    tags: string[]
    campaigns: string[]
  }
  highlights: {
    title?: string[]
    description?: string[]
    content?: string[]
  }
}

interface SearchResponse {
  query: string
  total: number
  from: number
  size: number
  sortBy: string
  sortOrder: string
  results: SearchResult[]
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Advanced filters
  const [type, setType] = useState('')
  const [uploadedBy, setUploadedBy] = useState('')
  const [uploadedAfter, setUploadedAfter] = useState('')
  const [uploadedBefore, setUploadedBefore] = useState('')
  const [sortBy, setSortBy] = useState('relevance')
  const [sortOrder, setSortOrder] = useState('desc')
   const [from, setFrom] = useState(0)
   const [size] = useState(20)

  const performSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        sortBy,
        sortOrder,
        from: from.toString(),
        size: size.toString(),
      })

      if (type) params.append('type', type)
      if (uploadedBy) params.append('uploadedBy', uploadedBy)
      if (uploadedAfter) params.append('uploadedAfter', uploadedAfter)
      if (uploadedBefore) params.append('uploadedBefore', uploadedBefore)

      const response = await fetch(`/api/search/advanced?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Search failed')
      }

      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFrom(0) // Reset pagination
    performSearch()
  }

  const handlePageChange = (newFrom: number) => {
    setFrom(newFrom)
    // Trigger search with new pagination
    setTimeout(performSearch, 0)
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const highlightText = (text: string, highlights: string[]) => {
    if (!highlights || highlights.length === 0) return text

    let highlightedText = text
    highlights.forEach(highlight => {
      const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>')
    })

    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Advanced Search</h1>
        <Badge variant="outline" className="text-sm">
          Phase 3: Search & Deduplication
        </Badge>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Search Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium mb-1">Search Query</label>
                <Input
                  type="text"
                  placeholder="Enter search terms..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Document Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rulebook">Rulebook</SelectItem>
                    <SelectItem value="adventure">Adventure</SelectItem>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="map">Map</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Uploaded By</label>
                <Input
                  type="text"
                  placeholder="Username"
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Uploaded After</label>
                <Input
                  type="date"
                  value={uploadedAfter}
                  onChange={(e) => setUploadedAfter(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Uploaded Before</label>
                <Input
                  type="date"
                  value={uploadedBefore}
                  onChange={(e) => setUploadedBefore(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="uploadedAt">Upload Date</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="fileSize">File Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Order</label>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setType('')
                  setUploadedBy('')
                  setUploadedAfter('')
                  setUploadedBefore('')
                  setSortBy('relevance')
                  setSortOrder('desc')
                  setResults(null)
                  setError(null)
                }}
              >
                Clear Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>
              Search Results ({results.total} found)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.results.length === 0 ? (
              <p className="text-gray-500">No documents found matching your search criteria.</p>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>File Size</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.results.map((result) => (
                      <TableRow key={result.documentId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {result.highlights.title ?
                                highlightText(result.source.title, result.highlights.title) :
                                result.source.title
                              }
                            </div>
                            {result.highlights.content && result.highlights.content[0] && (
                              <div className="text-sm text-gray-600 mt-1">
                                {highlightText(result.highlights.content[0], [query])}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.source.type}</Badge>
                        </TableCell>
                        <TableCell>{result.source.uploadedBy}</TableCell>
                        <TableCell>{formatDate(result.source.uploadedAt)}</TableCell>
                        <TableCell>{formatFileSize(result.source.fileSize)}</TableCell>
                        <TableCell>{result.score.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {results.total > results.size && (
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Showing {results.from + 1} to {Math.min(results.from + results.size, results.total)} of {results.total} results
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={results.from === 0}
                        onClick={() => handlePageChange(Math.max(0, results.from - results.size))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={results.from + results.size >= results.total}
                        onClick={() => handlePageChange(results.from + results.size)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { AlertTriangle, CheckCircle, Merge } from 'lucide-react'

interface DuplicateGroup {
  hash: string
  documents: Array<{
    id: string
    title: string
    uploadedAt: string
    uploadedBy: string
  }>
}

interface DuplicatesResponse {
  duplicates: DuplicateGroup[]
  totalGroups: number
  totalDocuments: number
}

export default function Deduplication() {
  const [duplicates, setDuplicates] = useState<DuplicatesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [merging, setMerging] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchDuplicates = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/deduplication/duplicates')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to fetch duplicates')
      }

      setDuplicates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const mergeDuplicates = async (primaryId: string, duplicateIds: string[]) => {
    setMerging(primaryId)
    setError(null)

    try {
      const response = await fetch('/api/deduplication/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryId,
          duplicateIds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to merge duplicates')
      }

      // Refresh duplicates after merge
      await fetchDuplicates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setMerging(null)
    }
  }

  useEffect(() => {
    fetchDuplicates()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Document Deduplication</h1>
        <Badge variant="outline" className="text-sm">
          Phase 3: Search & Deduplication
        </Badge>
      </div>

      {/* Summary Stats */}
      {duplicates && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duplicate Groups</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{duplicates.totalGroups}</div>
              <p className="text-xs text-muted-foreground">
                Groups of identical documents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Duplicates</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{duplicates.totalDocuments}</div>
              <p className="text-xs text-muted-foreground">
                Documents with duplicates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Space Saved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {duplicates.totalGroups > 0 ? duplicates.totalGroups - 1 : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Potential documents to remove
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
          Duplicate detection is based on SHA-256 content hashing. Documents with identical content are grouped together.
        </p>
        <Button onClick={fetchDuplicates} disabled={loading}>
          {loading ? 'Scanning...' : 'Refresh Duplicates'}
        </Button>
      </div>

      {/* Duplicate Groups */}
      {duplicates && duplicates.duplicates.length > 0 ? (
        <div className="space-y-4">
          {duplicates.duplicates.map((group) => (
            <Card key={group.hash}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Duplicate Group ({group.documents.length} documents)
                  <Badge variant="outline" className="text-xs">
                    Hash: {group.hash.substring(0, 16)}...
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.documents.map((doc, index) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>{doc.uploadedBy}</TableCell>
                        <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
                        <TableCell>
                          {index === 0 ? (
                            <Badge variant="default">Primary</Badge>
                          ) : (
                            <Badge variant="secondary">Duplicate</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {index > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => mergeDuplicates(group.documents[0].id, [doc.id])}
                              disabled={merging === group.documents[0].id}
                            >
                              <Merge className="h-4 w-4 mr-1" />
                              {merging === group.documents[0].id ? 'Merging...' : 'Merge'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {group.documents.length > 2 && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => mergeDuplicates(
                        group.documents[0].id,
                        group.documents.slice(1).map(d => d.id)
                      )}
                      disabled={merging === group.documents[0].id}
                    >
                      <Merge className="h-4 w-4 mr-1" />
                      {merging === group.documents[0].id ? 'Merging All...' : 'Merge All Duplicates'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Duplicates Found</h3>
              <p className="text-gray-600">
                All documents in the system have unique content. Duplicate detection runs automatically when new documents are uploaded.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

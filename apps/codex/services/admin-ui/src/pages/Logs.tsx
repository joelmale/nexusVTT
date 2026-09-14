import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'

interface LogEntry {
  id: string
  '@timestamp': string
  level: string
  service: string
  message: string
  meta?: Record<string, unknown>
  requestId?: string
}

export default function Logs() {
  const [service, setService] = useState('')
  const [level, setLevel] = useState('')
  const [query, setQuery] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (service) params.append('service', service)
      if (level) params.append('level', level)
      if (query) params.append('q', query)

      const response = await fetch(`/api/admin/logs?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch logs')
      }
      setLogs(data.hits || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const levelBadge = (value: string) => {
    const styles: Record<string, string> = {
      debug: 'bg-gray-100 text-gray-700',
      info: 'bg-blue-100 text-blue-700',
      warn: 'bg-yellow-100 text-yellow-700',
      error: 'bg-red-100 text-red-700',
      critical: 'bg-red-200 text-red-800',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[value] || 'bg-gray-100 text-gray-700'}`}>
        {value}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Logs</h1>
        <Button onClick={fetchLogs} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">All services</option>
            <option value="doc-api">doc-api</option>
            <option value="doc-processor">doc-processor</option>
            <option value="doc-websocket">doc-websocket</option>
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">All levels</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
            <option value="critical">critical</option>
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search message"
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <Button onClick={fetchLogs} disabled={loading}>
            Apply
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6 text-red-600">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Recent Logs</h3>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(log['@timestamp']).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{log.service}</td>
                      <td className="px-4 py-2 text-sm">{levelBadge(log.level)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

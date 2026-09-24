import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import Operations from './Operations'
import { json, meWith, renderPage, requestsTo, stubFetch } from '@/test/utils'

const SUMMARY_PATH = '/control-api/v1/operations/summary'

const summary = {
  generatedAt: '2026-09-24T10:00:00.000Z',
  services: [
    { name: 'vtt-backend', status: 'up' },
    { name: 'doc-processor', status: 'unknown' },
    { name: 'asset-service', status: 'degraded', detail: 'manifest stale' },
    { name: 'redis', status: 'down' },
    { name: 'mystery', status: 'exploded' },
  ],
  metrics: { activeRooms: 3, commitP95Ms: 41.6, assetManifestAgeSeconds: 7200 },
  alerts: [{ name: 'NexusPlatformRedisDown', severity: 'critical', since: '2026-09-24T09:55:00.000Z' }],
  links: {
    grafana: 'https://grafana.internal.example/d/nexus',
    runbooks: [
      { title: 'Observability runbook', url: 'https://docs.example/observability' },
      { title: 'Bad link', url: 'javascript:alert(1)' },
    ],
  },
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function stubOps(body: unknown = summary) {
  return stubFetch([
    ['GET', SUMMARY_PATH, () => json(200, body)],
    ['GET', '/control-api/v1/codex/admin/alerts', () => json(200, [])],
  ])
}

describe('Operations', () => {
  it('renders service tiles, including unknown and unexpected states', async () => {
    stubOps()
    renderPage(<Operations />, { me: meWith('auditor') })

    const tiles = await screen.findByLabelText('Service status')
    expect(within(screen.getByTestId('service-vtt-backend')).getByText('Up')).toBeTruthy()
    expect(within(screen.getByTestId('service-doc-processor')).getByText('Unknown')).toBeTruthy()
    expect(within(screen.getByTestId('service-doc-processor')).getByText('No data from monitoring.')).toBeTruthy()
    expect(within(screen.getByTestId('service-asset-service')).getByText('Degraded')).toBeTruthy()
    expect(within(screen.getByTestId('service-asset-service')).getByText('manifest stale')).toBeTruthy()
    expect(within(screen.getByTestId('service-redis')).getByText('Down')).toBeTruthy()
    // A status outside the contract is shown as unknown, never as healthy.
    expect(within(screen.getByTestId('service-mystery')).getByText('Unknown')).toBeTruthy()
    expect(within(tiles).getAllByRole('listitem')).toHaveLength(5)
  })

  it('shows only the metrics the summary reports, with no placeholder numbers', async () => {
    stubOps()
    renderPage(<Operations />, { me: meWith('auditor') })

    expect((await screen.findByTestId('metric-activeRooms')).textContent).toContain('3')
    expect(screen.getByTestId('metric-commitP95Ms').textContent).toContain('42 ms')
    expect(screen.getByTestId('metric-assetManifestAgeSeconds').textContent).toContain('2.0h')
    expect(screen.queryByTestId('metric-websocketConnections')).toBeNull()
    expect(screen.queryByTestId('metric-codexQueueWaiting')).toBeNull()
    expect(screen.queryByTestId('metric-codexQueueFailed')).toBeNull()
    expect(screen.queryByText(/Requests\/min|Avg Response Time|Error Rate|Slow Queries/)).toBeNull()
  })

  it('handles an all-unknown summary without inventing data', async () => {
    stubOps({
      generatedAt: '2026-09-24T10:00:00.000Z',
      services: [{ name: 'prometheus', status: 'unknown' }],
      metrics: {},
      alerts: [],
      links: { grafana: null, runbooks: [] },
    })
    renderPage(<Operations />, { me: meWith('operator') })

    expect(await screen.findByText('Monitoring reported no metrics.')).toBeTruthy()
    expect(screen.getByText('No alerts are firing.')).toBeTruthy()
    expect(screen.getByText('Grafana link not configured.')).toBeTruthy()
    expect(within(screen.getByTestId('service-prometheus')).getByText('Unknown')).toBeTruthy()
  })

  it('lists firing alerts and only safe links', async () => {
    stubOps()
    renderPage(<Operations />, { me: meWith('auditor') })

    const alerts = await screen.findByLabelText('Firing alerts')
    expect(within(alerts).getByText('NexusPlatformRedisDown')).toBeTruthy()
    expect(within(alerts).getByText('critical')).toBeTruthy()
    expect(screen.getByText('Grafana dashboards').getAttribute('href')).toBe('https://grafana.internal.example/d/nexus')
    expect(screen.getByText('Observability runbook').getAttribute('href')).toBe('https://docs.example/observability')
    expect(screen.queryByText('Bad link')).toBeNull()
  })

  it('refreshes the summary every 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubOps()
    renderPage(<Operations />, { me: meWith('auditor') })
    await screen.findByLabelText('Service status')
    expect(requestsTo(fetchMock, 'GET', SUMMARY_PATH)).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', SUMMARY_PATH)).toHaveLength(2))
  })

  it('shows an error instead of stale numbers when the summary fails', async () => {
    stubFetch([
      ['GET', SUMMARY_PATH, () => json(503, { error: 'prometheus_unavailable', requestId: 'req-9' })],
      ['GET', '/control-api/v1/codex/admin/alerts', () => json(200, [])],
    ])
    renderPage(<Operations />, { me: meWith('auditor') })
    expect((await screen.findByRole('alert')).textContent).toContain('req-9')
    expect(screen.queryByLabelText('Service status')).toBeNull()
  })
})

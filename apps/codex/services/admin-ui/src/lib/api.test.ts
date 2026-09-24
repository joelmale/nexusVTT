import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import {
  ApiError,
  FORBIDDEN_MESSAGE,
  LOGIN_PATH,
  browser,
  codexFetch,
  codexUrl,
  controlFetch,
  loadMe,
  logout,
  onPermissionDenied,
  setCsrfToken,
} from './api'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

let fetchMock: Mock<typeof fetch>
let redirect: MockInstance<(url: string) => void>

const lastRequest = () => {
  const [url, init = {}] = fetchMock.mock.calls.at(-1)!
  return { url, init, headers: new Headers(init.headers) }
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async () => json(200, { ok: true }))
  vi.stubGlobal('fetch', fetchMock)
  redirect = vi.spyOn(browser, 'redirect').mockImplementation(() => {})
  vi.spyOn(browser, 'currentPath').mockReturnValue('/documents?page=2')
  setCsrfToken(null)
})

afterEach(() => {
  setCsrfToken(null)
})

describe('codexUrl', () => {
  it.each([
    ['/api/admin/stats', '/control-api/v1/codex/admin/stats'],
    ['/api/admin/documents?page=1&limit=50', '/control-api/v1/codex/admin/documents?page=1&limit=50'],
    ['/api/documents/bulk', '/control-api/v1/codex/documents/bulk'],
    ['/api/references', '/control-api/v1/codex/references'],
    ['/api/search/quick?query=a%20b', '/control-api/v1/codex/search/quick?query=a%20b'],
  ])('maps %s to %s', (apiPath, expected) => {
    expect(codexUrl(apiPath)).toBe(expected)
  })

  it.each([
    '/api',
    '/api/',
    '/apifoo/x',
    'api/admin/stats',
    '/control-api/v1/me',
    'http://doc-api:3000/api/admin/stats',
    '/api/documents/../../me',
    '/api/documents/%2e%2e/%2E%2E/me',
    '/api/documents/./x',
  ])('rejects %s', (apiPath) => {
    expect(() => codexUrl(apiPath)).toThrow()
  })
})

describe('controlFetch', () => {
  it('sends same-origin credentials and no CSRF header on GET', async () => {
    setCsrfToken('token-1')
    await codexFetch('/api/admin/stats')
    const { url, init, headers } = lastRequest()
    expect(url).toBe('/control-api/v1/codex/admin/stats')
    expect(init.credentials).toBe('same-origin')
    expect(init.method).toBe('GET')
    expect(headers.has('X-CSRF-Token')).toBe(false)
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])('sends X-CSRF-Token on %s', async (method) => {
    setCsrfToken('token-1')
    await codexFetch('/api/admin/documents/abc', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const { init, headers } = lastRequest()
    expect(init.method).toBe(method.toUpperCase())
    expect(init.credentials).toBe('same-origin')
    expect(headers.get('X-CSRF-Token')).toBe('token-1')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('leaves the multipart boundary to the browser for FormData bodies', async () => {
    setCsrfToken('token-1')
    const body = new FormData()
    body.append('file', new Blob(['x']), 'x.pdf')
    await codexFetch('/api/documents/bulk', { method: 'POST', body })
    const { init, headers } = lastRequest()
    expect(init.body).toBe(body)
    expect(headers.has('Content-Type')).toBe(false)
    expect(headers.get('X-CSRF-Token')).toBe('token-1')
  })

  it('refuses targets outside /control-api/v1/', async () => {
    await expect(controlFetch('/api/admin/stats')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redirects to login on a plain 401', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthenticated' }))
    const error = await codexFetch('/api/admin/stats').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(redirect).toHaveBeenCalledWith(LOGIN_PATH)
  })

  it('redirects to login on a 401 without a JSON body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 401 }))
    await expect(codexFetch('/api/admin/stats')).rejects.toBeInstanceOf(ApiError)
    expect(redirect).toHaveBeenCalledWith(LOGIN_PATH)
  })

  it('re-authenticates with a return path on reauth_required', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'reauth_required' }))
    const error = (await codexFetch('/api/admin/documents/abc', { method: 'DELETE' }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error.code).toBe('reauth_required')
    expect(redirect).toHaveBeenCalledWith(
      `${LOGIN_PATH}?returnTo=${encodeURIComponent('/documents?page=2')}`,
    )
  })

  it('reports a 403 to permission listeners and throws without redirecting', async () => {
    const listener = vi.fn()
    const unsubscribe = onPermissionDenied(listener)
    fetchMock.mockResolvedValueOnce(json(403, { error: 'forbidden', requestId: 'req-1' }))

    const error = (await codexFetch('/api/admin/queue/clean', { method: 'POST' }).catch(
      (e: unknown) => e,
    )) as ApiError
    unsubscribe()

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.message).toBe(FORBIDDEN_MESSAGE)
    expect(error.requestId).toBe('req-1')
    expect(listener).toHaveBeenCalledWith(FORBIDDEN_MESSAGE)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('returns other responses to the caller unchanged', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { error: 'not_found' }))
    const response = await codexFetch('/api/admin/documents/missing')
    expect(response.status).toBe(404)
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('session helpers', () => {
  it('loadMe stores the CSRF token for later writes', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        user: { id: 'u1', email: 'a@example.com' },
        roles: ['platform_admin'],
        permissions: ['codex:read'],
        csrfToken: 'csrf-from-me',
        recentAuthUntil: null,
      }),
    )
    const me = await loadMe()
    expect(me.user.email).toBe('a@example.com')
    expect(lastRequest().url).toBe('/control-api/v1/me')

    await codexFetch('/api/admin/documents/abc/reprocess', { method: 'POST' })
    expect(lastRequest().headers.get('X-CSRF-Token')).toBe('csrf-from-me')
  })

  it('logout posts with the CSRF token and then forgets it', async () => {
    setCsrfToken('token-1')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await logout()
    const { url, init, headers } = lastRequest()
    expect(url).toBe('/control-api/v1/auth/logout')
    expect(init.method).toBe('POST')
    expect(headers.get('X-CSRF-Token')).toBe('token-1')

    await codexFetch('/api/admin/queue/clean', { method: 'POST' })
    expect(lastRequest().headers.has('X-CSRF-Token')).toBe(false)
  })

  it('logout treats an expired session as signed out and does not redirect', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthenticated' }))
    await expect(logout()).resolves.toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })
})

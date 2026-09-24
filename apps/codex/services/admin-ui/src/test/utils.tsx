import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, type Mock } from 'vitest'
import { AuthContext } from '@/auth/AuthContext'
import { setCsrfToken, type Me, type Permission } from '@/lib/api'

/** Role → permission table from the control-plane plan (control-api is authoritative). */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  platform_admin: [
    'codex:read',
    'codex:write',
    'codex:delete',
    'codex:maintain',
    'codex:operate',
    'ops:read',
    'assets:read',
    'assets:write',
    'assets:delete',
    'rules:read',
    'rules:write',
    'rules:publish',
    'audit:read',
    'admins:manage',
  ],
  content_editor: ['codex:read', 'codex:write', 'rules:read', 'rules:write', 'assets:read', 'assets:write'],
  operator: ['codex:read', 'codex:operate', 'ops:read', 'assets:read', 'audit:read'],
  auditor: ['codex:read', 'ops:read', 'rules:read', 'assets:read', 'audit:read'],
}

export function meWith(role: keyof typeof ROLE_PERMISSIONS, overrides: Partial<Me> = {}): Me {
  return {
    user: { id: `user-${role}`, email: `${role}@example.com`, displayName: role },
    roles: [role],
    permissions: ROLE_PERMISSIONS[role],
    csrfToken: 'csrf-test',
    recentAuthUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
    ...overrides,
  }
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

export interface RecordedRequest {
  method: string
  url: string
  headers: Headers
  body: BodyInit | null | undefined
  json: () => unknown
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>

/**
 * `fetch` stub routing by method and path (query string ignored unless the
 * pattern contains `?`). Unmatched requests fail the test loudly.
 */
export function stubFetch(routes: Array<[string, string | RegExp, Handler]>): Mock<typeof fetch> {
  const mock = vi.fn<typeof fetch>(async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init.method ?? 'GET').toUpperCase()
    const request: RecordedRequest = {
      method,
      url,
      headers: new Headers(init.headers),
      body: init.body,
      json: () => JSON.parse(String(init.body)),
    }
    for (const [routeMethod, pattern, handler] of routes) {
      if (routeMethod !== method) continue
      const target = typeof pattern === 'string' && !pattern.includes('?') ? url.split('?')[0] : url
      if (typeof pattern === 'string' ? target === pattern : pattern.test(target)) return handler(request)
    }
    throw new Error(`Unexpected request: ${method} ${url}`)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

export function requestsTo(mock: Mock<typeof fetch>, method: string, path: string | RegExp): RecordedRequest[] {
  return mock.mock.calls
    .map(([input, init = {}]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      return {
        method: (init.method ?? 'GET').toUpperCase(),
        url,
        headers: new Headers(init.headers),
        body: init.body,
        json: () => JSON.parse(String(init.body)),
      }
    })
    .filter(
      (request) =>
        request.method === method &&
        (typeof path === 'string' ? request.url.split('?')[0] === path : path.test(request.url)),
    )
}

export function renderPage(
  element: ReactElement,
  { me, route = '/', path = '/' }: { me: Me; route?: string; path?: string },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  setCsrfToken(me.csrfToken)
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ me, signOut: async () => {} }}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={element} />
            <Route path="*" element={<p>other route</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

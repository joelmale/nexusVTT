/**
 * The Admin UI's only HTTP client.
 *
 * Every request goes to control-api on the same origin (see
 * apps/docs/platform/control-api-adr.md). Codex calls keep their doc-api path
 * in the code (`/api/admin/stats`) and are mapped here to the control-api
 * allowlist (`/control-api/v1/codex/admin/stats`), so no page ever talks to
 * doc-api directly.
 *
 * - Cookies are sent only to the same origin (`credentials: 'same-origin'`).
 * - Every non-GET/HEAD request carries `X-CSRF-Token` from `GET /me`.
 * - `401 {"error":"reauth_required"}` sends the browser to Google again and
 *   back to the current page; any other `401` sends it to the login flow.
 * - `403` tells the permission listeners (the auth gate shows a banner) and
 *   throws, so callers never treat a denial as data.
 *
 * Permission checks in the UI are hints only; control-api decides.
 */

export const CONTROL_API_BASE = '/control-api/v1'
export const CODEX_API_BASE = `${CONTROL_API_BASE}/codex`
export const LOGIN_PATH = `${CONTROL_API_BASE}/auth/login`
export const LOGOUT_PATH = `${CONTROL_API_BASE}/auth/logout`
export const ME_PATH = `${CONTROL_API_BASE}/me`

export const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action.'
export const UNAUTHENTICATED_MESSAGE = 'Your admin session has ended. Redirecting to sign in...'

export type Permission =
  | 'codex:read'
  | 'codex:write'
  | 'codex:delete'
  | 'codex:maintain'
  | 'audit:read'
  | 'admins:manage'

export interface Me {
  user: {
    id: string
    email: string
    name?: string | null
    displayName?: string | null
  }
  roles: string[]
  permissions: string[]
  csrfToken: string
  recentAuthUntil: string | null
  sessionExpiresAt?: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestId?: string

  constructor(status: number, message: string, code?: string, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

/** Browser side effects, replaceable in tests. */
export const browser = {
  redirect(url: string) {
    window.location.assign(url)
  },
  currentPath() {
    const { pathname, search, hash } = window.location
    return `${pathname}${search}${hash}`
  },
}

let csrfToken: string | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

type PermissionListener = (message: string) => void
const permissionListeners = new Set<PermissionListener>()

/** Subscribe to 403 responses. Returns the unsubscribe function. */
export function onPermissionDenied(listener: PermissionListener): () => void {
  permissionListeners.add(listener)
  return () => {
    permissionListeners.delete(listener)
  }
}

/** Login URL; `returnTo` must be a same-origin path. */
export function loginUrl(returnTo?: string): string {
  if (!returnTo) return LOGIN_PATH
  return `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`
}

// A `.`/`..` segment (also percent-encoded) would be resolved by the browser
// and could move a request out of /control-api/v1/codex/.
const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i

/**
 * Map a doc-api path (`/api/X?query`) to its control-api route
 * (`/control-api/v1/codex/X?query`).
 */
export function codexUrl(apiPath: string): string {
  const match = /^\/api(\/[^?#]*)(\?[^#]*)?$/.exec(apiPath)
  if (!match || match[1] === '/') {
    throw new Error(`Codex calls must use a doc-api path under /api/: ${apiPath}`)
  }
  const [, path, query = ''] = match
  if (path.split('/').some((segment) => DOT_SEGMENT.test(segment))) {
    throw new Error(`Codex path must not contain dot segments: ${apiPath}`)
  }
  return `${CODEX_API_BASE}${path}${query}`
}

const SAFE_METHODS = new Set(['GET', 'HEAD'])

export interface ControlFetchOptions {
  /** Default true. Sign-out turns it off so an expired session cannot loop. */
  redirectOnUnauthorized?: boolean
}

async function readError(response: Response): Promise<{ code?: string; requestId?: string }> {
  try {
    const body = (await response.clone().json()) as { error?: unknown; requestId?: unknown }
    return {
      code: typeof body.error === 'string' ? body.error : undefined,
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    }
  } catch {
    return {}
  }
}

/** Fetch a control-api path (`/control-api/v1/...`). */
export async function controlFetch(
  path: string,
  init: RequestInit = {},
  { redirectOnUnauthorized = true }: ControlFetchOptions = {},
): Promise<Response> {
  if (!path.startsWith(`${CONTROL_API_BASE}/`)) {
    throw new Error(`Admin UI requests must target ${CONTROL_API_BASE}/: ${path}`)
  }

  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
  })

  if (response.status === 401) {
    const { code, requestId } = await readError(response)
    if (redirectOnUnauthorized) {
      browser.redirect(code === 'reauth_required' ? loginUrl(browser.currentPath()) : LOGIN_PATH)
    }
    throw new ApiError(401, UNAUTHENTICATED_MESSAGE, code, requestId)
  }

  if (response.status === 403) {
    const { code, requestId } = await readError(response)
    for (const listener of permissionListeners) listener(FORBIDDEN_MESSAGE)
    throw new ApiError(403, FORBIDDEN_MESSAGE, code, requestId)
  }

  return response
}

/** Drop-in replacement for `fetch('/api/...')` against doc-api. */
export function codexFetch(apiPath: string, init?: RequestInit): Promise<Response> {
  return controlFetch(codexUrl(apiPath), init)
}

/** Load the signed-in administrator and remember the CSRF token. */
export async function loadMe(): Promise<Me> {
  const response = await controlFetch(ME_PATH)
  if (!response.ok) {
    const { code, requestId } = await readError(response)
    throw new ApiError(response.status, 'Failed to load your admin session', code, requestId)
  }
  const me = (await response.json()) as Me
  setCsrfToken(me.csrfToken)
  return me
}

/** End the admin session. Never redirects: the caller shows a signed-out page. */
export async function logout(): Promise<void> {
  try {
    const response = await controlFetch(
      LOGOUT_PATH,
      { method: 'POST' },
      { redirectOnUnauthorized: false },
    )
    if (!response.ok) {
      throw new ApiError(response.status, 'Sign out failed')
    }
  } catch (error) {
    // An already-expired session is signed out as far as the user is concerned.
    if (!(error instanceof ApiError && error.status === 401)) throw error
  }
  setCsrfToken(null)
}

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AuthGate from './AuthGate'
import { useCan } from './AuthContext'
import UserMenu from '@/components/UserMenu'
import { LOGIN_PATH, browser, codexFetch, setCsrfToken, type Me } from '@/lib/api'

const ME: Me = {
  user: { id: 'user-1', email: 'editor@example.com', displayName: 'Ed Itor' },
  roles: ['content_editor'],
  permissions: ['codex:read', 'codex:write'],
  csrfToken: 'csrf-1',
  recentAuthUntil: null,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

function Actions() {
  const canEdit = useCan('editDocument')
  const canDelete = useCan('deleteDocument')
  return (
    <div>
      <button disabled={!canEdit}>Edit</button>
      <button disabled={!canDelete}>Delete</button>
    </div>
  )
}

let fetchMock: Mock<typeof fetch>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async () => json(200, ME))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(browser, 'redirect').mockImplementation(() => {})
  vi.spyOn(browser, 'currentPath').mockReturnValue('/')
})

afterEach(() => {
  cleanup()
  setCsrfToken(null)
})

describe('AuthGate', () => {
  it('loads /me before rendering and shows the administrator and roles', async () => {
    render(
      <AuthGate>
        <UserMenu />
        <p>admin content</p>
      </AuthGate>,
    )
    expect(screen.queryByText('admin content')).toBeNull()

    expect(await screen.findByText('admin content')).toBeTruthy()
    expect(screen.getByTestId('admin-user').textContent).toBe('Ed Itor')
    expect(screen.getByTestId('admin-roles').textContent).toBe('content_editor')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/control-api/v1/me')
    expect(init?.credentials).toBe('same-origin')
  })

  it('redirects to login without rendering children when there is no session', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthenticated' }))
    render(
      <AuthGate>
        <p>admin content</p>
      </AuthGate>,
    )
    expect(await screen.findByText('Redirecting to sign in...')).toBeTruthy()
    expect(browser.redirect).toHaveBeenCalledWith(LOGIN_PATH)
    expect(screen.queryByText('admin content')).toBeNull()
  })

  it('shows a no-access page when the account has no admin role', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { error: 'forbidden' }))
    render(
      <AuthGate>
        <p>admin content</p>
      </AuthGate>,
    )
    expect(await screen.findByText('No admin access')).toBeTruthy()
    expect(screen.queryByText('admin content')).toBeNull()
    expect(browser.redirect).not.toHaveBeenCalled()
  })

  it('offers a retry when control-api is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(json(503, { error: 'unavailable' }))
    render(
      <AuthGate>
        <p>admin content</p>
      </AuthGate>,
    )
    fireEvent.click(await screen.findByText('Retry'))
    expect(await screen.findByText('admin content')).toBeTruthy()
  })

  it('disables actions the administrator lacks permission for', async () => {
    render(
      <AuthGate>
        <Actions />
      </AuthGate>,
    )
    const edit = (await screen.findByText('Edit')) as HTMLButtonElement
    const remove = screen.getByText('Delete') as HTMLButtonElement
    expect(edit.disabled).toBe(false)
    expect(remove.disabled).toBe(true)
  })

  it('signs out with the CSRF token and does not re-enter the login flow', async () => {
    render(
      <AuthGate>
        <UserMenu />
      </AuthGate>,
    )
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    fireEvent.click(await screen.findByText('Sign out'))

    expect(await screen.findByText('You have signed out')).toBeTruthy()
    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(url).toBe('/control-api/v1/auth/logout')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-1')
    expect(browser.redirect).not.toHaveBeenCalled()
    expect(screen.getByText('Sign in again').getAttribute('href')).toBe(LOGIN_PATH)
  })

  it('shows a permission banner when a request is denied', async () => {
    render(
      <AuthGate>
        <p>admin content</p>
      </AuthGate>,
    )
    await screen.findByText('admin content')

    fetchMock.mockResolvedValueOnce(json(403, { error: 'forbidden' }))
    await act(async () => {
      await codexFetch('/api/admin/documents/abc', { method: 'DELETE' }).catch(() => {})
    })

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'You do not have permission to perform this action.',
      ),
    )
    fireEvent.click(screen.getByText('Dismiss'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

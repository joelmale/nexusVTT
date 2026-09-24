import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import Layout from './Layout'
import { RequirePermission } from './common'
import { meWith, renderPage } from '@/test/utils'

afterEach(() => cleanup())

function mainNavLabels() {
  const nav = screen.getByRole('navigation', { name: 'Main' })
  const bar = nav.querySelector('.sm\\:flex') as HTMLElement
  return within(bar)
    .getAllByRole('link')
    .map((link) => link.textContent)
}

describe('navigation by role', () => {
  it.each([
    ['platform_admin', ['Documents', 'Rules', 'Assets', 'Operations', 'Audit', 'Administrators']],
    ['content_editor', ['Documents', 'Rules', 'Assets']],
    ['operator', ['Documents', 'Assets', 'Operations', 'Audit']],
    ['auditor', ['Documents', 'Rules', 'Assets', 'Operations', 'Audit']],
  ] as const)('%s sees %j', (role, expected) => {
    renderPage(
      <Layout>
        <p>content</p>
      </Layout>,
      { me: meWith(role) },
    )
    expect(mainNavLabels()).toEqual(expected)
  })

  it('hides asset upload from roles without assets:write', () => {
    renderPage(
      <Layout>
        <p>content</p>
      </Layout>,
      { me: meWith('operator'), route: '/assets', path: '/assets' },
    )
    const subnav = screen.getByLabelText('Assets pages')
    expect(within(subnav).queryByText('Upload')).toBeNull()
    expect(within(subnav).getByText('Jobs and integrity')).toBeTruthy()
  })
})

describe('RequirePermission', () => {
  it('renders nothing of the page and fetches nothing without the permission', () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    renderPage(
      <RequirePermission action="viewOperations">
        <p>secret operations</p>
      </RequirePermission>,
      { me: meWith('content_editor') },
    )
    expect(screen.queryByText('secret operations')).toBeNull()
    expect(screen.getByText('You do not have access to this page.')).toBeTruthy()
    expect(screen.getByText('Requires ops:read.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the page with the permission', () => {
    renderPage(
      <RequirePermission action="viewOperations">
        <p>secret operations</p>
      </RequirePermission>,
      { me: meWith('operator') },
    )
    expect(screen.getByText('secret operations')).toBeTruthy()
  })
})

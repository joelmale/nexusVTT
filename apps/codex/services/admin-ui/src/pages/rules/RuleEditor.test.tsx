import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { RulesEntityDetail, RulesRevision } from '@nexus/rules-contracts'
import { fireball2014 } from '../../../../../../../packages/rules-contracts/src/fixtures'
import RuleEditor from './RuleEditor'
import { LOGIN_PATH, browser, setCsrfToken } from '@/lib/api'
import { json, meWith, renderPage, requestsTo, stubFetch } from '@/test/utils'

const ID = '11111111-1111-4111-8111-111111111111'
const BASE = `/control-api/v1/rules/entities/${ID}`

function revision(number: number, status: RulesRevision['status'], data: unknown = fireball2014): RulesRevision {
  return {
    id: `rev-${number}`,
    revisionNumber: number,
    status,
    schemaVersion: 1,
    sourceDocumentId: null,
    sourceLicense: 'CC-BY-4.0',
    createdBy: 'editor@example.com',
    createdAt: '2026-09-24T09:00:00.000Z',
    publishedBy: status === 'published' ? 'admin@example.com' : null,
    publishedAt: status === 'published' ? '2026-09-24T09:30:00.000Z' : null,
    supersededAt: null,
    catalogVersion: status === 'published' ? 7 : null,
    restoredFromRevisionNumber: null,
    data,
  }
}

function entity(head: RulesRevision, overrides: Partial<RulesEntityDetail> = {}): RulesEntityDetail {
  const { data: _data, ...summary } = head
  void _data
  return {
    id: ID,
    entityType: 'spell',
    ruleset: '2014',
    slug: 'fireball',
    name: 'Fireball',
    schemaVersion: 1,
    currentPublishedRevisionId: null,
    headRevisionNumber: head.revisionNumber,
    headStatus: head.status,
    createdAt: '2026-09-24T08:00:00.000Z',
    archivedAt: null,
    head,
    currentPublished: null,
    revisions: [summary],
    ...overrides,
  }
}

beforeEach(() => {
  vi.spyOn(browser, 'redirect').mockImplementation(() => {})
  vi.spyOn(browser, 'currentPath').mockReturnValue(`/rules/${ID}`)
})

afterEach(() => {
  cleanup()
  setCsrfToken(null)
})

const render = (role: Parameters<typeof meWith>[0] = 'platform_admin') =>
  renderPage(<RuleEditor />, { me: meWith(role), route: `/rules/${ID}`, path: '/rules/:id' })

describe('rules draft concurrency', () => {
  it('saves with the expected revision and shows the server head on 409', async () => {
    const serverHead = revision(3, 'draft', { ...fireball2014, level: 4, name: 'Fireball' })
    let gets = 0
    const fetchMock = stubFetch([
      [
        'GET',
        BASE,
        () => {
          gets += 1
          return json(200, gets === 1 ? entity(revision(2, 'draft')) : entity(serverHead))
        },
      ],
      [
        'PUT',
        `${BASE}/draft`,
        () =>
          json(409, {
            error: 'expected revision 2 but the entity head is revision 3',
            code: 'revision_conflict',
            current: serverHead,
          }),
      ],
    ])
    render()
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Fireball!' } })
    fireEvent.click(screen.getByText('Save draft'))

    const alert = await screen.findByText(/Revision 3 \(draft\) by editor@example.com/)
    expect(alert.textContent).toContain('started from revision 2 and were not saved')
    const [put] = requestsTo(fetchMock, 'PUT', `${BASE}/draft`)
    expect(put.json()).toMatchObject({ expectedRevisionNumber: 2, data: { name: 'Fireball!' } })
    expect(put.headers.get('If-Match')).toBe('"2"')
    expect(requestsTo(fetchMock, 'PUT', `${BASE}/draft`)).toHaveLength(1)
    expect((screen.getByText('Save draft') as HTMLButtonElement).disabled).toBe(true)

    // Reapply: only the user's name edit goes onto revision 3 (level 4 from the server is kept).
    fireEvent.click(screen.getByText('Reapply my edits on revision 3'))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Fireball!')
    expect((screen.getByLabelText('Level (0 = cantrip)') as HTMLInputElement).value).toBe('4')
    expect(screen.getByText(/Editing from revision 3/)).toBeTruthy()
  })

  it('can discard local edits and load the server head instead', async () => {
    const serverHead = revision(3, 'draft', { ...fireball2014, name: 'Fireball (server)' })
    stubFetch([
      ['GET', BASE, () => json(200, entity(revision(2, 'draft')))],
      ['PUT', `${BASE}/draft`, () => json(409, { error: 'stale', code: 'revision_conflict', current: serverHead })],
    ])
    render()
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Mine' } })
    fireEvent.click(screen.getByText('Save draft'))
    fireEvent.click(await screen.findByText('Discard mine and load revision 3'))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Fireball (server)')
  })

  it('shows server validation issues per field', async () => {
    const head = revision(2, 'draft')
    stubFetch([
      ['GET', BASE, () => json(200, entity(head))],
      [
        'POST',
        `${BASE}/validate`,
        () =>
          json(200, {
            valid: false,
            issues: [{ path: ['classes', 0], code: 'unknown_reference', message: 'class wizardz does not exist' }],
            entity: entity(head),
          }),
      ],
    ])
    render()
    fireEvent.click(await screen.findByText('Validate'))
    expect(await screen.findByText(/Revision 2 has 1 issue/)).toBeTruthy()
    const classes = screen.getByLabelText('Classes')
    expect(classes.getAttribute('aria-invalid')).toBe('true')
    const issues = document.getElementById(classes.getAttribute('aria-describedby') ?? '') as HTMLElement
    expect(within(issues).getByText(/class wizardz does not exist \(server\)/)).toBeTruthy()
  })
})

describe('rules publish permissions', () => {
  it('disables publish, archive and rollback without rules:publish', async () => {
    stubFetch([['GET', BASE, () => json(200, entity(revision(2, 'validated')))]])
    render('content_editor')
    const publish = (await screen.findByText('Publish')) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    expect(publish.title).toBe('Requires rules:publish')
    expect((screen.getByText('Archive') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText('Save draft') as HTMLButtonElement).disabled).toBe(true) // nothing edited yet
  })

  it('makes everything read-only for an auditor', async () => {
    stubFetch([['GET', BASE, () => json(200, entity(revision(2, 'validated')))]])
    render('auditor')
    expect(((await screen.findByLabelText('Name')) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByText('Validate') as HTMLButtonElement).disabled).toBe(true)
  })

  it('publishes a validated head with its revision number', async () => {
    const validated = revision(2, 'validated')
    const published = revision(2, 'published')
    const fetchMock = stubFetch([
      ['GET', BASE, () => json(200, entity(validated))],
      [
        'POST',
        `${BASE}/publish`,
        () => json(200, { catalogVersion: 8, entity: entity(published, { currentPublishedRevisionId: 'rev-2', currentPublished: published }) }),
      ],
    ])
    render()
    fireEvent.click(await screen.findByText('Publish'))
    expect(await screen.findByText('Published revision 2 as catalog version 8.')).toBeTruthy()
    expect(requestsTo(fetchMock, 'POST', `${BASE}/publish`)[0].json()).toEqual({ expectedRevisionNumber: 2 })
  })

  it('handles reauth_required on publish by redirecting back to the entity', async () => {
    stubFetch([
      ['GET', BASE, () => json(200, entity(revision(2, 'validated')))],
      ['POST', `${BASE}/publish`, () => json(401, { error: 'reauth_required' })],
    ])
    render()
    fireEvent.click(await screen.findByText('Publish'))
    await waitFor(() =>
      expect(browser.redirect).toHaveBeenCalledWith(`${LOGIN_PATH}?returnTo=${encodeURIComponent(`/rules/${ID}`)}`),
    )
    expect((await screen.findByText(/needs a fresh sign-in/)).textContent).toContain('you will return here')
  })
})

describe('rules history', () => {
  it('rolls back to a previously published revision after confirmation', async () => {
    const published = revision(1, 'published')
    const head = revision(2, 'published', { ...fireball2014, level: 4 })
    const detail = entity(head, {
      currentPublishedRevisionId: 'rev-2',
      currentPublished: head,
      revisions: [
        { ...published, status: 'superseded' },
        (({ data: _d, ...rest }) => (void _d, rest))(head),
      ],
    })
    const fetchMock = stubFetch([
      ['GET', BASE, () => json(200, detail)],
      ['GET', `${BASE}/diff`, () => json(200, { from: 1, to: 2, operations: [{ op: 'replace', path: '/level', value: 4 }] })],
      ['POST', `${BASE}/rollback`, () => json(200, { catalogVersion: 9, entity: entity(revision(3, 'published')) })],
    ])
    render()
    fireEvent.click(await screen.findByRole('tab', { name: 'history' }))
    expect((await screen.findByLabelText('Revision diff')).textContent).toContain('replace /level = 4')

    fireEvent.click(screen.getByText('Roll back to this'))
    fireEvent.click(screen.getByText('Confirm rollback'))
    expect(await screen.findByText(/Rolled back to revision 1; published as revision 3/)).toBeTruthy()
    expect(requestsTo(fetchMock, 'POST', `${BASE}/rollback`)[0].json()).toEqual({
      expectedRevisionNumber: 2,
      targetRevisionNumber: 1,
    })
  })
})

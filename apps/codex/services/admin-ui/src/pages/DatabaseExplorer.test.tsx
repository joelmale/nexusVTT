import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import DatabaseExplorer from './DatabaseExplorer'
import { json, meWith, renderPage, stubFetch } from '@/test/utils'

const TABLES_PATH = '/control-api/v1/database/tables'
const USERS_SCHEMA_PATH = '/control-api/v1/database/tables/users/schema'
const USERS_ROWS_PATH = '/control-api/v1/database/tables/users/rows'

const mockTables = [
  {
    tableName: 'users',
    schemaName: 'public',
    domain: 'vtt',
    estimatedRows: 42,
    totalBytes: 16384,
    totalSize: '16 kB',
  },
  {
    tableName: 'document',
    schemaName: 'public',
    domain: 'codex',
    estimatedRows: 15,
    totalBytes: 32768,
    totalSize: '32 kB',
  },
  {
    tableName: 'admin_audit_events',
    schemaName: 'public',
    domain: 'control',
    estimatedRows: 120,
    totalBytes: 8192,
    totalSize: '8 kB',
  },
]

const mockUsersSchema = {
  tableName: 'users',
  columns: [
    {
      columnName: 'id',
      ordinalPosition: 1,
      isNullable: false,
      dataType: 'uuid',
      udtName: 'uuid',
      columnDefault: 'gen_random_uuid()',
      characterMaximumLength: null,
      keyType: 'PRIMARY KEY',
      foreignKeyTarget: null,
    },
    {
      columnName: 'email',
      ordinalPosition: 2,
      isNullable: false,
      dataType: 'text',
      udtName: 'text',
      columnDefault: null,
      characterMaximumLength: null,
      keyType: null,
      foreignKeyTarget: null,
    },
    {
      columnName: 'meta',
      ordinalPosition: 3,
      isNullable: true,
      dataType: 'jsonb',
      udtName: 'jsonb',
      columnDefault: null,
      characterMaximumLength: null,
      keyType: null,
      foreignKeyTarget: null,
    },
  ],
}

const mockUsersRows = {
  tableName: 'users',
  totalCount: 2,
  limit: 25,
  offset: 0,
  rows: [
    {
      id: 'u-1',
      email: 'admin@example.com',
      meta: { theme: 'dark', tags: ['vip', 'staff'] },
    },
    {
      id: 'u-2',
      email: 'player@example.com',
      meta: null,
    },
  ],
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function stubDatabaseApi() {
  return stubFetch([
    ['GET', TABLES_PATH, () => json(200, { tables: mockTables })],
    ['GET', USERS_SCHEMA_PATH, () => json(200, mockUsersSchema)],
    ['GET', USERS_ROWS_PATH, () => json(200, mockUsersRows)],
  ])
}

describe('DatabaseExplorer', () => {
  it('renders tables list with domain badges and row estimates', async () => {
    stubDatabaseApi()
    renderPage(<DatabaseExplorer />, { me: meWith('operator') })

    expect(await screen.findByText('users')).toBeTruthy()
    expect(screen.getByText('document')).toBeTruthy()
    expect(screen.getByText('admin_audit_events')).toBeTruthy()

    // Verifies domain badges
    expect(screen.getAllByText('VTT').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText('Control')).toBeTruthy()
  })

  it('filters tables by domain tab', async () => {
    stubDatabaseApi()
    renderPage(<DatabaseExplorer />, { me: meWith('operator') })

    await screen.findByText('users')

    // Click 'codex' filter tab
    const codexTab = screen.getByRole('button', { name: 'codex' })
    fireEvent.click(codexTab)

    expect(screen.getByText('document')).toBeTruthy()
    expect(screen.queryByText('admin_audit_events')).toBeNull()
  })

  it('filters tables by search query', async () => {
    stubDatabaseApi()
    renderPage(<DatabaseExplorer />, { me: meWith('operator') })

    await screen.findByText('users')
    const searchInput = screen.getByPlaceholderText('Filter tables...')
    fireEvent.change(searchInput, { target: { value: 'audit' } })

    expect(screen.getByText('admin_audit_events')).toBeTruthy()
    expect(screen.queryByText('users')).toBeNull()
    expect(screen.queryByText('document')).toBeNull()
  })

  it('displays columns and keys in the Columns & Schema tab', async () => {
    stubDatabaseApi()
    renderPage(<DatabaseExplorer />, { me: meWith('operator') })

    // Auto-selects first table or click 'users'
    const usersBtn = await screen.findByText('users')
    fireEvent.click(usersBtn)

    expect(await screen.findByText('Columns & Schema')).toBeTruthy()
    expect(await screen.findByText('PRIMARY KEY')).toBeTruthy()
    expect(screen.getByText('gen_random_uuid()')).toBeTruthy()
  })

  it('switches to Entries tab, displays rows, and opens the JSON Inspector Drawer', async () => {
    stubDatabaseApi()
    renderPage(<DatabaseExplorer />, { me: meWith('operator') })

    const usersBtn = await screen.findByText('users')
    fireEvent.click(usersBtn)

    // Switch to entries tab
    const entriesTab = await screen.findByRole('button', { name: /Entries/i })
    fireEvent.click(entriesTab)

    expect(await screen.findByText('admin@example.com')).toBeTruthy()
    expect(screen.getByText('player@example.com')).toBeTruthy()

    // Find the JSON Inspect button for meta
    const inspectBtn = screen.getByRole('button', { name: /Object\(2\)/i })
    expect(inspectBtn).toBeTruthy()
    fireEvent.click(inspectBtn)

    // JSON Drawer opens
    expect(await screen.findByText('JSON Inspector: meta')).toBeTruthy()
    expect(screen.getByText('Record ID: u-1')).toBeTruthy()
    expect(screen.getByText('Copy JSON')).toBeTruthy()

    // Close JSON Drawer
    const closeBtn = screen.getByRole('button', { name: '' }) // close X button
    fireEvent.click(closeBtn)
  })
})

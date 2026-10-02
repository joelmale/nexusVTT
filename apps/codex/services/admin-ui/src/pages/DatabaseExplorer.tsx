import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Columns,
  Copy,
  Database,
  Key,
  RefreshCw,
  Search,
  Table,
  X,
} from 'lucide-react'
import { ErrorNotice, PageHeader, Pill, type Tone } from '@/components/common'
import {
  getDatabaseTableRows,
  getDatabaseTableSchema,
  listDatabaseTables,
  type DatabaseDomain,
  type DatabaseTableSummary,
} from '@/lib/controlPlaneApi'
import { buttonClass } from '@/lib/ui'

const DOMAIN_TONES: Record<DatabaseDomain, Tone> = {
  vtt: 'purple',
  codex: 'green',
  control: 'yellow',
  other: 'gray',
}

const DOMAIN_LABELS: Record<DatabaseDomain, string> = {
  vtt: 'VTT',
  codex: 'Codex',
  control: 'Control',
  other: 'Other',
}

type DomainFilter = 'all' | DatabaseDomain
type ActiveTab = 'schema' | 'entries'

interface JsonDrawerState {
  columnName: string
  value: unknown
  rowIdentifier?: string
}

export default function DatabaseExplorer() {
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null)
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all')
  const [tableSearch, setTableSearch] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('schema')

  // Pagination & sorting for entries
  const [pageSize, setPageSize] = useState<number>(25)
  const [pageIndex, setPageIndex] = useState<number>(0)
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Slide-over JSON drawer state
  const [jsonDrawer, setJsonDrawer] = useState<JsonDrawerState | null>(null)
  const [copiedJson, setCopiedJson] = useState(false)

  // Fetch all tables
  const tablesQuery = useQuery({
    queryKey: ['database-tables'],
    queryFn: listDatabaseTables,
  })

  const tables = tablesQuery.data ?? []

  // Filter tables
  const filteredTables = tables.filter((t) => {
    if (domainFilter !== 'all' && t.domain !== domainFilter) return false
    if (tableSearch.trim() && !t.tableName.toLowerCase().includes(tableSearch.trim().toLowerCase())) {
      return false
    }
    return true
  })

  // Selected table summary
  const currentTable: DatabaseTableSummary | undefined =
    tables.find((t) => t.tableName === selectedTableName) ?? filteredTables[0]

  const activeTableName = currentTable?.tableName

  // Fetch schema for active table
  const schemaQuery = useQuery({
    queryKey: ['database-table-schema', activeTableName],
    queryFn: () => (activeTableName ? getDatabaseTableSchema(activeTableName) : null),
    enabled: Boolean(activeTableName),
  })

  // Fetch entries for active table
  const rowsQuery = useQuery({
    queryKey: ['database-table-rows', activeTableName, pageSize, pageIndex, sortColumn, sortDirection],
    queryFn: () =>
      activeTableName
        ? getDatabaseTableRows(activeTableName, {
            limit: pageSize,
            offset: pageIndex * pageSize,
            sortColumn,
            sortDirection,
          })
        : null,
    enabled: Boolean(activeTableName) && activeTab === 'entries',
    placeholderData: keepPreviousData,
  })

  const handleTableSelect = (tableName: string) => {
    setSelectedTableName(tableName)
    setPageIndex(0)
    setSortColumn(undefined)
    setSortDirection('asc')
  }

  const handleSort = (colName: string) => {
    if (sortColumn === colName) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(colName)
      setSortDirection('asc')
    }
    setPageIndex(0)
  }

  const handleCopyJson = () => {
    if (!jsonDrawer) return
    const text = JSON.stringify(jsonDrawer.value, null, 2)
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Database & Schema Explorer"
        description="Inspect PostgreSQL object types, schema definitions, and table entries across VTT, Codex, and Control plane domains."
        actions={
          <button
            className={buttonClass.secondary}
            onClick={() => {
              void tablesQuery.refetch()
              if (activeTab === 'schema') void schemaQuery.refetch()
              if (activeTab === 'entries') void rowsQuery.refetch()
            }}
            disabled={tablesQuery.isFetching || schemaQuery.isFetching || rowsQuery.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                tablesQuery.isFetching || schemaQuery.isFetching || rowsQuery.isFetching ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </button>
        }
      />

      <ErrorNotice error={tablesQuery.error ?? schemaQuery.error ?? rowsQuery.error} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Column: Table List & Domain Filter */}
        <div className="flex flex-col space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Tables</h2>
            <span className="text-xs text-gray-400">{filteredTables.length} available</span>
          </div>

          {/* Domain Filter Tabs */}
          <div className="flex flex-wrap gap-1 rounded-md bg-gray-100 p-1 text-xs">
            {(['all', 'vtt', 'codex', 'control', 'other'] as const).map((dom) => (
              <button
                key={dom}
                onClick={() => setDomainFilter(dom)}
                className={`rounded px-2 py-1 font-medium capitalize transition-colors ${
                  domainFilter === dom ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>

          {/* Table Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter tables..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {tableSearch && (
              <button
                onClick={() => setTableSearch('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Table List Scrollable */}
          <div className="max-h-[600px] space-y-1 overflow-y-auto pr-1">
            {tablesQuery.isLoading ? (
              <p className="py-6 text-center text-xs text-gray-400">Loading tables...</p>
            ) : filteredTables.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No tables match filter</p>
            ) : (
              filteredTables.map((tbl) => {
                const isSelected = activeTableName === tbl.tableName
                return (
                  <button
                    key={tbl.tableName}
                    onClick={() => handleTableSelect(tbl.tableName)}
                    className={`flex w-full flex-col items-start rounded-md p-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-l-4 border-indigo-600 bg-indigo-50/70 font-medium text-indigo-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span className="truncate font-mono font-medium">{tbl.tableName}</span>
                      <Pill tone={DOMAIN_TONES[tbl.domain]}>{DOMAIN_LABELS[tbl.domain]}</Pill>
                    </div>
                    <div className="mt-1 flex w-full items-center justify-between text-[11px] text-gray-500">
                      <span>{tbl.estimatedRows.toLocaleString()} rows</span>
                      <span>{tbl.totalSize}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Area: Selected Table Details & Browser */}
        <div className="flex flex-col space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-3">
          {currentTable ? (
            <>
              {/* Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-600" />
                    <h2 className="font-mono text-lg font-bold text-gray-900">
                      {currentTable.schemaName}.{currentTable.tableName}
                    </h2>
                    <Pill tone={DOMAIN_TONES[currentTable.domain]}>{DOMAIN_LABELS[currentTable.domain]}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Estimated {currentTable.estimatedRows.toLocaleString()} rows · Disk footprint{' '}
                    {currentTable.totalSize}
                  </p>
                </div>

                {/* Tabs Switcher */}
                <div className="flex rounded-md border border-gray-200 bg-gray-50 p-1 text-xs">
                  <button
                    onClick={() => setActiveTab('schema')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
                      activeTab === 'schema'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Columns className="h-3.5 w-3.5" />
                    <span>Columns & Schema</span>
                    {schemaQuery.data && (
                      <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.2 text-[10px] text-gray-700">
                        {schemaQuery.data.columns.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('entries')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
                      activeTab === 'entries'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Table className="h-3.5 w-3.5" />
                    <span>Entries</span>
                    {rowsQuery.data && (
                      <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.2 text-[10px] text-gray-700">
                        {rowsQuery.data.totalCount.toLocaleString()}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* TAB 1: COLUMNS & SCHEMA */}
              {activeTab === 'schema' && (
                <div className="space-y-4">
                  {schemaQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-gray-500">Loading column definitions...</p>
                  ) : schemaQuery.data ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 font-medium uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-center">#</th>
                            <th className="px-3 py-2">Column Name</th>
                            <th className="px-3 py-2">Postgres Type</th>
                            <th className="px-3 py-2">UDT</th>
                            <th className="px-3 py-2">Keys & References</th>
                            <th className="px-3 py-2">Nullable</th>
                            <th className="px-3 py-2">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono">
                          {schemaQuery.data.columns.map((col) => (
                            <tr key={col.columnName} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2 text-center text-gray-400">{col.ordinalPosition}</td>
                              <td className="px-3 py-2 font-semibold text-gray-900">
                                <div className="flex items-center gap-1.5">
                                  {col.keyType === 'PRIMARY KEY' && <Key className="h-3.5 w-3.5 text-amber-500" />}
                                  <span>{col.columnName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-indigo-700">
                                {col.dataType}
                                {col.characterMaximumLength && `(${col.characterMaximumLength})`}
                              </td>
                              <td className="px-3 py-2 text-gray-500">{col.udtName}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-1">
                                  {col.keyType === 'PRIMARY KEY' && <Pill tone="yellow">PRIMARY KEY</Pill>}
                                  {col.keyType === 'UNIQUE' && <Pill tone="purple">UNIQUE</Pill>}
                                  {col.foreignKeyTarget && (
                                    <Pill tone="blue">FK → {col.foreignKeyTarget}</Pill>
                                  )}
                                  {!col.keyType && !col.foreignKeyTarget && (
                                    <span className="font-sans text-gray-400">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {col.isNullable ? (
                                  <span className="text-gray-400">NULL</span>
                                ) : (
                                  <span className="font-semibold text-gray-700">NOT NULL</span>
                                )}
                              </td>
                              <td className="max-w-xs truncate px-3 py-2 text-gray-500" title={col.columnDefault ?? ''}>
                                {col.columnDefault ?? <span className="font-sans text-gray-400">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 2: ENTRIES DATA BROWSER */}
              {activeTab === 'entries' && (
                <div className="space-y-4">
                  {/* Controls Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Rows per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value))
                          setPageIndex(0)
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    {rowsQuery.data && (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">
                          Showing {rowsQuery.data.totalCount === 0 ? 0 : pageIndex * pageSize + 1}–
                          {Math.min((pageIndex + 1) * pageSize, rowsQuery.data.totalCount)} of{' '}
                          {rowsQuery.data.totalCount.toLocaleString()} entries
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            className={buttonClass.secondary}
                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                            disabled={pageIndex === 0 || rowsQuery.isFetching}
                          >
                            Prev
                          </button>
                          <span className="px-2 font-medium text-gray-700">
                            Page {pageIndex + 1} of {Math.max(1, Math.ceil(rowsQuery.data.totalCount / pageSize))}
                          </span>
                          <button
                            className={buttonClass.secondary}
                            onClick={() => setPageIndex((p) => p + 1)}
                            disabled={
                              (pageIndex + 1) * pageSize >= rowsQuery.data.totalCount || rowsQuery.isFetching
                            }
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Data Table */}
                  {rowsQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-gray-500">Loading entries...</p>
                  ) : rowsQuery.data ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 font-medium uppercase text-gray-500">
                          <tr>
                            {schemaQuery.data?.columns.map((col) => {
                              const isSorted = sortColumn === col.columnName
                              return (
                                <th
                                  key={col.columnName}
                                  onClick={() => handleSort(col.columnName)}
                                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 hover:bg-gray-100"
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{col.columnName}</span>
                                    {isSorted ? (
                                      sortDirection === 'asc' ? (
                                        <ArrowUp className="h-3 w-3 text-indigo-600" />
                                      ) : (
                                        <ArrowDown className="h-3 w-3 text-indigo-600" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="h-3 w-3 text-gray-300" />
                                    )}
                                  </div>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono">
                          {rowsQuery.data.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={schemaQuery.data?.columns.length ?? 1}
                                className="px-3 py-8 text-center font-sans text-sm text-gray-400"
                              >
                                No records found in this table.
                              </td>
                            </tr>
                          ) : (
                            rowsQuery.data.rows.map((row, rowIdx) => {
                              const rowId = String(row.id ?? row.idHash ?? rowIdx)
                              return (
                                <tr key={rowId} className="hover:bg-gray-50/60">
                                  {schemaQuery.data?.columns.map((col) => {
                                    const val = row[col.columnName]
                                    return (
                                      <td
                                        key={col.columnName}
                                        className="max-w-xs truncate px-3 py-2 text-gray-800"
                                      >
                                        {renderCellValue(col.columnName, val, rowId, setJsonDrawer)}
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <Table className="mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium">Select a table from the sidebar</p>
              <p className="text-xs">Browse schema definitions, primary keys, and data rows.</p>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over JSON Inspector Drawer */}
      {jsonDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="font-mono text-base font-semibold text-gray-900">
                  JSON Inspector: {jsonDrawer.columnName}
                </h3>
                {jsonDrawer.rowIdentifier && (
                  <p className="font-mono text-xs text-gray-500">Record ID: {jsonDrawer.rowIdentifier}</p>
                )}
              </div>
              <button
                onClick={() => setJsonDrawer(null)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-2">
              <span className="text-xs text-gray-500">
                {typeof jsonDrawer.value === 'object' && jsonDrawer.value !== null
                  ? Array.isArray(jsonDrawer.value)
                    ? `${jsonDrawer.value.length} items`
                    : `${Object.keys(jsonDrawer.value).length} keys`
                  : 'Scalar'}
              </span>
              <button
                className={buttonClass.secondary}
                onClick={handleCopyJson}
              >
                {copiedJson ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Body */}
            <div className="flex-1 overflow-auto bg-gray-900 p-6">
              <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all">
                {JSON.stringify(jsonDrawer.value, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function renderCellValue(
  columnName: string,
  val: unknown,
  rowId: string,
  onInspectJson: (drawer: JsonDrawerState) => void,
) {
  if (val === null || val === undefined) {
    return <span className="font-sans italic text-gray-400">null</span>
  }

  if (typeof val === 'boolean') {
    return (
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          val ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {val ? 'TRUE' : 'FALSE'}
      </span>
    )
  }

  if (typeof val === 'string' && val === '[REDACTED]') {
    return (
      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
        [REDACTED]
      </span>
    )
  }

  if (typeof val === 'object') {
    const isArr = Array.isArray(val)
    const count = isArr ? (val as unknown[]).length : Object.keys(val as Record<string, unknown>).length
    const label = isArr ? `Array(${count})` : `Object(${count})`

    return (
      <button
        onClick={() => onInspectJson({ columnName, value: val, rowIdentifier: rowId })}
        className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
      >
        <span>{label}</span>
        <span className="text-[10px] text-indigo-500">Inspect</span>
      </button>
    )
  }

  return <span title={String(val)}>{String(val)}</span>
}

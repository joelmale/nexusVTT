import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  RulesEntityTypeSchema,
  RulesRevisionStatusSchema,
  RulesetSchema,
  type RulesEntityType,
  type RulesRevisionStatus,
  type Ruleset,
} from '@nexus/rules-contracts'
import { listRulesEntities } from '@/lib/rulesApi'
import { useCan } from '@/auth/AuthContext'
import { ErrorNotice, PageHeader, Pill } from '@/components/common'
import { buttonClass, formatDate, inputClass } from '@/lib/ui'
import { revisionStatusTone } from './rulesUi'

const PAGE_SIZE = 50

export default function RulesList() {
  const canCreate = useCan('editRules')
  const [type, setType] = useState<RulesEntityType | ''>('')
  const [ruleset, setRuleset] = useState<Ruleset | ''>('')
  const [status, setStatus] = useState<RulesRevisionStatus | ''>('')
  const [archived, setArchived] = useState<'false' | 'true' | 'all'>('false')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)

  const list = useQuery({
    queryKey: ['rules', { type, ruleset, status, archived, q, offset }],
    queryFn: () =>
      listRulesEntities({
        type: type || undefined,
        ruleset: ruleset || undefined,
        status: status || undefined,
        archived,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setQ(searchInput.trim())
    setOffset(0)
  }

  const select = <T extends string>(setter: Dispatch<SetStateAction<T>>) => (value: string) => {
    setter(value as T)
    setOffset(0)
  }

  const total = list.data?.total ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <PageHeader
        title="Rules registry"
        description="Versioned spells, items and monsters for the 2014 and 2024 rulesets. Only published revisions reach the VTT and Forge."
        actions={
          canCreate ? (
            <Link to="/rules/new" className={buttonClass.primary}>
              New entity
            </Link>
          ) : undefined
        }
      />

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm" aria-label="Rules filters">
        <FilterSelect label="Type" value={type} onChange={select(setType)} options={RulesEntityTypeSchema.options} />
        <FilterSelect label="Ruleset" value={ruleset} onChange={select(setRuleset)} options={RulesetSchema.options} />
        <FilterSelect label="Head status" value={status} onChange={select(setStatus)} options={RulesRevisionStatusSchema.options} />
        <label className="space-y-1">
          <span className="block font-medium text-gray-700">Archived</span>
          <select className={inputClass} value={archived} onChange={(event) => select(setArchived)(event.target.value)}>
            <option value="false">Hide archived</option>
            <option value="true">Only archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="flex-1 space-y-1">
          <span className="block font-medium text-gray-700">Slug contains</span>
          <input className={inputClass} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </label>
        <button type="submit" className={buttonClass.secondary}>
          Search
        </button>
      </form>

      <ErrorNotice error={list.error} />
      {list.isLoading && <p className="text-sm text-gray-500">Loading rules...</p>}
      {list.data && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Ruleset</th>
                <th className="px-3 py-2">Head</th>
                <th className="px-3 py-2">Published</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No entities match these filters.
                  </td>
                </tr>
              )}
              {list.data.items.map((entity) => (
                <tr key={entity.id}>
                  <td className="px-3 py-2">
                    <Link className="font-medium text-indigo-700 hover:text-indigo-900" to={`/rules/${entity.id}`}>
                      {entity.name ?? entity.slug}
                    </Link>
                    <div className="text-xs text-gray-500">{entity.slug}</div>
                  </td>
                  <td className="px-3 py-2">{entity.entityType}</td>
                  <td className="px-3 py-2">{entity.ruleset}</td>
                  <td className="px-3 py-2">
                    <span className="mr-1">r{entity.headRevisionNumber}</span>
                    <Pill tone={revisionStatusTone(entity.headStatus)}>{entity.headStatus}</Pill>
                    {entity.archivedAt && (
                      <span className="ml-1">
                        <Pill tone="gray">archived</Pill>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{entity.currentPublishedRevisionId ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2 text-gray-600">{formatDate(entity.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <button className={buttonClass.secondary} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            Previous
          </button>
          <span className="text-gray-600">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            className={buttonClass.secondary}
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
}) {
  return (
    <label className="space-y-1">
      <span className="block font-medium text-gray-700">{label}</span>
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

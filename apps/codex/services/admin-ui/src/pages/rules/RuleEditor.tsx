import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  diffJson,
  parseRulesEntityData,
  summarizeRulesEntity,
  type RulesEntityDetail,
  type RulesRevision,
  type RulesValidationIssue,
} from '@nexus/rules-contracts'
import {
  conflictHead,
  diffRulesRevisions,
  errorIssues,
  getRulesEntity,
  getRulesRevision,
  previewRulesEntity,
  publishRulesEntity,
  rollbackRulesEntity,
  saveRulesDraft,
  setRulesArchived,
  validateRulesEntity,
} from '@/lib/rulesApi'
import { useAuth, useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { ErrorNotice, PageHeader, Pill, Section } from '@/components/common'
import { buttonClass, formatDate, inputClass } from '@/lib/ui'
import RulesDataForm, { type LabeledIssue } from './RulesDataForm'
import StatBlock from './StatBlock'
import { applyJsonPatch, pathKey, validateLocally, type RulesData } from './rulesForm'
import { revisionStatusTone } from './rulesUi'

export default function RuleEditor() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['rules-entity', id], queryFn: () => getRulesEntity(id), enabled: Boolean(id) })

  if (query.isLoading) return <p className="p-6 text-sm text-gray-500">Loading entity...</p>
  if (query.error || !query.data) {
    return (
      <div className="space-y-3 p-6">
        <Link to="/rules" className="text-sm text-indigo-600">
          Back to rules
        </Link>
        <ErrorNotice error={query.error ?? new Error('Entity not found')} />
      </div>
    )
  }

  const setEntity = (entity: RulesEntityDetail) => {
    queryClient.setQueryData(['rules-entity', id], entity)
    void queryClient.invalidateQueries({ queryKey: ['rules'] })
  }

  return <LoadedEditor key={id} entity={query.data} setEntity={setEntity} />
}

type Tab = 'edit' | 'preview' | 'history'

function dataOf(revision: RulesRevision, entity: RulesEntityDetail): RulesData {
  const data = revision.data && typeof revision.data === 'object' && !Array.isArray(revision.data) ? (revision.data as RulesData) : {}
  return data.ruleset === entity.ruleset ? data : { ...data, ruleset: entity.ruleset }
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function LoadedEditor({ entity, setEntity }: { entity: RulesEntityDetail; setEntity: (entity: RulesEntityDetail) => void }) {
  const { me } = useAuth()
  const canEdit = useCan('editRules')
  const canPublish = useCan('publishRules')
  const [tab, setTab] = useState<Tab>('edit')
  const [base, setBase] = useState<{ revision: number; data: RulesData }>(() => ({
    revision: entity.headRevisionNumber,
    data: dataOf(entity.head, entity),
  }))
  const [draft, setDraft] = useState<RulesData>(base.data)
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [serverIssues, setServerIssues] = useState<RulesValidationIssue[]>([])
  const [conflict, setConflict] = useState<RulesRevision | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const dirty = !sameJson(draft, base.data)
  const localIssues = useMemo(
    () => validateLocally(entity.entityType, entity.ruleset, draft),
    [entity.entityType, entity.ruleset, draft],
  )
  const issues: LabeledIssue[] = [
    ...localIssues.map((issue) => ({ ...issue, source: 'contract' as const })),
    ...serverIssues.map((issue) => ({ ...issue, source: 'server' as const })),
  ]

  // Follow newer server heads (validate/publish/archive responses) while there are no local edits.
  useEffect(() => {
    if (entity.headRevisionNumber > base.revision && !dirty && !conflict) {
      const data = dataOf(entity.head, entity)
      setBase({ revision: entity.headRevisionNumber, data })
      setDraft(data)
    }
  }, [entity, base.revision, dirty, conflict])

  const handleConflict = async (error: unknown): Promise<boolean> => {
    const head = conflictHead(error)
    if (!head) return false
    setConflict(head)
    try {
      setEntity(await getRulesEntity(entity.id))
    } catch {
      // The conflict body already carries the head the user needs.
    }
    return true
  }

  const save = useMutation({
    mutationFn: () => saveRulesDraft(entity.id, base.revision, draft),
    onSuccess: (updated) => {
      const data = dataOf(updated.head, updated)
      setBase({ revision: updated.headRevisionNumber, data })
      setDraft(data)
      setServerIssues([])
      setNotice(`Saved draft revision ${updated.headRevisionNumber}.`)
      setEntity(updated)
    },
    onError: async (error) => {
      if (!(await handleConflict(error))) setServerIssues(errorIssues(error))
    },
  })

  const validate = useMutation({
    mutationFn: () => validateRulesEntity(entity.id, entity.headRevisionNumber),
    onSuccess: (result) => {
      setServerIssues(result.issues)
      setNotice(
        result.valid
          ? `Revision ${result.entity.headRevisionNumber} is valid and can be published.`
          : `Revision ${result.entity.headRevisionNumber} has ${result.issues.length} issue(s).`,
      )
      setEntity(result.entity)
    },
    onError: async (error) => {
      if (!(await handleConflict(error))) setServerIssues(errorIssues(error))
    },
  })

  const publish = useMutation({
    mutationFn: () => publishRulesEntity(entity.id, entity.headRevisionNumber),
    onSuccess: (result) => {
      setServerIssues([])
      setNotice(`Published revision ${result.entity.headRevisionNumber} as catalog version ${result.catalogVersion}.`)
      setEntity(result.entity)
    },
    onError: async (error) => {
      if (!(await handleConflict(error))) setServerIssues(errorIssues(error))
    },
  })

  const archive = useMutation({
    mutationFn: () => setRulesArchived(entity.id, !entity.archivedAt, entity.headRevisionNumber),
    onSuccess: (updated) => {
      setNotice(updated.archivedAt ? 'Entity archived; consumers receive a tombstone.' : 'Entity restored to the catalog.')
      setEntity(updated)
    },
    onError: handleConflict,
  })

  const reapplyMine = () => {
    if (!conflict) return
    // Rebase: replay only this user's changes onto the server head, so fields
    // someone else changed meanwhile keep their new values.
    const serverData = dataOf(conflict, entity)
    setDraft(applyJsonPatch(serverData, diffJson(base.data, draft)))
    setBase({ revision: conflict.revisionNumber, data: serverData })
    setConflict(null)
    save.reset()
    setNotice(`Your edits were reapplied on top of revision ${conflict.revisionNumber}. Review them and save again.`)
  }

  const loadServer = () => {
    if (!conflict) return
    const data = dataOf(conflict, entity)
    setBase({ revision: conflict.revisionNumber, data })
    setDraft(data)
    setConflict(null)
    save.reset()
    setNotice(`Loaded revision ${conflict.revisionNumber}; your edits were discarded.`)
  }

  const recentAuthExpired = !me.recentAuthUntil || new Date(me.recentAuthUntil).getTime() < Date.now()
  const busy = save.isPending || validate.isPending || publish.isPending || archive.isPending
  const actionError = [save.error, validate.error, publish.error, archive.error].find((error) => error && !conflictHead(error))
  const head = entity.head
  const publishedRevision = entity.currentPublished?.revisionNumber

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <Link to="/rules" className="text-sm text-indigo-600">
        Back to rules
      </Link>
      <PageHeader
        title={entity.name ?? entity.slug}
        description={`${entity.entityType} · ${entity.ruleset} · ${entity.slug}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Head r{entity.headRevisionNumber}</span>
            <Pill tone={revisionStatusTone(head.status)}>{head.status}</Pill>
            <span className="text-gray-500">{publishedRevision ? `published r${publishedRevision}` : 'never published'}</span>
            {entity.archivedAt && <Pill tone="gray">archived</Pill>}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={buttonClass.primary}
          disabled={!canEdit || !dirty || busy || Boolean(conflict)}
          title={canEdit ? undefined : permissionHint('editRules')}
          onClick={() => {
            setNotice(null)
            save.mutate()
          }}
        >
          {save.isPending ? 'Saving...' : 'Save draft'}
        </button>
        <button
          className={buttonClass.secondary}
          disabled={!canEdit || dirty || busy || (head.status !== 'draft' && head.status !== 'validated')}
          title={!canEdit ? permissionHint('editRules') : dirty ? 'Save your draft before validating' : undefined}
          onClick={() => {
            setNotice(null)
            validate.mutate()
          }}
        >
          {validate.isPending ? 'Validating...' : 'Validate'}
        </button>
        <button
          className={buttonClass.secondary}
          disabled={!canPublish || dirty || busy || head.status !== 'validated'}
          title={
            !canPublish
              ? permissionHint('publishRules')
              : head.status !== 'validated'
                ? 'Validate the head revision first'
                : undefined
          }
          onClick={() => {
            setNotice(null)
            publish.mutate()
          }}
        >
          {publish.isPending ? 'Publishing...' : 'Publish'}
        </button>
        <button
          className={buttonClass.secondary}
          disabled={!canPublish || busy}
          title={canPublish ? undefined : permissionHint('publishRules')}
          onClick={() => {
            setNotice(null)
            archive.mutate()
          }}
        >
          {entity.archivedAt ? 'Unarchive' : 'Archive'}
        </button>
        {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
        {canPublish && recentAuthExpired && (
          <span className="text-xs text-gray-500">Publishing asks you to sign in again if your last sign-in was over 10 minutes ago.</span>
        )}
      </div>

      {notice && (
        <p role="status" className="text-sm text-blue-800">
          {notice}
        </p>
      )}
      <ErrorNotice error={actionError} />

      {conflict && (
        <ConflictPanel
          conflict={conflict}
          baseRevision={base.revision}
          baseData={base.data}
          draft={draft}
          onReapply={reapplyMine}
          onLoad={loadServer}
        />
      )}

      <nav className="flex gap-1 border-b border-gray-200" aria-label="Entity sections">
        {(['edit', 'preview', 'history'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === value ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </nav>

      {tab === 'edit' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Editing from revision {base.revision}</span>
              <span className="ml-auto">View:</span>
              <button className={buttonClass.secondary} aria-pressed={mode === 'form'} onClick={() => setMode('form')}>
                Form
              </button>
              <button className={buttonClass.secondary} aria-pressed={mode === 'json'} onClick={() => setMode('json')}>
                JSON
              </button>
            </div>
            {mode === 'form' ? (
              <RulesDataForm
                entityType={entity.entityType}
                ruleset={entity.ruleset}
                data={draft}
                onChange={setDraft}
                issues={issues}
                disabled={!canEdit || Boolean(conflict)}
              />
            ) : (
              <WholeJsonEditor data={draft} onChange={setDraft} disabled={!canEdit || Boolean(conflict)} />
            )}
          </div>
          <IssueSummary issues={issues} />
        </div>
      )}

      {tab === 'preview' && <PreviewPanel entity={entity} draft={draft} localValid={localIssues.length === 0} />}

      {tab === 'history' && <HistoryPanel entity={entity} canPublish={canPublish} setEntity={setEntity} />}
    </div>
  )
}

function IssueSummary({ issues }: { issues: LabeledIssue[] }) {
  return (
    <aside className="h-fit rounded-lg border border-gray-200 bg-white p-3 text-sm" aria-label="Validation issues">
      <h2 className="mb-2 font-semibold">Validation</h2>
      {issues.length === 0 ? (
        <p className="text-green-700">No contract issues.</p>
      ) : (
        <ul className="space-y-1">
          {issues.map((issue, index) => (
            <li key={`${issue.source}-${index}`} className="text-red-700">
              <code className="text-xs">{pathKey(issue.path) || '(entity)'}</code>: {issue.message}
              <span className="text-xs text-gray-500"> · {issue.source === 'server' ? 'server' : 'contract'}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Contract checks run in the browser with the shared schemas. Validate on the server to check references and name
        uniqueness.
      </p>
    </aside>
  )
}

function WholeJsonEditor({ data, onChange, disabled }: { data: RulesData; onChange: (data: RulesData) => void; disabled?: boolean }) {
  const [text, setText] = useState(() => JSON.stringify(data, null, 2))
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <label htmlFor="rules-json" className="block text-sm font-medium text-gray-700">
        Revision data (JSON)
      </label>
      <textarea
        id="rules-json"
        rows={28}
        spellCheck={false}
        disabled={disabled}
        className={`${inputClass} font-mono text-xs`}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          try {
            const parsed: unknown = JSON.parse(event.target.value)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Data must be a JSON object')
            setError(null)
            onChange(parsed as RulesData)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid JSON')
          }
        }}
      />
      {error && <p className="text-xs text-red-700">JSON not applied: {error}</p>}
    </div>
  )
}

function ConflictPanel({
  conflict,
  baseRevision,
  baseData,
  draft,
  onReapply,
  onLoad,
}: {
  conflict: RulesRevision
  baseRevision: number
  baseData: RulesData
  draft: RulesData
  onReapply: () => void
  onLoad: () => void
}) {
  const changes = diffJson(baseData, draft)
  return (
    <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">
        Revision {conflict.revisionNumber} ({conflict.status}) by {conflict.createdBy} at {formatDate(conflict.createdAt)} is now
        the head. Your edits started from revision {baseRevision} and were not saved.
      </p>
      <details open>
        <summary className="cursor-pointer">Your unsaved edits to revision {baseRevision} ({changes.length} change(s))</summary>
        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto font-mono text-xs">
          {changes.map((op, index) => (
            <li key={index}>
              {op.op} {op.path}
              {'value' in op ? ` = ${JSON.stringify(op.value)}` : ''}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary className="cursor-pointer">Server revision {conflict.revisionNumber} data</summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs">{JSON.stringify(conflict.data, null, 2)}</pre>
      </details>
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass.secondary} onClick={onReapply}>
          Reapply my edits on revision {conflict.revisionNumber}
        </button>
        <button className={buttonClass.secondary} onClick={onLoad}>
          Discard mine and load revision {conflict.revisionNumber}
        </button>
      </div>
    </div>
  )
}

function PreviewPanel({ entity, draft, localValid }: { entity: RulesEntityDetail; draft: RulesData; localValid: boolean }) {
  const [source, setSource] = useState<'server' | 'local'>('server')
  const [revision, setRevision] = useState<number>(entity.headRevisionNumber)
  const preview = useQuery({
    queryKey: ['rules-preview', entity.id, revision],
    queryFn: () => previewRulesEntity(entity.id, revision),
    enabled: source === 'server',
    retry: false,
  })
  const local = useMemo(() => {
    const parsed = parseRulesEntityData(entity.entityType, entity.ruleset, draft)
    return parsed.success ? { data: parsed.data, summary: summarizeRulesEntity(entity.entityType, parsed.data) } : null
  }, [entity.entityType, entity.ruleset, draft])

  return (
    <Section
      title="Preview"
      actions={
        <div className="flex items-center gap-2 text-sm">
          <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as 'server' | 'local')} aria-label="Preview source">
            <option value="server">Saved revision (as consumers receive it)</option>
            <option value="local">Unsaved edits</option>
          </select>
          {source === 'server' && (
            <select className={inputClass} value={revision} onChange={(e) => setRevision(Number(e.target.value))} aria-label="Preview revision">
              {entity.revisions.map((rev) => (
                <option key={rev.revisionNumber} value={rev.revisionNumber}>
                  r{rev.revisionNumber} ({rev.status})
                </option>
              ))}
            </select>
          )}
        </div>
      }
    >
      {source === 'server' && (
        <>
          <ErrorNotice error={preview.error} />
          {preview.isLoading && <p className="text-sm text-gray-500">Rendering preview...</p>}
          {preview.data && (
            <StatBlock entityType={preview.data.entity.entityType} data={preview.data.entity.data} summary={preview.data.entity.summary} />
          )}
        </>
      )}
      {source === 'local' &&
        (local && localValid ? (
          <StatBlock entityType={entity.entityType} data={local.data} summary={local.summary} />
        ) : (
          <p className="text-sm text-gray-500">Fix the contract issues on the Edit tab to preview unsaved edits.</p>
        ))}
    </Section>
  )
}

function HistoryPanel({
  entity,
  canPublish,
  setEntity,
}: {
  entity: RulesEntityDetail
  canPublish: boolean
  setEntity: (entity: RulesEntityDetail) => void
}) {
  const revisions = [...entity.revisions].sort((a, b) => b.revisionNumber - a.revisionNumber)
  const [from, setFrom] = useState<number>(revisions[1]?.revisionNumber ?? revisions[0]?.revisionNumber ?? 1)
  const [to, setTo] = useState<number>(revisions[0]?.revisionNumber ?? 1)
  const [viewing, setViewing] = useState<number | null>(null)
  const [confirmRollback, setConfirmRollback] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const diff = useQuery({
    queryKey: ['rules-diff', entity.id, from, to],
    queryFn: () => diffRulesRevisions(entity.id, from, to),
    enabled: from !== to,
  })
  const revision = useQuery({
    queryKey: ['rules-revision', entity.id, viewing],
    queryFn: () => getRulesRevision(entity.id, viewing as number),
    enabled: viewing !== null,
  })
  const rollback = useMutation({
    mutationFn: (target: number) => rollbackRulesEntity(entity.id, entity.headRevisionNumber, target),
    onSuccess: (result, target) => {
      setConfirmRollback(null)
      setNotice(`Rolled back to revision ${target}; published as revision ${result.entity.headRevisionNumber} (catalog ${result.catalogVersion}).`)
      setEntity(result.entity)
    },
  })

  return (
    <div className="space-y-4">
      <Section title="Revisions">
        {notice && (
          <p role="status" className="mb-2 text-sm text-blue-800">
            {notice}
          </p>
        )}
        <ErrorNotice error={rollback.error} />
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr>
              <th className="py-1">Revision</th>
              <th className="py-1">Status</th>
              <th className="py-1">Created</th>
              <th className="py-1">Published</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {revisions.map((rev) => {
              const isCurrent = rev.id === entity.currentPublishedRevisionId
              const canRollback = Boolean(rev.publishedAt) && !isCurrent
              return (
                <tr key={rev.id}>
                  <td className="py-1">
                    r{rev.revisionNumber}
                    {rev.restoredFromRevisionNumber ? <span className="text-xs text-gray-500"> (restores r{rev.restoredFromRevisionNumber})</span> : null}
                  </td>
                  <td className="py-1">
                    <Pill tone={revisionStatusTone(rev.status)}>{rev.status}</Pill>
                    {isCurrent && <span className="ml-1 text-xs text-green-700">current</span>}
                  </td>
                  <td className="py-1">
                    {formatDate(rev.createdAt)} <span className="text-xs text-gray-500">{rev.createdBy}</span>
                  </td>
                  <td className="py-1">
                    {rev.publishedAt ? (
                      <>
                        {formatDate(rev.publishedAt)}
                        {rev.catalogVersion !== null ? <span className="text-xs text-gray-500"> · catalog {rev.catalogVersion}</span> : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="space-x-2 py-1 text-right">
                    <button className="text-indigo-600 hover:text-indigo-800" onClick={() => setViewing(rev.revisionNumber)}>
                      View
                    </button>
                    {canRollback &&
                      (confirmRollback === rev.revisionNumber ? (
                        <>
                          <button
                            className={buttonClass.danger}
                            disabled={rollback.isPending}
                            onClick={() => rollback.mutate(rev.revisionNumber)}
                          >
                            Confirm rollback
                          </button>
                          <button className="text-gray-600" onClick={() => setConfirmRollback(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-red-700 hover:text-red-900 disabled:opacity-50"
                          disabled={!canPublish}
                          title={canPublish ? undefined : permissionHint('publishRules')}
                          onClick={() => setConfirmRollback(rev.revisionNumber)}
                        >
                          Roll back to this
                        </button>
                      ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      {viewing !== null && (
        <Section title={`Revision ${viewing}`} actions={<button className={buttonClass.secondary} onClick={() => setViewing(null)}>Close</button>}>
          <ErrorNotice error={revision.error} />
          {revision.data && <pre className="max-h-96 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(revision.data.data, null, 2)}</pre>}
        </Section>
      )}

      <Section title="Compare revisions">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            From
            <select className={inputClass} value={from} onChange={(e) => setFrom(Number(e.target.value))}>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.revisionNumber}>
                  r{rev.revisionNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            To
            <select className={inputClass} value={to} onChange={(e) => setTo(Number(e.target.value))}>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.revisionNumber}>
                  r{rev.revisionNumber}
                </option>
              ))}
            </select>
          </label>
        </div>
        {from === to && <p className="text-sm text-gray-500">Choose two different revisions.</p>}
        <ErrorNotice error={diff.error} />
        {diff.data &&
          (diff.data.operations.length === 0 ? (
            <p className="text-sm text-gray-500">No differences.</p>
          ) : (
            <ul className="space-y-0.5 font-mono text-xs" aria-label="Revision diff">
              {diff.data.operations.map((op, index) => (
                <li
                  key={index}
                  className={op.op === 'remove' ? 'text-red-700' : op.op === 'add' ? 'text-green-700' : 'text-amber-800'}
                >
                  {op.op} {op.path}
                  {'value' in op ? ` = ${JSON.stringify(op.value)}` : ''}
                </li>
              ))}
            </ul>
          ))}
      </Section>
    </div>
  )
}

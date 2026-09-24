import { useEffect, useState } from 'react'
import type { RulesEntityType, RulesValidationIssue, Ruleset } from '@nexus/rules-contracts'
import { inputClass } from '@/lib/ui'
import { fieldGroupsFor, getPath, issuesAt, pathKey, setPath, type FieldSpec, type RulesData } from './rulesForm'

export interface LabeledIssue extends RulesValidationIssue {
  source: 'contract' | 'server'
}

interface RulesDataFormProps {
  entityType: RulesEntityType
  ruleset: Ruleset
  data: RulesData
  onChange: (data: RulesData) => void
  issues: readonly LabeledIssue[]
  disabled?: boolean
}

/** Schema-driven editor for spell, item and monster data. */
export default function RulesDataForm({ entityType, ruleset, data, onChange, issues, disabled }: RulesDataFormProps) {
  return (
    <div className="space-y-4">
      {fieldGroupsFor(entityType, ruleset).map((group) => (
        <fieldset key={group.title} className="rounded-md border border-gray-200 p-3">
          <legend className="px-1 text-sm font-semibold text-gray-800">{group.title}</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {group.fields.map((field) => (
              <Field
                key={pathKey(field.path)}
                field={field}
                value={getPath(data, field.path)}
                onChange={(value) => onChange(setPath(data, field.path, value))}
                issues={issuesAt(issues, field.path)}
                disabled={disabled}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

interface FieldProps {
  field: FieldSpec
  value: unknown
  onChange: (value: unknown) => void
  issues: LabeledIssue[]
  disabled?: boolean
}

function Field({ field, value, onChange, issues, disabled }: FieldProps) {
  const id = `field-${pathKey(field.path)}`
  const wide = field.kind === 'textarea' || field.kind === 'json'
  const invalid = issues.length > 0
  const describedBy = invalid ? `${id}-issues` : field.hint ? `${id}-hint` : undefined
  const common = {
    id,
    disabled,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
  }

  let control
  switch (field.kind) {
    case 'text':
      control = (
        <input
          {...common}
          className={inputClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' && field.optional ? undefined : event.target.value)}
        />
      )
      break
    case 'textarea':
      control = (
        <textarea
          {...common}
          rows={5}
          className={inputClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' && field.optional ? undefined : event.target.value)}
        />
      )
      break
    case 'number':
      control = <NumberInput common={common} value={value} onChange={onChange} />
      break
    case 'boolean':
    case 'flag':
      control = (
        <input
          {...common}
          type="checkbox"
          className="h-4 w-4"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked ? true : field.kind === 'flag' ? undefined : false)}
        />
      )
      break
    case 'select':
      control = (
        <select
          {...common}
          className={inputClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
        >
          <option value="">{field.optional ? '—' : 'Choose...'}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      )
      break
    case 'list':
      control = <ListInput common={common} value={value} optional={field.optional} onChange={onChange} />
      break
    case 'json':
      control = <JsonInput common={common} value={value} onChange={onChange} />
      break
  }

  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <label htmlFor={id} className={`block text-sm font-medium ${invalid ? 'text-red-700' : 'text-gray-700'}`}>
        {field.label}
        {field.optional && <span className="font-normal text-gray-400"> (optional)</span>}
      </label>
      {control}
      {field.hint && !invalid && (
        <p id={`${id}-hint`} className="mt-0.5 break-all text-xs text-gray-500">
          {field.hint}
        </p>
      )}
      {invalid && (
        <ul id={`${id}-issues`} className="mt-0.5 space-y-0.5 text-xs text-red-700">
          {issues.map((issue, index) => (
            <li key={`${issue.source}-${pathKey(issue.path)}-${index}`}>
              {issue.path.length > 0 && pathKey(issue.path) !== pathKey(field.path) ? `${pathKey(issue.path)}: ` : ''}
              {issue.message}
              {issue.source === 'server' ? ' (server)' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type CommonProps = {
  id: string
  disabled?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

function parseNumber(text: string): number | undefined {
  return text.trim() === '' ? undefined : Number(text)
}

function NumberInput({ common, value, onChange }: { common: CommonProps; value: unknown; onChange: (value: unknown) => void }) {
  // Local text so intermediate input such as "0." or "-" is not normalized away.
  const [text, setText] = useState(() => (typeof value === 'number' ? String(value) : ''))
  useEffect(() => {
    const parsed = parseNumber(text)
    if (parsed !== undefined && Number.isNaN(parsed)) return
    if (parsed !== value) setText(typeof value === 'number' ? String(value) : '')
  }, [value, text])
  return (
    <input
      {...common}
      type="number"
      step="any"
      className={inputClass}
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        const parsed = parseNumber(event.target.value)
        if (parsed === undefined || !Number.isNaN(parsed)) onChange(parsed)
      }}
    />
  )
}

function toList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function sameList(a: unknown, b: string[]): boolean {
  return Array.isArray(a) ? a.length === b.length && a.every((item, i) => item === b[i]) : b.length === 0
}

function ListInput({
  common,
  value,
  optional,
  onChange,
}: {
  common: CommonProps
  value: unknown
  optional?: boolean
  onChange: (value: unknown) => void
}) {
  const [text, setText] = useState(() => (Array.isArray(value) ? value.join(', ') : ''))
  // Follow external changes (reload, JSON mode) without fighting the user's typing.
  useEffect(() => {
    if (!sameList(value, toList(text))) setText(Array.isArray(value) ? value.join(', ') : '')
  }, [value, text])
  return (
    <input
      {...common}
      className={inputClass}
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        const list = toList(event.target.value)
        onChange(list.length === 0 && optional ? undefined : list)
      }}
    />
  )
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  if (text.trim() === '') return { ok: true, value: undefined }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Invalid JSON' }
  }
}

const formatJson = (value: unknown) => (value === undefined ? '' : JSON.stringify(value, null, 2))

function JsonInput({ common, value, onChange }: { common: CommonProps; value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() => formatJson(value))
  const [parseError, setParseError] = useState<string | null>(null)
  useEffect(() => {
    const parsed = parseJson(text)
    if (parsed.ok && JSON.stringify(parsed.value) !== JSON.stringify(value)) {
      setText(formatJson(value))
      setParseError(null)
    }
  }, [value, text])
  return (
    <>
      <textarea
        {...common}
        rows={Math.min(14, Math.max(3, text.split('\n').length))}
        className={`${inputClass} font-mono text-xs`}
        spellCheck={false}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          const parsed = parseJson(event.target.value)
          if (parsed.ok) {
            setParseError(null)
            onChange(parsed.value)
          } else {
            setParseError(parsed.message)
          }
        }}
      />
      {parseError && <p className="mt-0.5 text-xs text-red-700">JSON not applied: {parseError}</p>}
    </>
  )
}

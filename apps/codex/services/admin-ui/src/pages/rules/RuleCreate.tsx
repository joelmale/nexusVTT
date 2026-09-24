import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  KNOWN_SOURCE_LICENSES,
  RulesEntityTypeSchema,
  RulesetSchema,
  SlugSchema,
  type RulesEntityType,
  type Ruleset,
} from '@nexus/rules-contracts'
import { createRulesEntity } from '@/lib/rulesApi'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { ErrorNotice, PageHeader, Section } from '@/components/common'
import { buttonClass, inputClass } from '@/lib/ui'
import { defaultRulesData, slugify } from './rulesForm'

export default function RuleCreate() {
  const canCreate = useCan('editRules')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [entityType, setEntityType] = useState<RulesEntityType>('spell')
  const [ruleset, setRuleset] = useState<Ruleset>('2024')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [sourceLicense, setSourceLicense] = useState<string>('homebrew')

  const effectiveSlug = slugTouched ? slug : slugify(name)
  const slugCheck = effectiveSlug ? SlugSchema.safeParse(effectiveSlug) : null
  const slugError = slugCheck && !slugCheck.success ? slugCheck.error.issues[0]?.message : null

  const create = useMutation({
    mutationFn: () =>
      createRulesEntity({
        entityType,
        ruleset,
        slug: effectiveSlug,
        data: defaultRulesData(entityType, ruleset, name.trim()),
        sourceLicense,
      }),
    onSuccess: (entity) => {
      void queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.setQueryData(['rules-entity', entity.id], entity)
      navigate(`/rules/${entity.id}`)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/rules" className="text-sm text-indigo-600">
        Back to rules
      </Link>
      <PageHeader title="New rules entity" description="Creates revision 1 as a draft. Fill in the details on the next page." />
      <Section title="Entity">
        <form onSubmit={submit} className="space-y-3" aria-label="New rules entity">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="block font-medium text-gray-700">Type</span>
              <select className={inputClass} value={entityType} onChange={(e) => setEntityType(e.target.value as RulesEntityType)}>
                {RulesEntityTypeSchema.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-medium text-gray-700">Ruleset</span>
              <select className={inputClass} value={ruleset} onChange={(e) => setRuleset(e.target.value as Ruleset)}>
                {RulesetSchema.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="block font-medium text-gray-700">Name</span>
            <input className={inputClass} value={name} required onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="block font-medium text-gray-700">Slug</span>
            <input
              className={inputClass}
              value={effectiveSlug}
              aria-invalid={Boolean(slugError) || undefined}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
            />
            <span className="block text-xs text-gray-500">Stable identifier, unique per type and ruleset. Cannot be changed later.</span>
            {slugError && <span className="block text-xs text-red-700">{slugError}</span>}
          </label>
          <label className="block space-y-1 text-sm">
            <span className="block font-medium text-gray-700">Source license</span>
            <select className={inputClass} value={sourceLicense} onChange={(e) => setSourceLicense(e.target.value)}>
              {KNOWN_SOURCE_LICENSES.map((license) => (
                <option key={license} value={license}>
                  {license}
                </option>
              ))}
            </select>
          </label>
          <ErrorNotice error={create.error} />
          <button
            type="submit"
            className={buttonClass.primary}
            disabled={!canCreate || !name.trim() || !effectiveSlug || Boolean(slugError) || create.isPending}
            title={canCreate ? undefined : permissionHint('editRules')}
          >
            {create.isPending ? 'Creating...' : 'Create draft'}
          </button>
        </form>
      </Section>
    </div>
  )
}

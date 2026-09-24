import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { diffJson } from '@nexus/rules-contracts'
import {
  fireball2014,
  invalidRulesFixtures,
  validRulesFixtures,
} from '../../../../../../../packages/rules-contracts/src/fixtures'
import RulesDataForm, { type LabeledIssue } from './RulesDataForm'
import {
  applyJsonPatch,
  defaultRulesData,
  fieldGroupsFor,
  issuesAt,
  pathKey,
  setPath,
  validateLocally,
  type RulesData,
} from './rulesForm'

afterEach(() => cleanup())

describe('client-side validation uses the shared contracts', () => {
  it.each(validRulesFixtures.map((fixture) => [fixture.name, fixture] as const))('accepts valid fixture %s', (_name, fixture) => {
    expect(validateLocally(fixture.entityType, fixture.ruleset, fixture.data)).toEqual([])
  })

  it.each(invalidRulesFixtures.map((fixture) => [fixture.name, fixture] as const))(
    'rejects invalid fixture %s at the contract path',
    (_name, fixture) => {
      const issues = validateLocally(fixture.entityType, fixture.ruleset, fixture.data)
      expect(issues.map((issue) => pathKey(issue.path))).toContain(fixture.expectedPath)
    },
  )

  it('rejects data whose ruleset differs from the entity', () => {
    const issues = validateLocally('spell', '2024', fireball2014)
    expect(issues).toEqual([expect.objectContaining({ path: ['ruleset'], code: 'ruleset_mismatch' })])
  })

  it('flags an incomplete new draft so it cannot be mistaken for publishable', () => {
    const issues = validateLocally('spell', '2014', defaultRulesData('spell', '2014', 'Spark'))
    expect(issues.map((issue) => pathKey(issue.path))).toContain('description')
  })

  it('hides 2024-only monster fields from 2014 forms', () => {
    const keys = (ruleset: '2014' | '2024') =>
      fieldGroupsFor('monster', ruleset).flatMap((group) => group.fields.map((field) => pathKey(field.path)))
    expect(keys('2014')).not.toContain('initiative')
    expect(keys('2014')).not.toContain('gear')
    expect(keys('2024')).toEqual(expect.arrayContaining(['initiative', 'habitats', 'treasure', 'gear']))
  })
})

describe('form data helpers', () => {
  it('setPath removes keys and the empty objects they leave', () => {
    const data: RulesData = { range: { kind: 'distance', distance: { value: 60 } } }
    const cleared = setPath(data, ['range', 'distance', 'value'], undefined)
    expect(cleared).toEqual({ range: { kind: 'distance' } })
    expect(data).toEqual({ range: { kind: 'distance', distance: { value: 60 } } })
  })

  it('issuesAt matches a field and its nested paths only', () => {
    const issues = [
      { path: ['components', 'materialText'], code: 'custom', message: 'a' },
      { path: ['components'], code: 'custom', message: 'b' },
      { path: ['componentsX'], code: 'custom', message: 'c' },
    ]
    expect(issuesAt(issues, ['components']).map((issue) => issue.message)).toEqual(['a', 'b'])
    expect(issuesAt(issues, ['components', 'materialText']).map((issue) => issue.message)).toEqual(['a'])
  })

  it('applyJsonPatch replays only the user changes onto a newer server revision', () => {
    const base = { name: 'Fireball', level: 3, classes: ['wizard'] }
    const mine = { name: 'Fireball', level: 4, classes: ['wizard'] }
    const server = { name: 'Fire Ball', level: 3, classes: ['wizard', 'sorcerer'] }
    expect(applyJsonPatch(server, diffJson(base, mine))).toEqual({
      name: 'Fire Ball',
      level: 4,
      classes: ['wizard', 'sorcerer'],
    })
  })
})

function Harness({ initial }: { initial: RulesData }) {
  const [data, setData] = useState(initial)
  const issues: LabeledIssue[] = validateLocally('spell', '2014', data).map((issue) => ({ ...issue, source: 'contract' }))
  return (
    <>
      <RulesDataForm entityType="spell" ruleset="2014" data={data} onChange={setData} issues={issues} />
      <output data-testid="data">{JSON.stringify(data)}</output>
    </>
  )
}

describe('RulesDataForm', () => {
  it('shows contract errors next to the field and clears them when fixed', () => {
    render(<Harness initial={{ ...fireball2014, components: { verbal: true, somatic: true, material: true } }} />)

    const material = screen.getByLabelText(/Material description/) as HTMLInputElement
    expect(material.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('material components require materialText')).toBeTruthy()

    fireEvent.change(material, { target: { value: 'A pinch of sulfur.' } })
    expect(screen.queryByText('material components require materialText')).toBeNull()
    expect(JSON.parse(screen.getByTestId('data').textContent ?? '{}').components.materialText).toBe('A pinch of sulfur.')
  })

  it('offers select options from the contract enums and edits nested numbers', () => {
    render(<Harness initial={{ ...fireball2014 }} />)
    const school = screen.getByLabelText('School') as HTMLSelectElement
    expect(Array.from(school.options).map((option) => option.value)).toEqual([
      '',
      'abjuration',
      'conjuration',
      'divination',
      'enchantment',
      'evocation',
      'illusion',
      'necromancy',
      'transmutation',
    ])

    fireEvent.change(screen.getByLabelText('Distance (optional)'), { target: { value: '' } })
    const data = JSON.parse(screen.getByTestId('data').textContent ?? '{}')
    expect(data.range.distance).toEqual({ unit: 'feet' })
    expect(screen.getByText('Required')).toBeTruthy()
  })

  it('applies JSON fields only when they parse', () => {
    render(<Harness initial={{ ...fireball2014 }} />)
    const area = screen.getByLabelText(/Area of effect/) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: '{ "shape": "cube"' } })
    expect(screen.getByText(/JSON not applied/)).toBeTruthy()
    expect(JSON.parse(screen.getByTestId('data').textContent ?? '{}').range.area).toEqual({ shape: 'sphere', size: 20 })

    fireEvent.change(area, { target: { value: '{ "shape": "cube", "size": 15 }' } })
    expect(screen.queryByText(/JSON not applied/)).toBeNull()
    expect(JSON.parse(screen.getByTestId('data').textContent ?? '{}').range.area).toEqual({ shape: 'cube', size: 15 })
  })
})

import type { ReactNode } from 'react'
import type { Item, Monster, MonsterFeature, RulesEntityType, Spell } from '@nexus/rules-contracts'

/**
 * Read-only rendering of a normalized rules entity, the way the VTT and Forge
 * present catalog content: a spell card, an item card or a monster stat block.
 */
export default function StatBlock({
  entityType,
  data,
  summary,
}: {
  entityType: RulesEntityType
  data: unknown
  summary?: string
}) {
  return (
    <article className="max-w-2xl rounded-md border-2 border-amber-700 bg-amber-50 p-4 font-serif text-gray-900" data-testid="stat-block">
      {entityType === 'spell' && <SpellCard spell={data as Spell} summary={summary} />}
      {entityType === 'item' && <ItemCard item={data as Item} summary={summary} />}
      {entityType === 'monster' && <MonsterBlock monster={data as Monster} summary={summary} />}
    </article>
  )
}

const human = (value: string) => value.replace(/_/g, ' ')

function Heading({ name, summary }: { name: string; summary?: string }) {
  return (
    <header className="mb-2 border-b border-amber-700 pb-1">
      <h3 className="text-xl font-bold text-red-900">{name}</h3>
      {summary && <p className="text-sm italic">{summary}</p>}
    </header>
  )
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm">
      <span className="font-bold">{label}</span> {children}
    </p>
  )
}

function Paragraphs({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index} className="mt-2 whitespace-pre-line text-sm">
          {paragraph}
        </p>
      ))}
    </>
  )
}

function SpellCard({ spell, summary }: { spell: Spell; summary?: string }) {
  const casting = spell.castingTime
  const castingText =
    casting.unit === 'special'
      ? casting.text ?? 'special'
      : `${casting.amount ?? 1} ${human(casting.unit)}${(casting.amount ?? 1) > 1 ? 's' : ''}${casting.trigger ? `, ${casting.trigger}` : ''}`
  const range = spell.range
  const rangeText =
    range.kind === 'distance' && range.distance
      ? `${range.distance.value} ${range.distance.unit}`
      : human(range.kind)
  const areaText = range.area ? ` (${range.area.size}-foot ${range.area.shape})` : ''
  const components = [
    spell.components.verbal ? 'V' : null,
    spell.components.somatic ? 'S' : null,
    spell.components.material ? `M${spell.components.materialText ? ` (${spell.components.materialText})` : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ')
  const duration = spell.duration
  const durationText =
    duration.kind === 'timed'
      ? `${spell.concentration ? 'Concentration, up to ' : ''}${duration.amount} ${duration.unit}${(duration.amount ?? 1) > 1 ? 's' : ''}`
      : human(duration.kind)
  return (
    <>
      <Heading name={spell.name} summary={summary} />
      <Line label="Casting Time:">{castingText}</Line>
      <Line label="Range:">
        {rangeText}
        {areaText}
      </Line>
      <Line label="Components:">{components}</Line>
      <Line label="Duration:">{durationText}</Line>
      {spell.classes.length > 0 && <Line label="Classes:">{spell.classes.map(human).join(', ')}</Line>}
      <Paragraphs text={spell.description} />
      {spell.higherLevel && (
        <p className="mt-2 text-sm">
          <span className="font-bold italic">{spell.level === 0 ? 'Cantrip Upgrade.' : 'At Higher Levels.'}</span>{' '}
          {spell.higherLevel}
        </p>
      )}
    </>
  )
}

function ItemCard({ item, summary }: { item: Item; summary?: string }) {
  const weapon = item.weapon
  const armor = item.armor
  return (
    <>
      <Heading name={item.name} summary={summary} />
      {item.cost && (
        <Line label="Cost:">
          {item.cost.amount} {item.cost.unit}
        </Line>
      )}
      {item.weight !== undefined && <Line label="Weight:">{item.weight} lb.</Line>}
      {weapon && (
        <>
          <Line label="Weapon:">
            {weapon.category} {weapon.kind}
            {weapon.bonus ? ` (+${weapon.bonus})` : ''}
          </Line>
          <Line label="Damage:">
            {weapon.damage.dice} {weapon.damage.type}
            {weapon.versatileDamage ? ` (versatile ${weapon.versatileDamage.dice})` : ''}
          </Line>
          {weapon.properties.length > 0 && <Line label="Properties:">{weapon.properties.map(human).join(', ')}</Line>}
          {weapon.range && (
            <Line label="Range:">
              {weapon.range.normal}
              {weapon.range.long ? `/${weapon.range.long}` : ''} ft.
            </Line>
          )}
          {'mastery' in weapon && weapon.mastery && <Line label="Mastery:">{weapon.mastery}</Line>}
        </>
      )}
      {armor && (
        <Line label="Armor Class:">
          {armor.category === 'shield' ? `+${armor.baseAc}` : armor.baseAc}
          {armor.dexBonus ? ` + Dex${armor.maxDexBonus !== undefined ? ` (max ${armor.maxDexBonus})` : ''}` : ''}
          {armor.strengthRequirement ? `, Str ${armor.strengthRequirement}` : ''}
          {armor.stealthDisadvantage ? ', Stealth disadvantage' : ''}
        </Line>
      )}
      {item.charges && (
        <Line label="Charges:">
          {item.charges.max}
          {item.charges.recharge ? `, regains ${item.charges.rechargeDice ?? 'all'} at ${item.charges.recharge}` : ''}
        </Line>
      )}
      {item.spells && item.spells.length > 0 && (
        <Line label="Spells:">{item.spells.map((spell) => spell.ref + (spell.chargeCost !== undefined ? ` (${spell.chargeCost} charges)` : '')).join(', ')}</Line>
      )}
      <Paragraphs text={item.text} />
    </>
  )
}

const modifier = (score: number) => {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : String(mod)
}

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value))

function formatCr(cr: number): string {
  if (cr === 0.125) return '1/8'
  if (cr === 0.25) return '1/4'
  if (cr === 0.5) return '1/2'
  return String(cr)
}

function Features({ title, features }: { title: string; features: MonsterFeature[] | undefined }) {
  if (!features || features.length === 0) return null
  return (
    <section className="mt-3">
      <h4 className="border-b border-amber-700 text-lg font-bold text-red-900">{title}</h4>
      {features.map((feature) => (
        <p key={feature.name} className="mt-1 text-sm">
          <span className="font-bold italic">
            {feature.name}
            {feature.usage?.type === 'recharge' && feature.usage.rechargeOn
              ? ` (Recharge ${feature.usage.rechargeOn}${feature.usage.rechargeOn < 6 ? '–6' : ''})`
              : feature.usage?.type === 'per_day' && feature.usage.times
                ? ` (${feature.usage.times}/Day)`
                : ''}
            .
          </span>{' '}
          {feature.description}
        </p>
      ))}
    </section>
  )
}

function MonsterBlock({ monster, summary }: { monster: Monster; summary?: string }) {
  const speeds = [
    `${monster.speed.walk} ft.`,
    monster.speed.burrow !== undefined ? `burrow ${monster.speed.burrow} ft.` : null,
    monster.speed.climb !== undefined ? `climb ${monster.speed.climb} ft.` : null,
    monster.speed.fly !== undefined ? `fly ${monster.speed.fly} ft.${monster.speed.hover ? ' (hover)' : ''}` : null,
    monster.speed.swim !== undefined ? `swim ${monster.speed.swim} ft.` : null,
  ].filter(Boolean)
  const senses = [
    monster.senses.blindsight !== undefined ? `blindsight ${monster.senses.blindsight} ft.` : null,
    monster.senses.darkvision !== undefined ? `darkvision ${monster.senses.darkvision} ft.` : null,
    monster.senses.tremorsense !== undefined ? `tremorsense ${monster.senses.tremorsense} ft.` : null,
    monster.senses.truesight !== undefined ? `truesight ${monster.senses.truesight} ft.` : null,
    `passive Perception ${monster.senses.passivePerception}`,
  ].filter(Boolean)
  const defenses = (list: Monster['damageResistances']) =>
    list.map((entry) => entry.type + (entry.qualifier ? ` ${entry.qualifier}` : '')).join(', ')
  const saves = Object.entries(monster.savingThrows ?? {})
  const skills = Object.entries(monster.skills ?? {})
  return (
    <>
      <Heading name={monster.name} summary={summary} />
      <Line label="Armor Class">
        {monster.armorClass.map((ac) => `${ac.value}${ac.source ? ` (${ac.source})` : ''}${ac.condition ? ` ${ac.condition}` : ''}`).join(', ')}
      </Line>
      <Line label="Hit Points">
        {monster.hitPoints.average} ({monster.hitPoints.formula})
      </Line>
      <Line label="Speed">{speeds.join(', ')}</Line>
      {monster.ruleset === '2024' && monster.initiative && (
        <Line label="Initiative">
          {signed(monster.initiative.modifier)} ({monster.initiative.score})
        </Line>
      )}
      <table className="my-2 w-full text-center text-sm">
        <thead>
          <tr>
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => (
              <th key={ability} className="font-bold uppercase">
                {ability}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => (
              <td key={ability}>
                {monster.abilityScores[ability]} ({modifier(monster.abilityScores[ability])})
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {saves.length > 0 && <Line label="Saving Throws">{saves.map(([key, value]) => `${key.toUpperCase()} ${signed(value as number)}`).join(', ')}</Line>}
      {skills.length > 0 && <Line label="Skills">{skills.map(([key, value]) => `${human(key)} ${signed(value as number)}`).join(', ')}</Line>}
      {monster.damageVulnerabilities.length > 0 && <Line label="Damage Vulnerabilities">{defenses(monster.damageVulnerabilities)}</Line>}
      {monster.damageResistances.length > 0 && <Line label="Damage Resistances">{defenses(monster.damageResistances)}</Line>}
      {monster.damageImmunities.length > 0 && <Line label="Damage Immunities">{defenses(monster.damageImmunities)}</Line>}
      {monster.conditionImmunities.length > 0 && <Line label="Condition Immunities">{monster.conditionImmunities.join(', ')}</Line>}
      <Line label="Senses">{senses.join(', ')}</Line>
      <Line label="Languages">{monster.languages.length > 0 ? monster.languages.join(', ') : '—'}</Line>
      <Line label="Challenge">
        {formatCr(monster.challengeRating)} ({monster.xp.toLocaleString()} XP)
        {monster.proficiencyBonus !== undefined ? `; Proficiency Bonus +${monster.proficiencyBonus}` : ''}
      </Line>
      {monster.ruleset === '2024' && monster.gear && monster.gear.length > 0 && <Line label="Gear">{monster.gear.join(', ')}</Line>}
      <Features title="Traits" features={monster.traits} />
      {monster.spellcasting?.map((block) => (
        <section key={block.name} className="mt-3 text-sm">
          <p>
            <span className="font-bold italic">{block.name}.</span> {block.description}
          </p>
          <ul className="ml-4 list-disc">
            {block.spells.map((spell) => (
              <li key={spell.ref}>
                {spell.frequency ? `${spell.frequency}: ` : ''}
                <span className="italic">{spell.ref}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Features title="Actions" features={monster.actions} />
      <Features title="Bonus Actions" features={monster.bonusActions} />
      <Features title="Reactions" features={monster.reactions} />
      {monster.legendaryActions && (
        <section className="mt-3">
          <h4 className="border-b border-amber-700 text-lg font-bold text-red-900">Legendary Actions</h4>
          {monster.legendaryActions.description && <p className="mt-1 text-sm">{monster.legendaryActions.description}</p>}
          {monster.legendaryActions.actions.map((action) => (
            <p key={action.name} className="mt-1 text-sm">
              <span className="font-bold">
                {action.name}
                {action.cost > 1 ? ` (Costs ${action.cost} Actions)` : ''}.
              </span>{' '}
              {action.description}
            </p>
          ))}
        </section>
      )}
    </>
  )
}

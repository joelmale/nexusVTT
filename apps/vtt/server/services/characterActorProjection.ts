import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type {
  ResourcePool,
  SpellcastingProfile,
  SpellDefinition,
} from '@nexus/game-contracts';
import { calculatePreparationLimit } from '@nexus/rules-5e';
import { resourcePoolSchema } from '@nexus/game-contracts';

const require = createRequire(import.meta.url);
const rawSpellCatalog: Partial<
  Record<'2014' | '2024', Record<string, unknown>[]>
> = {};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function definitionId(value: string): string {
  const hex = createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const id = hex.join('');
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/** Read the shared catalog as data: do not load the React creator in Node. */
export function bundledSpellDefinitions(
  campaignId: string,
  ownerId: string,
  edition: '2014' | '2024',
): SpellDefinition[] {
  if (!rawSpellCatalog[edition]) {
    const file = require.resolve(
      edition === '2014'
        ? '@nexus/character-creator/data/srd/2014/5e-SRD-Spells.json'
        : '@nexus/character-creator/data/srd/2024/5e-SRD-spells.json',
    );
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed))
      throw new Error('Bundled spell catalog is invalid.');
    // The 2024 file carries no edition tag; add it last so spell ids stay stable.
    rawSpellCatalog[edition] = parsed
      .map(object)
      .map((spell) =>
        edition === '2024' ? { ...spell, source: '2024' } : spell,
      );
  }
  return rawSpellCatalog[edition]!.map((spell) => {
    const name = String(spell.name);
    const key = typeof spell.index === 'string' ? spell.index : slug(name);
    const components = stringList(spell.components).map((entry) =>
      entry.toLowerCase(),
    );
    const school =
      typeof spell.school === 'string'
        ? spell.school
        : object(spell.school).name;
    return {
      id: definitionId(JSON.stringify([campaignId, edition, key, spell])),
      kind: 'spell',
      ownerId,
      name,
      slug: key,
      schemaVersion: 1,
      revision: 1,
      tags: [],
      archived: false,
      createdAt: '2026-10-24T00:00:00.000Z',
      updatedAt: '2026-10-24T00:00:00.000Z',
      ruleset: {
        system: 'dnd5e',
        edition,
        contentPackId: edition === '2024' ? 'srd-5.2.1' : 'srd-5.1',
        contentRevision: 'bundled-1',
        rulesRevision: edition,
      },
      level: Number(spell.level),
      school: String(school).toLowerCase() as SpellDefinition['school'],
      castingTime: String(
        spell.casting_time ??
          (spell.actionType === 'bonusAction'
            ? '1 bonus action'
            : spell.actionType === 'reaction'
              ? '1 reaction'
              : spell.actionType === 'action'
                ? '1 action'
                : spell.actionType) ??
          '1 action',
      ),
      range: String(spell.range ?? 'Self'),
      duration: String(spell.duration ?? 'Instantaneous'),
      concentration: spell.concentration === true,
      ritual: spell.ritual === true,
      components: {
        verbal: components.includes('v'),
        somatic: components.includes('s'),
        material: components.includes('m'),
        materialConsumed: false,
        ...(typeof spell.material === 'string'
          ? { materialDescription: spell.material }
          : {}),
      },
      description:
        typeof spell.description === 'string'
          ? spell.description
          : stringList(spell.desc).join('\n\n'),
      classes: Array.isArray(spell.classes)
        ? spell.classes
            .map((entry) =>
              typeof entry === 'string' ? entry : String(object(entry).index),
            )
            .map(slug)
        : [],
    };
  });
}

/** Adapt saved evaluated values without recalculating or resetting gameplay. */
function projectClassCasting(
  raw: unknown,
  definitions: SpellDefinition[],
): { profiles: SpellcastingProfile[]; pools: Record<string, ResourcePool> } {
  const data = object(raw);
  const casting = object(data.spellcasting);
  if (Object.keys(casting).length === 0) return { profiles: [], pools: {} };
  const classes = Array.isArray(data.classes) ? data.classes : [];
  const className = String(
    data.classSlug ?? object(classes[0]).name ?? data.class ?? 'spellcaster',
  );
  const classSlug = slug(className);
  const edition = data.edition === '2014' ? '2014' : '2024';
  const level = Number(data.level) || 1;
  const ability = String(
    casting.ability ?? 'INT',
  ).toUpperCase() as SpellcastingProfile['spellcastingAbility'];
  const abilityData = object(object(data.abilities)[ability]);
  const abilityModifier = Number(abilityData.modifier) || 0;
  const spellSlots = Array.isArray(casting.spellSlots)
    ? casting.spellSlots
    : [];
  const usedSlots = Array.isArray(casting.usedSpellSlots)
    ? casting.usedSpellSlots
    : [];
  const slots: NonNullable<ResourcePool['slots']> = {};
  spellSlots.forEach((amount, index) => {
    if (index === 0) return; // The saved creator array starts with cantrips.
    const total = Math.max(0, Number(amount) || 0);
    if (total)
      slots[String(index)] = {
        total,
        current: Math.max(0, total - (Number(usedSlots[index]) || 0)),
      };
  });
  const highestSlot = Math.max(0, ...Object.keys(slots).map(Number));
  const canonical = (entry: string): string =>
    definitions.find(
      (definition) =>
        definition.slug === entry || slug(definition.name) === slug(entry),
    )?.slug ?? slug(entry);
  const cantrips = stringList(casting.cantripsKnown).map(canonical);
  const known = [
    ...stringList(casting.spellbook),
    ...stringList(casting.spellsKnown),
  ].map(canonical);
  const prepared = stringList(casting.preparedSpells).map(canonical);
  const preparedClass =
    ['wizard', 'cleric', 'druid', 'paladin'].includes(classSlug) ||
    (edition === '2024' && classSlug === 'ranger');
  const accessible =
    preparedClass && classSlug !== 'wizard'
      ? definitions
          .filter(
            (spell) =>
              spell.classes.includes(classSlug) &&
              spell.level > 0 &&
              spell.level <= highestSlot,
          )
          .map((spell) => spell.slug)
      : known;
  const poolId = `class:${classSlug}:slots`;
  const pact = classSlug === 'warlock';
  const slotCount = Object.values(slots).reduce(
    (sum, slot) => sum + slot.total,
    0,
  );
  const remaining = Object.values(slots).reduce(
    (sum, slot) => sum + slot.current,
    0,
  );
  const pools: Record<string, ResourcePool> = {
    [poolId]: {
      id: poolId,
      name: pact ? 'Pact Magic' : 'Spell Slots',
      poolType: pact ? 'pact' : 'slots',
      slots,
      resetOn: pact ? 'short-rest' : 'long-rest',
      ...(pact ? { current: remaining, max: slotCount } : {}),
    },
  };
  return {
    pools,
    profiles: [
      {
        profileId: `class:${classSlug}`,
        name: `${className} Spellcasting`,
        sourceType: 'class',
        sourceSlug: classSlug,
        spellcastingAbility: ability,
        spellSaveDC:
          Number(casting.spellSaveDC) ||
          8 + abilityModifier + (Number(data.proficiencyBonus) || 2),
        spellAttackBonus:
          typeof casting.spellAttackBonus === 'number' &&
          Number.isFinite(casting.spellAttackBonus)
            ? casting.spellAttackBonus
            : abilityModifier + (Number(data.proficiencyBonus) || 2),
        isRitualCaster: ['wizard', 'cleric', 'druid'].includes(classSlug),
        preparationMode: preparedClass ? 'prepared' : 'known',
        preparationLimit: calculatePreparationLimit(
          classSlug,
          level,
          abilityModifier,
          edition,
        ),
        resourcePoolId: poolId,
        boundCollectionIds: [],
        knownSpellSlugs: [
          ...new Set([...cantrips, ...accessible, ...known, ...prepared]),
        ],
        preparedSpellSlugs: [
          ...new Set(preparedClass ? prepared : [...known, ...prepared]),
        ],
      },
    ],
  };
}

export function projectCharacterCasting(
  raw: unknown,
  definitions: SpellDefinition[],
) {
  const result = projectClassCasting(raw, definitions);
  const data = object(raw);
  const grants = Array.isArray(data.castingSources) ? data.castingSources : [];
  const hitDice = object(data.hitDice);
  if (
    Number.isSafeInteger(hitDice.max) &&
    Number(hitDice.max) > 0 &&
    Number.isSafeInteger(hitDice.dieType)
  ) {
    result.pools['feature:hit-dice'] = resourcePoolSchema.parse({
      id: 'feature:hit-dice',
      classResourceId: 'hit-dice',
      name: 'Hit Dice',
      poolType: 'uses',
      max: hitDice.max,
      current: hitDice.current,
      resetOn: 'long-rest',
      hitDieSize: hitDice.dieType,
      hitDieModifier: Number(object(object(data.abilities).CON).modifier) || 0,
      recovery: {
        longRest:
          object(data.ruleset).edition === '2014' || data.edition === '2014'
            ? Math.max(1, Math.floor(Number(hitDice.max) / 2))
            : 'full',
      },
    });
    const pool = result.pools['feature:hit-dice'];
    if (pool.current !== undefined && pool.current > pool.max!)
      throw new Error('Hit dice current uses exceed maximum.');
  }
  for (const value of Array.isArray(data.resources) ? data.resources : []) {
    const resource = object(value);
    if (resource.active === false) continue;
    const id = typeof resource.id === 'string' ? resource.id : '';
    if (
      !id ||
      id.length > 128 ||
      !Number.isSafeInteger(resource.maxUses) ||
      Number(resource.maxUses) < 0
    )
      throw new Error('Invalid class resource in character definition.');
    const poolId = `feature:${id}`;
    if (result.pools[poolId])
      throw new Error('Duplicate class resource in character definition.');
    result.pools[poolId] = resourcePoolSchema.parse({
      id: poolId,
      name: String(resource.name ?? id),
      poolType: 'uses',
      classResourceId: id,
      description: String(
        resource.manualRecovery ?? resource.description ?? '',
      ),
      max: resource.maxUses,
      current: resource.currentUses,
      recovery: resource.recovery,
      cooldown: resource.cooldown,
      unlimited: resource.unlimited,
      resetOn:
        resource.rechargeType === 'daily' || resource.rechargeType === 'none'
          ? 'manual'
          : resource.rechargeType,
    });
    const pool = result.pools[poolId];
    if (pool.current !== undefined && pool.current > pool.max!)
      throw new Error('Class resource current uses exceed maximum.');
  }
  for (const value of grants) {
    const grant = object(value);
    if (
      !['class', 'species', 'feat', 'subclass'].includes(
        String(grant.sourceType),
      )
    )
      continue;
    const ability = String(
      grant.ability,
    ) as SpellcastingProfile['spellcastingAbility'];
    if (!['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(ability)) continue;
    const modifier =
      Number(object(object(data.abilities)[ability]).modifier) || 0;
    const slugs = [
      ...new Set([
        ...stringList(grant.cantrips),
        ...stringList(grant.knownSpells),
        ...stringList(grant.preparedSpells),
      ]),
    ];
    const spells = definitions.filter((spell) =>
      slugs.some(
        (entry) => spell.slug === entry || slug(spell.name) === slug(entry),
      ),
    );
    for (const spell of spells) {
      const profileId = `${String(grant.id)}:${spell.slug}`;
      const boundPoolId =
        typeof grant.resourceId === 'string'
          ? `feature:${grant.resourceId}`
          : undefined;
      if (boundPoolId && !result.pools[boundPoolId])
        throw new Error('Casting grant requires its class resource counter.');
      const poolId = boundPoolId ?? `${profileId}:uses`;
      const uses = Math.max(0, Number(grant.freeUses) || 0);
      if (!boundPoolId)
        result.pools[poolId] = {
          id: poolId,
          name: `${spell.name} uses`,
          poolType: grant.atWill === true ? 'at-will' : 'uses',
          current: uses,
          max: uses,
          resetOn: 'long-rest',
        };
      const profile: SpellcastingProfile = {
        profileId,
        name: `${String(grant.sourceSlug)}: ${spell.name}`,
        sourceType: grant.sourceType as SpellcastingProfile['sourceType'],
        sourceSlug: String(grant.sourceSlug),
        spellcastingAbility: ability,
        spellSaveDC: 8 + modifier + (Number(data.proficiencyBonus) || 2),
        spellAttackBonus: modifier + (Number(data.proficiencyBonus) || 2),
        isRitualCaster: grant.ritual === true || grant.ritualOnly === true,
        ...(grant.ritualOnly === true && spell.level > 0
          ? { ritualOnly: true }
          : {}),
        preparationMode: 'innate',
        resourcePoolId: poolId,
        boundCollectionIds: [],
        knownSpellSlugs: [spell.slug],
        preparedSpellSlugs: [spell.slug],
      };
      if (spell.level === 0 || grant.atWill === true || uses > 0)
        result.profiles.push(profile);
      if (spell.level > 0 && grant.allowClassSlots === true) {
        const classPool = Object.values(result.pools).find((pool) =>
          ['slots', 'pact'].includes(pool.poolType),
        );
        if (classPool)
          result.profiles.push({
            ...profile,
            profileId: `${profileId}:slots`,
            name: `${profile.name} (spell slot)`,
            preparationMode: 'always_prepared',
            resourcePoolId: classPool.id,
          });
      }
    }
  }
  return result;
}

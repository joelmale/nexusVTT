import type { CharacterCastingSource } from '@nexus/character-contracts';
import type { AbilityName, CharacterCreationData } from '../types/dnd';
import { BACKGROUNDS, loadSpells } from './dataService';
import { choiceId, humanOriginFeat } from './originChoices';
import { INVOCATIONS_2024, invocationFeatGrants } from './invocations';

export interface CastingGrant {
  source: CharacterCastingSource;
  spellClass?: string;
  cantripChoices: number;
  spellChoices: number;
  ritualChoices?: boolean;
  chooseSpellClass?: boolean;
  spellLevel?: number;
  eligibleSpellSlugs?: string[];
}

/**
 * SRD 5.1 Life Domain Spells: always prepared, they do not count against the
 * number of spells a Cleric can prepare (so they are a separate source).
 */
const LIFE_DOMAIN_SPELLS: Array<[number, string[]]> = [
  [1, ['bless', 'cure-wounds']],
  [3, ['lesser-restoration', 'spiritual-weapon']],
  [5, ['beacon-of-hope', 'revivify']],
  [7, ['death-ward', 'guardian-of-faith']],
  [9, ['mass-cure-wounds', 'raise-dead']],
];

function legacyDomainSpellGrants(data: CharacterCreationData): CastingGrant[] {
  if (data.classSlug !== 'cleric' || data.subclassSlug !== 'life') return [];
  return [
    {
      cantripChoices: 0,
      spellChoices: 0,
      source: {
        id: 'class:cleric:life-domain',
        sourceType: 'class',
        sourceSlug: 'life-domain',
        ability: 'WIS',
        cantrips: [],
        knownSpells: [],
        preparedSpells: LIFE_DOMAIN_SPELLS.filter(
          ([level]) => data.level >= level,
        ).flatMap(([, spells]) => spells),
        allowClassSlots: true,
      },
    },
  ];
}

/** SRD 5.2.1 pp84–87: lineage and Magic Initiate grants stay separate from class lists. */
export function resolveCastingGrants(
  data: CharacterCreationData,
): CastingGrant[] {
  const classGrants = resolveClassFreeCasting(data);
  if (data.edition !== '2024')
    return [
      ...classGrants,
      ...legacyDomainSpellGrants(data),
      ...(data.additionalCastingSources ?? [])
        .filter((source) => !source.resourceId)
        .map((source) => ({
          source,
          cantripChoices: 0,
          spellChoices: 0,
        })),
    ];
  const catalog = loadSpells(data.edition);
  const abilities: AbilityName[] = ['INT', 'WIS', 'CHA'];
  const ability = [...abilities].sort(
    (a, b) => data.abilities[b] - data.abilities[a],
  )[0];
  const result: CastingGrant[] = [...classGrants];
  const background = BACKGROUNDS.find(
    (entry) =>
      entry.edition === data.edition &&
      (entry.slug === data.background ||
        entry.slug === `${data.background}-${data.edition}`),
  );
  const backgroundFeat =
    background?.originFeat === 'magic-initiate'
      ? `magic-initiate-${background.slug.startsWith('acolyte') ? 'cleric' : 'wizard'}`
      : background?.originFeat;
  const feats = new Set(
    [
      backgroundFeat,
      data.originFeat === background?.originFeat ? undefined : data.originFeat,
      data.speciesSlug === 'human-2024'
        ? humanOriginFeat(data)
        : data.speciesFeat,
      ...(data.selectedFeats ?? []),
      ...invocationFeatGrants(data),
    ].filter((feat): feat is string => Boolean(feat)),
  );
  for (const feat of feats) {
    if (!feat.startsWith('magic-initiate')) continue;
    const choice = data.featChoices?.['magic-initiate']?.spellList;
    const spellClass =
      ['cleric', 'druid', 'wizard'].find((name) => feat.includes(name)) ??
      (typeof choice === 'string' &&
      ['cleric', 'druid', 'wizard'].includes(choice)
        ? choice
        : (['wizard', 'cleric', 'druid'].find(
            (candidate) =>
              !result.some((grant) => grant.spellClass === candidate),
          ) ?? 'wizard'));
    const chooseSpellClass = feat === 'magic-initiate';
    const id = `feat:magic-initiate:${chooseSpellClass ? 'chosen:' : ''}${spellClass}`;
    if (result.some((grant) => grant.source.id === id)) continue;
    const existing = data.additionalCastingSources?.find(
      (source) => source.id === id,
    );
    const spells = catalog.filter((spell) =>
      spell.classes.includes(spellClass),
    );
    const preferredSpell =
      spellClass === 'cleric'
        ? 'healing-word'
        : spellClass === 'druid'
          ? 'cure-wounds'
          : 'shield';
    const defaultSpell =
      spells.find((spell) => spell.slug === preferredSpell)?.slug ??
      spells.find((spell) => spell.level === 1)?.slug;
    result.push({
      spellClass,
      chooseSpellClass,
      cantripChoices: 2,
      spellChoices: 1,
      source: {
        id,
        sourceType: 'feat',
        sourceSlug: `magic-initiate-${spellClass}`,
        ability: existing?.ability ?? ability,
        cantrips:
          existing?.cantrips ??
          spells
            .filter((spell) => spell.level === 0)
            .slice(0, 2)
            .map((spell) => spell.slug),
        knownSpells: [],
        preparedSpells:
          existing?.preparedSpells ?? (defaultSpell ? [defaultSpell] : []),
        freeUses: 1,
        allowClassSlots: true,
      },
    });
  }
  if (data.speciesSlug === 'elf-2024' && data.selectedLineage) {
    const lineage = choiceId(data.selectedLineage).replace(/-lineage$/, '');
    if (!['wood-elf', 'high-elf', 'drow'].includes(lineage)) return result;
    const id = `species:elf:${lineage}`;
    const existing = data.additionalCastingSources?.find(
      (source) => source.id === id,
    );
    const spells =
      lineage === 'wood-elf'
        ? ['longstrider', 'pass-without-trace']
        : lineage === 'drow'
          ? ['faerie-fire', 'darkness']
          : ['detect-magic', 'misty-step'];
    const prepared = spells.filter(
      (_, index) => data.level >= (index === 0 ? 3 : 5),
    );
    const cantrip =
      lineage === 'wood-elf'
        ? 'druidcraft'
        : lineage === 'drow'
          ? 'dancing-lights'
          : 'prestidigitation';
    result.push({
      spellClass: lineage === 'high-elf' ? 'wizard' : undefined,
      cantripChoices: lineage === 'high-elf' ? 1 : 0,
      spellChoices: 0,
      source: {
        id,
        sourceType: 'species',
        sourceSlug: lineage,
        ability: existing?.ability ?? ability,
        cantrips:
          lineage === 'high-elf'
            ? (existing?.cantrips ?? [cantrip])
            : [cantrip],
        knownSpells: [],
        preparedSpells: prepared,
        freeUses: 1,
        allowClassSlots: true,
      },
    });
  }
  if (data.speciesSlug === 'gnome-2024' && data.selectedLineage) {
    // SRD 5.2.1 p85: Gnomish Lineage. Intelligence, Wisdom or Charisma is the
    // casting ability, chosen when the lineage is selected.
    const lineage = choiceId(data.selectedLineage).replace(/-gnome$/, '');
    if (['forest', 'rock'].includes(lineage)) {
      const id = `species:gnome:${lineage}`;
      const existing = data.additionalCastingSources?.find(
        (source) => source.id === id,
      );
      const proficiencyBonus = 2 + Math.floor((data.level - 1) / 4);
      result.push({
        cantripChoices: 0,
        spellChoices: 0,
        source: {
          id,
          sourceType: 'species',
          sourceSlug: `${lineage}-gnome`,
          ability: existing?.ability ?? ability,
          cantrips:
            lineage === 'forest'
              ? ['minor-illusion']
              : ['mending', 'prestidigitation'],
          knownSpells: [],
          // Forest Gnome always has Speak with Animals prepared and may cast it
          // Proficiency Bonus times per Long Rest, or with a spell slot.
          preparedSpells: lineage === 'forest' ? ['speak-with-animals'] : [],
          ...(lineage === 'forest'
            ? { freeUses: proficiencyBonus, allowClassSlots: true }
            : {}),
        },
      });
    }
  }

  if (data.classSlug === 'druid')
    result.push({
      cantripChoices: 0,
      spellChoices: 0,
      source: {
        id: 'class:druid:druidic',
        sourceType: 'class',
        sourceSlug: 'druidic',
        ability: 'WIS',
        cantrips: [],
        knownSpells: [],
        preparedSpells: ['speak-with-animals'],
        allowClassSlots: true,
      },
    });
  if (data.classSlug === 'warlock') {
    for (const id of data.eldritchInvocations ?? []) {
      const invocation = INVOCATIONS_2024.find((entry) => entry.id === id);
      if (invocation?.spell && data.level >= invocation.level)
        result.push({
          cantripChoices: 0,
          spellChoices: 0,
          source: {
            id: `class:warlock:${id}`,
            sourceType: 'class',
            sourceSlug: id,
            ability: 'CHA',
            cantrips: [],
            knownSpells: [],
            preparedSpells: [invocation.spell],
            atWill: true,
          },
        });
      if (id === 'pact-of-the-tome') {
        const sourceId = 'class:warlock:pact-of-the-tome';
        const existing = data.additionalCastingSources?.find(
          (source) => source.id === sourceId,
        );
        const classSpells = [
          ...(data.spellSelection?.selectedCantrips ?? []),
          ...(data.spellSelection?.knownSpells ?? []),
          ...(data.spellSelection?.preparedSpells ?? []),
        ];
        const candidates = catalog.filter(
          (spell) => !classSpells.includes(spell.slug),
        );
        result.push({
          cantripChoices: 3,
          spellChoices: 2,
          ritualChoices: true,
          source: {
            id: sourceId,
            sourceType: 'class',
            sourceSlug: id,
            ability: 'CHA',
            cantrips:
              existing?.cantrips ??
              candidates
                .filter((spell) => spell.level === 0)
                .slice(0, 3)
                .map((spell) => spell.slug),
            knownSpells: [],
            preparedSpells:
              existing?.preparedSpells ??
              candidates
                .filter((spell) => spell.level === 1 && spell.ritual)
                .slice(0, 2)
                .map((spell) => spell.slug),
            atWill: true,
            ritualOnly: true,
          },
        });
      }
    }
  }
  return result;
}

export function castingGrantErrors(data: CharacterCreationData): string[] {
  const catalog = loadSpells(data.edition);
  const grants = resolveCastingGrants(data);
  const unsupported = (data.additionalCastingSources ?? [])
    .filter((source) => !grants.some((grant) => grant.source.id === source.id))
    .map(
      (source) =>
        `Casting source '${source.sourceSlug}' requires review after changing character choices.`,
    );
  return [
    ...(data.classSlug === 'wizard' &&
    data.level >= 20 &&
    new Set(
      grants
        .filter((grant) =>
          grant.source.resourceId?.startsWith('signature-spell-'),
        )
        .flatMap((grant) => grant.source.preparedSpells),
    ).size !== 2
      ? ['Choose two different Signature Spells from your spellbook.']
      : []),
    ...unsupported,
    ...(grants
      .filter((grant) => grant.chooseSpellClass)
      .some((grant) =>
        grants.some(
          (other) =>
            other !== grant &&
            other.spellClass === grant.spellClass &&
            other.source.sourceType === 'feat',
        ),
      )
      ? ['Choose different spell lists for repeated Magic Initiate grants.']
      : []),
    ...grants.flatMap(
      ({
        source,
        spellClass,
        cantripChoices,
        spellChoices,
        ritualChoices,
        spellLevel = 1,
        eligibleSpellSlugs,
      }) => {
        const errors: string[] = [];
        if (
          eligibleSpellSlugs &&
          source.preparedSpells.some(
            (slug) => !eligibleSpellSlugs.includes(slug),
          )
        )
          errors.push('Choose Signature Spells from your spellbook.');
        if (!['INT', 'WIS', 'CHA'].includes(source.ability))
          errors.push(
            `Choose a mental casting ability for ${source.sourceSlug}.`,
          );
        if (
          cantripChoices &&
          (source.cantrips.length !== cantripChoices ||
            new Set(source.cantrips).size !== cantripChoices)
        )
          errors.push(
            `Choose ${cantripChoices} different cantrips for ${source.sourceSlug}.`,
          );
        if (
          spellChoices &&
          (source.preparedSpells.length !== spellChoices ||
            new Set(source.preparedSpells).size !== spellChoices)
        )
          errors.push(
            `Choose ${spellChoices} different level ${spellLevel} spells for ${source.sourceSlug}.`,
          );
        if (
          ritualChoices &&
          source.preparedSpells.some(
            (slug) => !catalog.find((spell) => spell.slug === slug)?.ritual,
          )
        )
          errors.push('Pact of the Tome grants level 1 rituals only.');
        if (
          ritualChoices &&
          [...source.cantrips, ...source.preparedSpells].some((slug) =>
            [
              ...(data.spellSelection?.selectedCantrips ?? []),
              ...(data.spellSelection?.knownSpells ?? []),
              ...(data.spellSelection?.preparedSpells ?? []),
            ].includes(slug),
          )
        )
          errors.push(
            'Choose Tome spells you do not already have prepared from your class.',
          );
        for (const [slugs, level] of [
          [source.cantrips, 0],
          [
            spellChoices || source.resourceId ? source.preparedSpells : [],
            spellLevel,
          ],
        ] as const) {
          if (
            slugs.some(
              (slug) =>
                !catalog.some(
                  (spell) =>
                    spell.slug === slug &&
                    spell.level === level &&
                    (!spellClass || spell.classes.includes(spellClass)),
                ),
            )
          )
            errors.push(
              `Choose available ${source.sourceSlug} spells from its own spell list.`,
            );
        }
        return errors;
      },
    ),
  ];
}

/** SRD class grants use the same counter as the saved sheet and campaign actor. */
export function resolveClassFreeCasting(
  data: CharacterCreationData,
): CastingGrant[] {
  const result: CastingGrant[] = [];
  const add = (
    resourceId: string,
    spellLevel: number,
    ability: 'INT' | 'WIS' | 'CHA',
    fixed?: string,
    freeUses = 1,
    allowClassSlots = false,
  ) => {
    const id = `class:${data.classSlug}:${resourceId}`;
    const existing = data.additionalCastingSources?.find(
      (source) => source.id === id,
    );
    result.push({
      spellClass: data.classSlug,
      spellLevel,
      cantripChoices: 0,
      spellChoices: fixed ? 0 : 1,
      eligibleSpellSlugs: resourceId.startsWith('signature-spell-')
        ? (data.spellSelection.spellbook ?? [])
        : undefined,
      source: {
        id,
        sourceType: 'class',
        sourceSlug: resourceId,
        ability,
        cantrips: [],
        knownSpells: [],
        preparedSpells: fixed
          ? [
              loadSpells(data.edition).find(
                (spell) => spell.slug.replace(/['’]/g, '') === fixed,
              )?.slug ?? fixed,
            ]
          : (existing?.preparedSpells ?? []),
        resourceId,
        freeUses,
        allowClassSlots,
      },
    });
  };
  if (data.classSlug === 'warlock')
    for (const [level, gainedAt] of [
      [6, 11],
      [7, 13],
      [8, 15],
      [9, 17],
    ])
      if (data.level >= gainedAt) add(`mystic-arcanum-${level}`, level, 'CHA');
  if (data.classSlug === 'wizard' && data.level >= 20)
    for (const index of [1, 2])
      add(`signature-spell-${index}`, 3, 'INT', undefined, 1, true);
  if (data.edition === '2024' && data.classSlug === 'paladin') {
    if (data.level >= 2)
      add('paladins-smite', 1, 'CHA', 'divine-smite', 1, true);
    if (data.level >= 5) add('faithful-steed', 2, 'CHA', 'find-steed', 1, true);
  }
  if (data.edition === '2024' && data.classSlug === 'ranger')
    add(
      'favored-enemy',
      1,
      'WIS',
      'hunters-mark',
      data.level >= 17
        ? 6
        : data.level >= 13
          ? 5
          : data.level >= 9
            ? 4
            : data.level >= 5
              ? 3
              : 2,
      true,
    );
  return result;
}

export function classFreeCastingErrors(data: CharacterCreationData): string[] {
  const grants = resolveClassFreeCasting(data);
  const catalog = loadSpells(data.edition);
  const errors: string[] = [];
  for (const grant of grants) {
    if (
      grant.source.preparedSpells.length !== 1 ||
      !catalog.some(
        (spell) =>
          spell.slug === grant.source.preparedSpells[0] &&
          spell.level === grant.spellLevel &&
          spell.classes.includes(data.classSlug),
      )
    )
      errors.push(`Choose an eligible spell for ${grant.source.sourceSlug}.`);
    if (
      grant.eligibleSpellSlugs &&
      grant.source.preparedSpells.some(
        (slug) => !grant.eligibleSpellSlugs!.includes(slug),
      )
    )
      errors.push('Choose Signature Spells from your spellbook.');
  }
  const signatures = grants.filter((grant) =>
    grant.source.resourceId?.startsWith('signature-spell-'),
  );
  if (
    signatures.length &&
    new Set(signatures.flatMap((grant) => grant.source.preparedSpells)).size !==
      2
  )
    errors.push('Choose two different Signature Spells.');
  return errors;
}

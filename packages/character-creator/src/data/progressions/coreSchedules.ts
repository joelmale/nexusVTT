import legacyFeatures from '../srd/2014/5e-SRD-Features.json';
import type {
  ClassProgression,
  ClassLevelFeature,
  FeatureChoice,
} from '../classProgression';

/** SRD 5.2.1 class feature tables, printed pp28,31,36,41,47,50,53,58,62,65,71,77.
 * Sparse levels with no new named feature are intentional. Counts and recovery
 * come from classResources; this registry never invents ability-based maxima. */
const REVISED: Record<string, Record<number, string>> = {
  barbarian: {
    1: 'Rage|Unarmored Defense|Weapon Mastery',
    2: 'Danger Sense|Reckless Attack',
    3: 'Barbarian Subclass|Primal Knowledge',
    5: 'Extra Attack|Fast Movement',
    6: 'Subclass feature',
    7: 'Feral Instinct|Instinctive Pounce',
    9: 'Brutal Strike',
    10: 'Subclass feature',
    11: 'Relentless Rage',
    13: 'Improved Brutal Strike',
    14: 'Subclass feature',
    15: 'Persistent Rage',
    17: 'Improved Brutal Strike',
    18: 'Indomitable Might',
    20: 'Primal Champion',
  },
  bard: {
    1: 'Bardic Inspiration|Spellcasting',
    2: 'Expertise|Jack of All Trades',
    3: 'Bard Subclass',
    5: 'Font of Inspiration',
    6: 'Subclass feature',
    7: 'Countercharm',
    9: 'Expertise',
    10: 'Magical Secrets',
    14: 'Subclass feature',
    18: 'Superior Inspiration',
    20: 'Words of Creation',
  },
  cleric: {
    1: 'Spellcasting|Divine Order',
    2: 'Channel Divinity',
    3: 'Cleric Subclass',
    5: 'Sear Undead',
    6: 'Subclass feature',
    7: 'Blessed Strikes',
    10: 'Divine Intervention',
    14: 'Improved Blessed Strikes',
    17: 'Subclass feature',
    20: 'Greater Divine Intervention',
  },
  druid: {
    1: 'Spellcasting|Druidic|Primal Order',
    2: 'Wild Shape|Wild Companion',
    3: 'Druid Subclass',
    5: 'Wild Resurgence',
    6: 'Subclass feature',
    7: 'Elemental Fury',
    10: 'Subclass feature',
    14: 'Subclass feature',
    15: 'Improved Elemental Fury',
    18: 'Beast Spells',
    20: 'Archdruid',
  },
  fighter: {
    1: 'Fighting Style|Second Wind|Weapon Mastery',
    2: 'Action Surge|Tactical Mind',
    3: 'Fighter Subclass',
    5: 'Extra Attack|Tactical Shift',
    7: 'Subclass feature',
    9: 'Indomitable|Tactical Master',
    10: 'Subclass feature',
    11: 'Two Extra Attacks',
    13: 'Indomitable|Studied Attacks',
    15: 'Subclass feature',
    17: 'Action Surge|Indomitable',
    18: 'Subclass feature',
    20: 'Three Extra Attacks',
  },
  monk: {
    1: 'Martial Arts|Unarmored Defense',
    2: "Monk's Focus|Unarmored Movement|Uncanny Metabolism",
    3: 'Deflect Attacks|Monk Subclass',
    4: 'Slow Fall',
    5: 'Extra Attack|Stunning Strike',
    6: 'Empowered Strikes|Subclass feature',
    7: 'Evasion',
    9: 'Acrobatic Movement',
    10: 'Heightened Focus|Self-Restoration',
    11: 'Subclass feature',
    13: 'Deflect Energy',
    14: 'Disciplined Survivor',
    15: 'Perfect Focus',
    17: 'Subclass feature',
    18: 'Superior Defense',
    20: 'Body and Mind',
  },
  paladin: {
    1: 'Lay on Hands|Spellcasting|Weapon Mastery',
    2: "Fighting Style|Paladin's Smite",
    3: 'Channel Divinity|Paladin Subclass',
    5: 'Extra Attack|Faithful Steed',
    6: 'Aura of Protection',
    7: 'Subclass feature',
    9: 'Abjure Foes',
    10: 'Aura of Courage',
    11: 'Radiant Strikes',
    14: 'Restoring Touch',
    15: 'Subclass feature',
    18: 'Aura Expansion',
    20: 'Subclass feature',
  },
  ranger: {
    1: 'Spellcasting|Favored Enemy|Weapon Mastery',
    2: 'Deft Explorer|Fighting Style',
    3: 'Ranger Subclass',
    5: 'Extra Attack',
    6: 'Roving',
    7: 'Subclass feature',
    9: 'Expertise',
    10: 'Tireless',
    11: 'Subclass feature',
    13: 'Relentless Hunter',
    14: "Nature's Veil",
    15: 'Subclass feature',
    17: 'Precise Hunter',
    18: 'Feral Senses',
    20: 'Foe Slayer',
  },
  rogue: {
    1: "Expertise|Sneak Attack|Thieves' Cant|Weapon Mastery",
    2: 'Cunning Action',
    3: 'Rogue Subclass|Steady Aim',
    5: 'Cunning Strike|Uncanny Dodge',
    6: 'Expertise',
    7: 'Evasion|Reliable Talent',
    9: 'Subclass feature',
    11: 'Improved Cunning Strike',
    13: 'Subclass feature',
    14: 'Devious Strikes',
    15: 'Slippery Mind',
    17: 'Subclass feature',
    18: 'Elusive',
    20: 'Stroke of Luck',
  },
  sorcerer: {
    1: 'Spellcasting|Innate Sorcery',
    2: 'Font of Magic|Metamagic',
    3: 'Sorcerer Subclass',
    5: 'Sorcerous Restoration',
    6: 'Subclass feature',
    7: 'Sorcery Incarnate',
    10: 'Metamagic',
    14: 'Subclass feature',
    17: 'Metamagic',
    18: 'Subclass feature',
    20: 'Arcane Apotheosis',
  },
  wizard: {
    1: 'Spellcasting|Ritual Adept|Arcane Recovery',
    2: 'Scholar',
    3: 'Wizard Subclass',
    5: 'Memorize Spell',
    6: 'Subclass feature',
    10: 'Subclass feature',
    14: 'Subclass feature',
    18: 'Spell Mastery',
    20: 'Signature Spells',
  },
};
const HIT_DICE: Record<string, string> = {
  barbarian: 'd12',
  fighter: 'd10',
  paladin: 'd10',
  ranger: 'd10',
  bard: 'd8',
  cleric: 'd8',
  druid: 'd8',
  monk: 'd8',
  rogue: 'd8',
  warlock: 'd8',
  sorcerer: 'd6',
  wizard: 'd6',
};
const LEGACY_SUBCLASS: Record<string, number> = {
  cleric: 1,
  sorcerer: 1,
  warlock: 1,
  druid: 2,
  wizard: 2,
};
export function classAsiLevels(
  classSlug: string,
  edition: '2014' | '2024',
): number[] {
  const levels =
    classSlug === 'fighter'
      ? [4, 6, 8, 12, 14, 16]
      : classSlug === 'rogue'
        ? [4, 8, 10, 12, 16]
        : [4, 8, 12, 16];
  return edition === '2014' ? [...levels, 19] : levels;
}
function choices(
  name: string,
  classSlug: string,
  level: number,
  edition: '2014' | '2024',
): FeatureChoice[] {
  if (name === 'Ability Score Improvement')
    return [
      {
        type: 'asi',
        description: 'Increase abilities or choose an eligible feat.',
        count: 2,
      },
    ];
  if (name === 'Epic Boon')
    return [
      {
        type: 'feat',
        description: 'Choose an eligible Epic Boon or other feat.',
        count: 1,
      },
    ];
  if (
    /Subclass$|^(Martial Archetype|Divine Domain|Druid Circle|Bard College|Sorcerous Origin|Otherworldly Patron|Arcane Tradition|Sacred Oath|Ranger Archetype|Monastic Tradition|Roguish Archetype)$/.test(
      name,
    )
  )
    return [
      {
        type: 'subclass',
        description: 'Choose an eligible subclass for this edition.',
        count: 1,
      },
    ];
  if (name === 'Fighting Style')
    return [
      {
        type: 'fighting-style',
        description: 'Choose an eligible fighting style.',
        count: 1,
      },
    ];
  if (name === 'Metamagic')
    return [
      {
        type: 'metamagic',
        description: 'Choose Metamagic options.',
        count: edition === '2024' || level === 3 ? 2 : 1,
      },
    ];
  if (name === 'Scholar' || name === 'Expertise')
    return [
      {
        type: 'skill-expertise',
        description: 'Choose proficient skills for Expertise.',
        count: name === 'Scholar' ? 1 : 2,
      },
    ];
  if (name === 'Spell Mastery')
    return [
      {
        type: 'spell-mastery',
        description: 'Choose eligible level-one and level-two spells.',
        count: 2,
      },
    ];
  if (name === 'Signature Spells')
    return [
      {
        type: 'signature-spells',
        description: 'Choose two level-three spells.',
        count: 2,
      },
    ];
  if (name === 'Pact Boon')
    return [
      { type: 'pact-boon', description: 'Choose a Pact Boon.', count: 1 },
    ];
  if (classSlug === 'warlock' && name === 'Eldritch Invocations')
    return [
      {
        type: 'invocation',
        description: 'Choose eligible invocations.',
        count: 2,
      },
    ];
  return [];
}

export function coreClassProgression(
  classSlug: string,
  edition: '2014' | '2024',
): ClassProgression | null {
  if (!HIT_DICE[classSlug] || (edition === '2024' && !REVISED[classSlug]))
    return null;
  const name = classSlug[0].toUpperCase() + classSlug.slice(1);
  const asiLevels = classAsiLevels(classSlug, edition);
  let features: ClassLevelFeature[];
  if (edition === '2014') {
    features = legacyFeatures
      .filter(
        (feature) =>
          feature.class.index === classSlug &&
          !('subclass' in feature) &&
          !feature.index.startsWith(`${classSlug}-fighting-style-`) &&
          !feature.index.startsWith('eldritch-invocation-') &&
          ![
            'pact-of-the-chain',
            'pact-of-the-blade',
            'pact-of-the-tome',
          ].includes(feature.index),
      )
      .map((feature) => {
        const required = choices(
          feature.name,
          classSlug,
          feature.level,
          edition,
        );
        return {
          level: feature.level,
          name: feature.name,
          description: feature.desc.join('\n'),
          automatic: !required.length,
          ...(required.length ? { choices: required } : {}),
        };
      });
    if (classSlug === 'warlock')
      for (const level of [5, 7, 9, 12, 15, 18])
        features.push({ level, name: 'Additional Eldritch Invocation', description: 'SRD 5.1 Warlock table: learn one additional eligible invocation.', automatic: false,
          choices: [{ type: 'invocation', description: 'Choose one additional legacy invocation.', count: 1 }],
        });
  } else {
    features = Object.entries(REVISED[classSlug]).flatMap(([at, names]) =>
      names.split('|').map((feature) => {
        const level = Number(at);
        const required = choices(feature, classSlug, level, edition);
        return {
          level,
          name: feature,
          description: `${feature}. See SRD 5.2.1, ${name} class features.`,
          automatic: !required.length,
          ...(required.length ? { choices: required } : {}),
        };
      }),
    );
    for (const level of asiLevels)
      features.push({
        level,
        name: 'Ability Score Improvement',
        description: 'Choose an ability increase or eligible feat.',
        automatic: false,
        choices: choices(
          'Ability Score Improvement',
          classSlug,
          level,
          edition,
        ),
      });
    features.push({
      level: 19,
      name: 'Epic Boon',
      description: 'Choose an eligible Epic Boon or other feat.',
      automatic: false,
      choices: choices('Epic Boon', classSlug, 19, edition),
    });
  }
  return {
    classSlug,
    className: name,
    edition,
    hitDie: HIT_DICE[classSlug],
    asiLevels,
    subclassLevel: edition === '2024' ? 3 : (LEGACY_SUBCLASS[classSlug] ?? 3),
    features: features.sort((a, b) => a.level - b.level),
  };
}

import type { CharacterResource } from '@nexus/character-contracts';
import type { Character } from '../types/dnd';
import { ARTIFICER_LEGACY_ITEMS } from '../data/progressions/artificer2014';

type ResourceOwner = Pick<
  Character,
  'class' | 'classSlug' | 'edition' | 'level' | 'abilities' | 'subclass'
>;
type Recovery = NonNullable<CharacterResource['recovery']>;
const LONG: Recovery = { longRest: 'full' };
const BOTH: Recovery = { shortRest: 'full', longRest: 'full' };
const PARTIAL: Recovery = { shortRest: 1, longRest: 'full' };

/** Core class counters from SRD 5.1 class sections and SRD 5.2.1 pp27–81.
 * Spell slots are owned by the casting ledger, never duplicated here.
 * Conditional restoration requires an explicit action, not an automatic rest. */
export function classResourceDefinitions(
  owner: ResourceOwner,
): CharacterResource[] {
  const { level, edition } = owner;
  if (!Number.isInteger(level) || level < 1 || level > 20) return [];
  const classSlug = (owner.classSlug || owner.class).toLowerCase();
  const revised = edition === '2024';
  const charisma = Math.max(1, owner.abilities.CHA?.modifier ?? 0);
  const intelligence = Math.max(1, owner.abilities.INT?.modifier ?? 0);
  const wisdom = Math.max(1, owner.abilities.WIS?.modifier ?? 0);
  const resources: CharacterResource[] = [];
  const add = (
    id: string,
    name: string,
    gainedAt: number,
    maxUses: number,
    recovery: Recovery,
    extra: Partial<CharacterResource> = {},
  ) => {
    if (level < gainedAt) return;
    resources.push({
      id,
      name,
      description: `${name} — ${classSlug} class resource.`,
      maxUses,
      rechargeType:
        recovery.shortRest === 'full'
          ? 'short-rest'
          : recovery.longRest
            ? 'long-rest'
            : 'daily',
      recovery,
      provenance: {
        classSlug,
        edition,
        gainedAt,
        source:
          classSlug === 'artificer'
            ? 'Legacy Artificer: https://dnd5e.wikidot.com/artificer'
            : revised
              ? 'SRD 5.2.1'
              : 'SRD 5.1',
      },
      ...extra,
    });
  };
  const conditional = (
    id: string,
    name: string,
    gainedAt: number,
    note: string,
  ) => add(id, name, gainedAt, 1, LONG, { manualRecovery: note });
  switch (classSlug) {
    case 'artificer':
      if (!revised) {
        add(
          'magical-tinkering-capacity',
          'Magical Tinkering object capacity',
          1,
          intelligence,
          {},
          {
            rechargeType: 'none',
            manualRecovery:
              'Tracks unassigned object capacity. Ending an effect releases capacity; a rest does not end existing effects.',
          },
        );
        add(
          'infused-item-capacity',
          'Infused item capacity',
          2,
          ARTIFICER_LEGACY_ITEMS[level - 1],
          {},
          {
            rechargeType: 'none',
            manualRecovery:
              'Tracks capacity, not daily charges. Record infusions and their assigned items; replacing an infusion ends its prior item effect.',
          },
        );
        add('flash-of-genius', 'Flash of Genius', 7, intelligence, LONG);
        add(
          'spell-storing-item',
          'Spell-Storing Item uses',
          11,
          intelligence * 2,
          {},
          {
            rechargeType: 'none',
            manualRecovery:
              'Choose and store an eligible spell after a long rest, then explicitly record the item uses. Resting alone does not create or replace a stored spell.',
          },
        );
      }
      break;
    case 'barbarian':
      add(
        'rage',
        'Rage',
        1,
        level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2,
        revised ? PARTIAL : LONG,
        { unlimited: !revised && level === 20 },
      );
      if (revised)
        conditional(
          'persistent-rage',
          'Persistent Rage recovery',
          15,
          'Activate at initiative to restore Rage; not triggered by resting.',
        );
      break;
    case 'bard':
      add(
        'bardic-inspiration',
        'Bardic Inspiration',
        1,
        charisma,
        level >= 5 ? BOTH : LONG,
      );
      break;
    case 'fighter':
      add(
        'second-wind',
        'Second Wind',
        1,
        revised ? (level >= 10 ? 4 : level >= 4 ? 3 : 2) : 1,
        revised ? PARTIAL : BOTH,
      );
      add('action-surge', 'Action Surge', 2, level >= 17 ? 2 : 1, BOTH);
      add(
        'indomitable',
        'Indomitable',
        9,
        level >= 17 ? 3 : level >= 13 ? 2 : 1,
        LONG,
      );
      break;
    case 'cleric':
      add(
        'channel-divinity',
        'Channel Divinity',
        2,
        revised
          ? level >= 18
            ? 4
            : level >= 6
              ? 3
              : 2
          : level >= 18
            ? 3
            : level >= 6
              ? 2
              : 1,
        revised ? PARTIAL : BOTH,
      );
      add(
        'divine-intervention',
        'Divine Intervention',
        10,
        1,
        revised ? LONG : {},
        {
          manualRecovery: revised
            ? 'Wish at level 20 imposes a rolled multi-rest cooldown; record that cooldown manually.'
            : 'Track attempt and successful-intervention cooldown manually; success prevents use for seven days.',
        },
      );
      break;
    case 'druid':
      add(
        'wild-shape',
        'Wild Shape',
        2,
        revised ? (level >= 17 ? 4 : level >= 6 ? 3 : 2) : 2,
        revised ? PARTIAL : BOTH,
        { unlimited: !revised && level === 20 },
      );
      if (revised)
        conditional(
          'wild-resurgence',
          'Wild Resurgence slot recovery',
          5,
          'One conversion of Wild Shape to a level-one spell slot per long rest; apply the paired changes explicitly.',
        );
      break;
    case 'monk':
      add(
        revised ? 'focus-points' : 'ki-points',
        revised ? 'Focus Points' : 'Ki Points',
        2,
        level,
        BOTH,
      );
      if (revised)
        conditional(
          'uncanny-metabolism',
          'Uncanny Metabolism',
          2,
          'Activate at initiative; restoring Focus and rolling healing are separate explicit actions.',
        );
      break;
    case 'paladin':
      add('lay-on-hands', 'Lay on Hands', 1, 5 * level, LONG);
      if (!revised) add('divine-sense', 'Divine Sense', 1, charisma + 1, LONG);
      add(
        'channel-divinity',
        'Channel Divinity',
        3,
        revised ? (level >= 11 ? 3 : 2) : 1,
        revised ? PARTIAL : BOTH,
      );
      if (revised) {
        add('paladins-smite', "Paladin's Smite free casting", 2, 1, LONG);
        add('faithful-steed', 'Faithful Steed free casting', 5, 1, LONG);
      } else add('cleansing-touch', 'Cleansing Touch', 14, charisma, LONG);
      break;
    case 'ranger':
      if (revised) {
        add(
          'favored-enemy',
          "Hunter's Mark free casting",
          1,
          level >= 17
            ? 6
            : level >= 13
              ? 5
              : level >= 9
                ? 4
                : level >= 5
                  ? 3
                  : 2,
          LONG,
        );
        add('tireless', 'Tireless', 10, wisdom, LONG);
        add('natures-veil', "Nature's Veil", 14, wisdom, LONG);
      }
      break;
    case 'rogue':
      add('stroke-of-luck', 'Stroke of Luck', 20, 1, BOTH);
      break;
    case 'sorcerer':
      add(
        'sorcery-points',
        'Sorcery Points',
        2,
        level,
        !revised && level === 20 ? { shortRest: 4, longRest: 'full' } : LONG,
      );
      if (revised) {
        add('innate-sorcery', 'Innate Sorcery', 1, 2, LONG);
        conditional(
          'sorcerous-restoration',
          'Sorcerous Restoration',
          5,
          `Choose whether to restore up to ${Math.floor(level / 2)} Sorcery Points after a short rest; consumes this once-per-long-rest recovery.`,
        );
      }
      break;
    case 'warlock':
      if (revised)
        conditional(
          'magical-cunning',
          'Magical Cunning',
          2,
          level === 20
            ? 'Perform the rite to recover all expended Pact Magic slots.'
            : 'Perform the rite to recover up to half the maximum Pact Magic slots, rounded up.',
        );
      for (const [spellLevel, gainedAt] of [
        [6, 11],
        [7, 13],
        [8, 15],
        [9, 17],
      ])
        add(
          `mystic-arcanum-${spellLevel}`,
          `Mystic Arcanum (${spellLevel})`,
          gainedAt,
          1,
          LONG,
        );
      if (!revised)
        conditional(
          'eldritch-master',
          'Eldritch Master',
          20,
          'Perform the rite to recover expended Pact Magic slots.',
        );
      break;
    case 'wizard':
      add('arcane-recovery', 'Arcane Recovery', 1, 1, revised ? LONG : {}, {
        manualRecovery: `Choose slots after a short rest: at most ${Math.ceil(level / 2)} total slot levels; no slot of level six or higher.${revised ? '' : ' The once-per-day limit requires an explicit daily reset.'}`,
      });
      for (const index of [1, 2])
        add(
          `signature-spell-${index}`,
          `Signature Spell ${index}`,
          20,
          1,
          BOTH,
          {
            manualRecovery:
              'Assign this independent tracker to one selected signature spell; it does not pay for the other spell.',
          },
        );
      break;
  }
  const subclass = owner.subclass?.toLowerCase();
  if (classSlug === 'barbarian' && subclass === 'berserker' && revised)
    add('intimidating-presence', 'Intimidating Presence', 14, 1, LONG, {
      manualRecovery:
        'A Rage use may restore this feature. Apply both changes explicitly; resting does not spend Rage.',
    });
  if (classSlug === 'druid' && subclass === 'land') {
    add(
      'natural-recovery',
      'Natural Recovery slot recovery',
      revised ? 6 : 2,
      1,
      revised ? LONG : {},
      {
        manualRecovery: `After a short rest, choose slots totaling at most ${Math.ceil(level / 2)} levels; no level-six or higher slot. ${revised ? 'One recovery per long rest.' : 'One recovery per day; record the daily reset explicitly.'}`,
      },
    );
    if (revised)
      add(
        'natural-recovery-free-casting',
        'Natural Recovery free Circle spell',
        6,
        1,
        LONG,
        {
          manualRecovery:
            'Cast one prepared level-one or higher Circle spell without a slot; this counter does not restore slots.',
        },
      );
  }
  if (classSlug === 'monk' && subclass === 'open-hand')
    add(
      'wholeness-of-body',
      'Wholeness of Body',
      6,
      revised ? wisdom : 1,
      LONG,
      {
        manualRecovery: revised
          ? 'Roll your Martial Arts die and add Wisdom to healing (minimum one HP); apply healing separately.'
          : `Heal up to ${3 * level} hit points; apply healing separately.`,
      },
    );
  if (classSlug === 'paladin' && subclass === 'devotion')
    add('holy-nimbus', 'Holy Nimbus', 20, 1, LONG, {
      manualRecovery: revised
        ? 'A level-five spell slot may restore the use; apply the paired changes explicitly.'
        : 'Activate the aura effects explicitly.',
    });
  if (classSlug === 'sorcerer' && subclass === 'draconic' && revised) {
    add('dragon-wings', 'Dragon Wings', 14, 1, LONG, {
      manualRecovery:
        'Three Sorcery Points may restore the use. Apply the paired changes explicitly.',
    });
    add('dragon-companion', 'Dragon Companion free casting', 18, 1, LONG, {
      manualRecovery:
        'Tracks the free Summon Dragon casting. Apply the spell and its concentration choice separately.',
    });
  }
  if (classSlug === 'warlock' && subclass === 'fiend') {
    add(
      'dark-ones-own-luck',
      "Dark One's Own Luck",
      6,
      revised ? charisma : 1,
      revised ? LONG : BOTH,
    );
    add('hurl-through-hell', 'Hurl Through Hell', 14, 1, LONG, {
      manualRecovery: revised
        ? 'A Pact Magic slot may restore the use; apply the paired changes explicitly.'
        : 'Apply the hit-triggered effects separately.',
    });
  }
  if (classSlug === 'wizard' && subclass === 'evocation')
    add('overchannel-safe-use', 'Overchannel first safe use', 14, 1, LONG, {
      manualRecovery:
        'Tracks only the first use without self-damage. Further uses remain possible but require escalating self-damage, recorded separately.',
    });
  return resources;
}

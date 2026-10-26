import type { Character } from '../types/dnd';
import type { CreationDraft } from '../types/draft';
import { draftToCreationData } from '../adapters/draftAdapter';
import { loadEquipment, loadSpells } from './dataService';
import { calculateCharacterStats } from '../utils/characterCreationUtils';

export interface FirstTurnGuidance {
  standardAction: string;
  bonusAction?: string;
  reaction?: string;
  tacticalTip: string;
}

/** Guidance uses the same evaluated sheet that will be handed to the host. */
export function generateFirstTurnGuidance(
  draft: CreationDraft,
  isArcher = false,
  evaluated?: Character,
): FirstTurnGuidance {
  const character =
    evaluated ?? calculateCharacterStats(draftToCreationData(draft));
  const equipment = loadEquipment();
  const weapons = draft.loadout.items
    .filter((item) => item.equipped)
    .flatMap((item) => {
      const weapon = equipment.find((entry) => entry.slug === item.slug);
      return weapon?.weapon_category ? [weapon] : [];
    });
  const weapon =
    (isArcher
      ? weapons.find((entry) => entry.weapon_range === 'Ranged')
      : undefined) ?? weapons[0];
  const casting = character.spellcasting;
  const availableSlugs = new Set([
    ...(casting?.cantripsKnown ?? []),
    ...(casting?.spellcastingType === 'known'
      ? (casting.spellsKnown ?? [])
      : (casting?.preparedSpells ?? [])),
  ]);
  const spells = loadSpells(draft.edition).filter((spell) =>
    availableSlugs.has(spell.slug),
  );
  const actionSpell =
    spells.find(
      (spell) => spell.level === 0 && /^(1 )?action$/i.test(spell.castingTime),
    ) ?? spells.find((spell) => /^(1 )?action$/i.test(spell.castingTime));
  const bonusSpell = spells.find((spell) =>
    /bonus action/i.test(spell.castingTime),
  );
  const reactionSpell = spells.find((spell) =>
    /reaction/i.test(spell.castingTime),
  );
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;
  let standardAction =
    'Take the Dodge action while you decide how to help your party.';
  if (weapon) {
    const finesse = weapon.properties?.some(
      (property) => property.index === 'finesse',
    );
    const modifier =
      weapon.weapon_range === 'Ranged' ||
      (finesse &&
        character.abilities.DEX.modifier > character.abilities.STR.modifier)
        ? character.abilities.DEX.modifier
        : character.abilities.STR.modifier;
    const proficient = character.proficiencies?.weapons?.some(
      (value) =>
        value.toLowerCase().includes(weapon.name.toLowerCase()) ||
        value.toLowerCase().includes(weapon.weapon_category!.toLowerCase()),
    );
    const archery =
      weapon.weapon_range === 'Ranged' &&
      (draft.fightingStyle ?? '').toLowerCase() === 'archery'
        ? 2
        : 0;
    const attack =
      modifier + (proficient ? character.proficiencyBonus : 0) + archery;
    standardAction = `Attack with your primary weapon, ${weapon.name} (${signed(attack)} to hit${weapon.damage ? `, ${weapon.damage.damage_dice}${signed(modifier)} damage` : ''}).`;
  } else if (actionSpell) {
    standardAction = `Cast ${actionSpell.name}: ${actionSpell.castingTime}, ${actionSpell.range}. Spell attack ${signed(casting?.spellAttackBonus ?? 0)}; save DC ${casting?.spellSaveDC ?? 0}.`;
  }
  return {
    standardAction,
    ...(draft.classSlug === 'fighter'
      ? {
          bonusAction:
            'Second Wind: recover hit points when injured. Check remaining uses on your sheet.',
        }
      : bonusSpell
        ? {
            bonusAction: `Cast ${bonusSpell.name}: ${bonusSpell.castingTime}, ${bonusSpell.range}. A leveled spell consumes its casting resource.`,
          }
        : {}),
    ...(reactionSpell
      ? {
          reaction: `Cast ${reactionSpell.name} when its stated trigger occurs, if you have a spell slot.`,
        }
      : weapons.some((entry) => entry.weapon_range === 'Melee')
        ? {
            reaction:
              'Opportunity Attack: use a melee weapon when a creature provokes one.',
          }
        : {}),
    tacticalTip:
      'Use your movement to reach a safe position. Check range, targets, and remaining resources before acting.',
  };
}

import type {
  Character,
  CharacterCreationData,
  LevelUpChoices,
} from '../types/dnd';
import { classGrantErrors } from './classGrantChoices';

type FeatChoices = NonNullable<Character['featChoices']>;

/** The character as it would be after this level-up, shaped for the shared validators. */
function asCreationData(
  character: Character,
  choices: LevelUpChoices,
  toLevel: number,
): CharacterCreationData {
  const featChoices: FeatChoices = {
    ...(character.featChoices ?? {}),
    ...(choices.featChoices ?? {}),
  };
  return {
    classSlug: character.classSlug || character.class.toLowerCase(),
    edition: character.edition,
    level: toLevel,
    eldritchInvocations:
      choices.eldritchInvocationsChosen ?? character.eldritchInvocations ?? [],
    weaponMastery:
      choices.weaponMasteriesChosen ?? character.weaponMastery ?? [],
    featChoices,
    divineOrder: character.divineOrder,
    primalOrder: character.primalOrder,
    background: character.background,
    selectedFeats: character.selectedFeats ?? [],
    spellSelection: {
      selectedCantrips: character.spellcasting?.cantripsKnown ?? [],
      knownSpells: [],
    },
    additionalCastingSources: character.castingSources ?? [],
  } as unknown as CharacterCreationData;
}

/**
 * Validates the Warlock invocation and weapon mastery picks made while leveling
 * up. Each list is the complete new selection, so a level-up can also swap an
 * earlier pick. Nothing is validated for a category the player did not touch.
 */
export function levelUpGrantErrors(
  character: Character,
  choices: LevelUpChoices,
  toLevel: number,
): string[] {
  const classSlug = character.classSlug || character.class.toLowerCase();
  const errors: string[] = [];
  const invocations = choices.eldritchInvocationsChosen;
  const masteries = choices.weaponMasteriesChosen;
  if (!invocations && !masteries) return errors;

  if (invocations) {
    if (classSlug !== 'warlock')
      errors.push('Only Warlocks choose Eldritch Invocations.');
    else if (character.edition !== '2024')
      errors.push(
        'Choosing Eldritch Invocations while leveling up is only supported for the 2024 rules.',
      );
  }
  if (masteries && character.edition !== '2024')
    errors.push('Weapon Mastery is only available under the 2024 rules.');
  if (errors.length) return errors;

  const all = classGrantErrors(asCreationData(character, choices, toLevel));
  return all.filter(
    (message) =>
      (invocations &&
        /invocation|eligible targets|Lessons of the First Ones|requires /i.test(
          message,
        )) ||
      (masteries && /mastery|masteries/i.test(message)),
  );
}

/** Applies validated invocation and mastery picks to the leveled character. */
export function applyLevelUpGrants(
  updated: Character,
  choices: LevelUpChoices,
): void {
  if (choices.eldritchInvocationsChosen)
    updated.eldritchInvocations = [...choices.eldritchInvocationsChosen];
  if (choices.weaponMasteriesChosen)
    updated.weaponMastery = [...choices.weaponMasteriesChosen];
}

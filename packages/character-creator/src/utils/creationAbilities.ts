import type { AbilityName, CharacterCreationData } from '../types/dnd';
import { calculateCharacterStats } from './characterCreationUtils';

/**
 * Ability scores with species/background bonuses applied. By default level-up
 * ASI/feat choices are left out (the ASI step builds on this value); pass
 * `includeLevelUpChoices` to get the final scores. Falls back to the raw base
 * scores while the draft is too incomplete to resolve species, class or
 * background.
 */
export function getScoresBeforeLevelUpChoices(
  data: CharacterCreationData,
  { includeLevelUpChoices = false }: { includeLevelUpChoices?: boolean } = {},
): Record<AbilityName, number> {
  try {
    const stats = calculateCharacterStats({
      ...data,
      cumulativeASI: includeLevelUpChoices ? data.cumulativeASI : undefined,
      highLevelSetup: undefined,
    });
    return Object.fromEntries(
      (Object.keys(data.abilities) as AbilityName[]).map((ability) => [
        ability,
        stats.abilities[ability].score,
      ]),
    ) as Record<AbilityName, number>;
  } catch {
    return { ...data.abilities };
  }
}

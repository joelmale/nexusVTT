import { resolveProficientSaves } from '@nexus/character-creator/adapters/nexusCharacter';

import type { Character } from '../types/dnd';

export function getSavingThrowProficiencies(
  character: Pick<Character, 'class' | 'classSlug' | 'edition' | 'level'>,
): string[] {
  const { classSlug, class: className, edition, level } = character;
  return (
    resolveProficientSaves(classSlug, edition, level) ??
    resolveProficientSaves(className, edition, level) ??
    []
  );
}

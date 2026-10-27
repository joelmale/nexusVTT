import type { Character } from '../types/dnd';
import type { ResourceTracker } from '../data/classProgression';
import { classResourceDefinitions } from './classResources';
import { recoverCharacterResource } from '@nexus/character-contracts';

const canonicalId = (id: string) =>
  id === 'channel-divinity-turn-undead' ? 'channel-divinity' : id;
const validCount = (value: number | undefined): value is number =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0;

/** Only newly created characters start full. Loading is reconciliation, not rest. */
export const initializeCharacterResources = (
  character: Character,
): ResourceTracker[] =>
  classResourceDefinitions(character).map((resource) => ({
    ...resource,
    currentUses: resource.maxUses,
  }));

/** Preserve known expenditure and custom/manual counters. Missing legacy state
 * stays unknown until a real recovery or explicit correction establishes it. */
export function reconcileCharacterResources(
  character: Character,
  previousLevel?: number,
): Character {
  const previous = new Map<string, ResourceTracker>();
  for (const resource of character.resources ?? []) {
    const id = canonicalId(resource.id);
    const existing = previous.get(id);
    if (
      !existing ||
      (validCount(resource.currentUses) &&
        (!validCount(existing.currentUses) ||
          resource.currentUses < existing.currentUses))
    )
      previous.set(id, { ...resource, id });
  }
  const resources: ResourceTracker[] = classResourceDefinitions(character).map(
    (definition) => {
      const existing = previous.get(definition.id);
      previous.delete(definition.id);
      const override = existing?.maxUsesOverride;
      const maxUses = validCount(override) ? override : definition.maxUses;
      const oldCurrent = existing?.currentUses;
      const spent =
        existing && validCount(oldCurrent) && validCount(existing.maxUses)
          ? Math.max(0, existing.maxUses - oldCurrent)
          : undefined;
      const newlyGained =
        previousLevel !== undefined &&
        definition.provenance!.gainedAt > previousLevel;
      return {
        ...definition,
        maxUses,
        maxUsesOverride: validCount(override) ? override : undefined,
        currentUses:
          spent !== undefined
            ? Math.max(0, maxUses - spent)
            : newlyGained
              ? maxUses
              : undefined,
      };
    },
  );
  for (const resource of previous.values())
    resources.push(
      resource.provenance ? { ...resource, active: false } : resource,
    );
  return { ...character, resources };
}

export const consumeResource = (
  character: Character,
  resourceId: string,
  uses = 1,
): Character => {
  if (!Number.isSafeInteger(uses) || uses <= 0) return character;
  const id = canonicalId(resourceId);
  const resource = character.resources?.find(
    (entry) => canonicalId(entry.id) === id,
  );
  if (
    !resource ||
    resource.active === false ||
    resource.unlimited ||
    !validCount(resource.currentUses) ||
    resource.currentUses < uses
  )
    return character;
  return {
    ...character,
    resources: character.resources!.map((entry) =>
      entry === resource
        ? { ...entry, currentUses: resource.currentUses! - uses }
        : entry,
    ),
  };
};

export const canUseResource = (
  character: Character,
  resourceId: string,
): boolean => {
  const resource = character.resources?.find(
    (entry) => canonicalId(entry.id) === canonicalId(resourceId),
  );
  return Boolean(
    resource &&
    resource.active !== false &&
    (resource.unlimited ||
      (validCount(resource.currentUses) && resource.currentUses > 0)),
  );
};

export const getResourceUses = (
  character: Character,
  resourceId: string,
): { current: number; max: number } => {
  const resource = character.resources?.find(
    (entry) => canonicalId(entry.id) === canonicalId(resourceId),
  );
  return resource?.active !== false
    ? { current: resource?.currentUses ?? 0, max: resource?.maxUses ?? 0 }
    : { current: 0, max: 0 };
};

export const resetResources = (
  character: Character,
  rest: 'short-rest' | 'long-rest',
): Character => {
  if (!character.resources) return character;
  return {
    ...character,
    resources: character.resources.map((resource) =>
      recoverCharacterResource(resource, rest),
    ),
  };
};

export function applyCharacterRest(
  character: Character,
  rest: 'short-rest' | 'long-rest',
): Character {
  const result = resetResources(character, rest);
  const pact =
    (character.classSlug || character.class).toLowerCase() === 'warlock';
  const spellcasting =
    character.spellcasting && (rest === 'long-rest' || pact)
      ? {
          ...character.spellcasting,
          usedSpellSlots: character.spellcasting.spellSlots.map(() => 0),
        }
      : character.spellcasting;
  if (rest === 'short-rest') return { ...result, spellcasting };
  return {
    ...result,
    spellcasting,
    hitPoints: character.maxHitPoints,
    temporaryHitPoints: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: character.conditions?.filter(
      (condition) => condition.toLowerCase() !== 'unconscious',
    ),
    hitDice: {
      ...character.hitDice,
      current:
        character.edition === '2024'
          ? character.hitDice.max
          : Math.min(
              character.hitDice.max,
              character.hitDice.current +
                Math.max(1, Math.floor(character.hitDice.max / 2)),
            ),
    },
  };
}

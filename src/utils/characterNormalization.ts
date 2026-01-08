import type { AbilityScores, Character, SkillMap } from '@/types/character';
import {
  calculateAbilityModifier,
  calculateProficiencyBonus,
  createEmptyCharacter,
} from '@/types/character';

export const normalizeSkillKey = (name: string): string => {
  const map: Record<string, string> = {
    AnimalHandling: 'Animal Handling',
    SleightOfHand: 'Sleight of Hand',
  };

  if (map[name]) return map[name];
  if (name.includes(' ')) return name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
};

export const normalizeIsoTimestamp = (
  value: string | number | undefined,
  fallback: string,
): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  return fallback;
};

interface NormalizeCharacterOptions {
  playerId?: string;
  baseCharacter?: Character;
  now?: string;
}

export const normalizeCharacter = (
  input: Character,
  options: NormalizeCharacterOptions = {},
): Character => {
  const base =
    options.baseCharacter ||
    createEmptyCharacter(options.playerId ?? input.playerId ?? '');
  const now = options.now ?? new Date().toISOString();

  const normalizedAbilities: AbilityScores = { ...base.abilities };
  (Object.keys(base.abilities) as Array<keyof AbilityScores>).forEach(
    (abilityKey) => {
      const incoming = input.abilities?.[abilityKey];
      const score =
        typeof incoming?.score === 'number'
          ? incoming.score
          : base.abilities[abilityKey].score;
      const modifier = calculateAbilityModifier(score);
      normalizedAbilities[abilityKey] = { score, modifier };
    },
  );

  const normalizedSkills: SkillMap = { ...base.skills };
  if (input.skills) {
    Object.entries(input.skills).forEach(([name, skill]) => {
      const normalizedName = normalizeSkillKey(name);
      normalizedSkills[normalizedName] = {
        proficient: !!skill.proficient,
        expertise: skill.expertise,
        value:
          typeof skill.value === 'number'
            ? skill.value
            : normalizedSkills[normalizedName]?.value ?? 0,
      };
    });
  }

  const proficiencyBonus =
    typeof input.proficiencyBonus === 'number'
      ? input.proficiencyBonus
      : calculateProficiencyBonus(input.level || base.level);

  const createdAt = normalizeIsoTimestamp(input.createdAt, now);
  const updatedAt = normalizeIsoTimestamp(input.updatedAt, now);

  return {
    ...base,
    ...input,
    id: input.id || base.id,
    playerId: input.playerId || options.playerId || base.playerId,
    name: input.name || base.name,
    level: input.level || base.level,
    race: input.race ?? input.species ?? base.race,
    species: input.species ?? input.race ?? base.species,
    class: input.class ?? base.class,
    background: input.background ?? base.background,
    abilities: normalizedAbilities,
    skills: normalizedSkills,
    proficiencyBonus,
    hitPoints: input.hitPoints ?? input.maxHitPoints ?? base.hitPoints,
    maxHitPoints: input.maxHitPoints ?? input.hitPoints ?? base.maxHitPoints,
    temporaryHitPoints: input.temporaryHitPoints ?? base.temporaryHitPoints,
    initiative: input.initiative ?? normalizedAbilities.DEX.modifier,
    createdAt,
    updatedAt,
  };
};

/**
 * Maps raw 5e SRD entity payloads (as returned by the document service's
 * structured-data endpoints) into the view-model shapes that EntityStatCard
 * renders. Shared by DocumentsPanel and DocumentSidebar so the mapping logic
 * lives in exactly one typed place.
 */
import type { SrdEntityData, SrdSpecialAbility } from '@/services/documentService';
import type {
  SpellEntity,
  MonsterEntity,
  ItemEntity,
} from '@/components/Dashboard/molecules/EntityStatCard';

export type MappedSrdEntity = SpellEntity | MonsterEntity | ItemEntity;

export function mapSrdEntity(
  type: string,
  rawData: SrdEntityData | null | undefined,
): MappedSrdEntity | null {
  if (!rawData) return null;

  if (type === 'spell') {
    const spell: SpellEntity = {
      name: rawData.name || '',
      level: rawData.level !== undefined ? rawData.level : '',
      school:
        (typeof rawData.school === 'object' && rawData.school
          ? rawData.school.name
          : rawData.school) || '',
      castingTime: rawData.casting_time || '',
      range: rawData.range || '',
      components: Array.isArray(rawData.components)
        ? rawData.components.join(', ')
        : rawData.components || '',
      duration: rawData.duration || '',
      description: Array.isArray(rawData.desc)
        ? rawData.desc.join('\n')
        : rawData.desc || '',
    };
    return spell;
  }

  if (type === 'monster') {
    const monster: MonsterEntity = {
      name: rawData.name || '',
      size: rawData.size || '',
      type: rawData.type || '',
      alignment: rawData.alignment || '',
      ac: Array.isArray(rawData.armor_class)
        ? rawData.armor_class[0]?.value ?? 10
        : rawData.armor_class ?? 10,
      hp: rawData.hit_points || 0,
      speed:
        typeof rawData.speed === 'object'
          ? Object.entries(rawData.speed)
              .map(([k, v]) => `${k} ${v}`)
              .join(', ')
          : rawData.speed || '',
      cr:
        rawData.challenge_rating !== undefined ? rawData.challenge_rating : '',
      stats: {
        strength: rawData.strength || 10,
        dexterity: rawData.dexterity || 10,
        constitution: rawData.constitution || 10,
        intelligence: rawData.intelligence || 10,
        wisdom: rawData.wisdom || 10,
        charisma: rawData.charisma || 10,
      },
      description: rawData.special_abilities
        ? rawData.special_abilities
            .map((a: SrdSpecialAbility) => `**${a.name}.** ${a.desc}`)
            .join('\n\n')
        : '',
    };
    return monster;
  }

  return rawData as ItemEntity;
}

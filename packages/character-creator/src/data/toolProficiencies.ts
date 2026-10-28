/**
 * Structured tool-proficiency facts layered over the SRD equipment catalog.
 *
 * The SRD already supplies each tool's ability, cost, weight, craftable items
 * and "utilize" DCs. These fields add which skills a tool proficiency can
 * support (the Dungeon Master's Guide's "Tool Proficiencies" section) and the
 * vehicle proficiencies the SRD catalog lacks. Only these facts are stored, not
 * the book's descriptive text.
 */

export type ToolProficiencyGroup =
  | 'artisans-tools'
  | 'other-tools'
  | 'gaming-set'
  | 'musical-instrument'
  | 'vehicles';

/** Skills a proficiency with the tool can inform, keyed by SRD equipment index. */
export const TOOL_RELATED_SKILLS: Readonly<Record<string, readonly string[]>> =
  {
    'alchemists-supplies': ['Arcana', 'Investigation'],
    'brewers-supplies': ['History', 'Medicine', 'Persuasion'],
    'calligraphers-supplies': ['Arcana', 'History'],
    'carpenters-tools': ['History', 'Investigation', 'Perception', 'Stealth'],
    'cartographers-tools': [
      'Arcana',
      'History',
      'Nature',
      'Religion',
      'Survival',
    ],
    'cobblers-tools': ['Arcana', 'History', 'Investigation'],
    'cooks-utensils': ['History', 'Medicine', 'Survival'],
    'disguise-kit': ['Deception', 'Intimidation', 'Performance', 'Persuasion'],
    'forgery-kit': ['Arcana', 'Deception', 'History', 'Investigation'],
    'glassblowers-tools': ['Arcana', 'History', 'Investigation'],
    'herbalism-kit': [
      'Arcana',
      'Investigation',
      'Medicine',
      'Nature',
      'Survival',
    ],
    'jewelers-tools': ['Arcana', 'Investigation'],
    'leatherworkers-tools': ['Arcana', 'Investigation'],
    'masons-tools': ['History', 'Investigation', 'Perception'],
    'navigators-tools': ['Survival'],
    'painters-supplies': [
      'Arcana',
      'History',
      'Investigation',
      'Perception',
      'Religion',
    ],
    'poisoners-kit': [
      'History',
      'Investigation',
      'Medicine',
      'Nature',
      'Perception',
      'Survival',
    ],
    'potters-tools': ['History', 'Investigation', 'Perception'],
    'smiths-tools': ['Arcana', 'History', 'Investigation'],
    'thieves-tools': ['History', 'Investigation', 'Perception'],
    'tinkers-tools': ['History', 'Investigation'],
    'weavers-tools': ['Arcana', 'History', 'Investigation'],
    'woodcarvers-tools': ['Arcana', 'History', 'Nature'],
  };

/** Shared by every item in a category (all gaming sets, all instruments). */
export const GROUP_RELATED_SKILLS: Readonly<
  Partial<Record<ToolProficiencyGroup, readonly string[]>>
> = {
  'gaming-set': ['History', 'Insight', 'Sleight of Hand'],
  'musical-instrument': ['History', 'Performance'],
  vehicles: ['Arcana', 'Investigation', 'Perception'],
};

export function toolProficiencyGroup(
  equipmentCategory: string,
  index: string,
): ToolProficiencyGroup | undefined {
  const category = equipmentCategory.toLowerCase();
  if (category.includes('gaming')) return 'gaming-set';
  if (category.includes('musical')) return 'musical-instrument';
  if (category.includes('artisan')) return 'artisans-tools';
  if (category.includes('other tools')) return 'other-tools';
  return index in TOOL_RELATED_SKILLS ? 'other-tools' : undefined;
}

/** Proficiency categories that are not purchasable items in the SRD catalog. */
export const VEHICLE_PROFICIENCIES: ReadonlyArray<{
  index: string;
  name: string;
}> = [
  { index: 'land-vehicles', name: 'Land Vehicles' },
  { index: 'water-vehicles', name: 'Water Vehicles' },
];

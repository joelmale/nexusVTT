/**
 * Tool Descriptions and Metadata
 * Enhanced tool proficiency information with gameplay uses
 */

export type AbilityName = 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma';

export type ToolCategory =
  | 'Artisan\'s Tools'
  | 'Gaming Set'
  | 'Musical Instrument'
  | 'Specialist Tool';

export type EngineTag =
  | 'crafting'
  | 'chemical'
  | 'analysis'
  | 'food'
  | 'social'
  | 'knowledge'
  | 'forgery'
  | 'construction'
  | 'environment'
  | 'navigation'
  | 'exploration'
  | 'travel'
  | 'maintenance'
  | 'survival'
  | 'support'
  | 'precision'
  | 'valuation'
  | 'equipment'
  | 'mechanical'
  | 'problem-solving'
  | 'art'
  | 'communication'
  | 'storage'
  | 'performance'
  | 'insight'
  | 'deception'
  | 'healing'
  | 'nature'
  | 'stealth';

/**
 * Enhanced tool description with gameplay information
 */
export interface ToolDescription {
  /** Display name of the tool */
  name: string;

  /** Tool category */
  category: ToolCategory;

  /** Brief summary of primary uses */
  commonUses: string;

  /** Abilities typically used with this tool */
  typicalAbilities: AbilityName[];

  /** List of specific uses and checks */
  uses: string[];

  /** Special or unique application of this tool */
  specialUse: string;

  /** Tags for rules engine integration */
  engineTags: EngineTag[];
}

/**
 * Tool descriptions database organized by category
 */
export interface ToolDescriptions {
  'artisans-tools': Record<string, ToolDescription>;
  'gaming-sets': Record<string, ToolDescription>;
  'musical-instruments': Record<string, ToolDescription>;
  'other-tools': Record<string, ToolDescription>;
}

/**
 * Get tool description by slug
 * @param slug - Tool slug (e.g., 'alchemist-supplies', 'thieves-tools')
 * @returns Tool description or undefined if not found
 */
export function getToolDescription(slug: string, descriptions: ToolDescriptions): ToolDescription | undefined {
  // Search all categories
  for (const category of Object.values(descriptions)) {
    if (slug in category) {
      return category[slug];
    }
  }
  return undefined;
}

/**
 * Get all tools in a category
 * @param category - Category key
 * @returns Array of tool descriptions
 */
export function getToolsByCategory(
  category: keyof ToolDescriptions,
  descriptions: ToolDescriptions
): ToolDescription[] {
  return Object.values(descriptions[category]) as ToolDescription[];
}

/**
 * Search tools by engine tag
 * @param tag - Engine tag to search for
 * @returns Array of matching tool descriptions
 */
export function getToolsByTag(tag: EngineTag, descriptions: ToolDescriptions): ToolDescription[] {
  const results: ToolDescription[] = [];

  for (const category of Object.values(descriptions)) {
    for (const tool of Object.values(category) as ToolDescription[]) {
      if (tool.engineTags.includes(tag)) {
        results.push(tool);
      }
    }
  }

  return results;
}

/**
 * Check if a tool uses a specific ability
 * @param toolSlug - Tool slug
 * @param ability - Ability name
 * @returns True if the tool typically uses this ability
 */
export function toolUsesAbility(
  toolSlug: string,
  ability: AbilityName,
  descriptions: ToolDescriptions
): boolean {
  const tool = getToolDescription(toolSlug, descriptions);
  return tool?.typicalAbilities.includes(ability) ?? false;
}

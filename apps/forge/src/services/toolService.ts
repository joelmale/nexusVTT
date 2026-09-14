/**
 * Tool Service
 * Load and access tool descriptions and metadata
 */

import toolDescriptionsData from '../data/toolDescriptions.json';
import type {
  ToolDescription,
  ToolDescriptions,
  AbilityName,
  EngineTag,
} from '../types/tools';

/**
 * Tool descriptions database
 */
export const TOOL_DESCRIPTIONS = toolDescriptionsData as ToolDescriptions;

/**
 * Get tool description by slug
 *
 * @param slug - Tool slug (e.g., 'alchemist-supplies', 'thieves-tools')
 * @returns Tool description or undefined
 *
 * @example
 * const alchemist = getToolDescription('alchemist-supplies');
 * console.log(alchemist?.commonUses); // "Chemicals, mixtures, reactions"
 */
export function getToolDescription(slug: string): ToolDescription | undefined {
  // Normalize slug (remove spaces, lowercase, convert apostrophes)
  const normalized = slug
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/'/g, '');

  // Search all categories
  for (const category of Object.values(TOOL_DESCRIPTIONS)) {
    if (normalized in category) {
      return category[normalized];
    }
  }

  return undefined;
}

/**
 * Get all tools in a category
 *
 * @param category - Category key
 * @returns Array of tool descriptions
 *
 * @example
 * const artisanTools = getToolsByCategory('artisans-tools');
 */
export function getToolsByCategory(
  category: keyof ToolDescriptions
): ToolDescription[] {
  return Object.values(TOOL_DESCRIPTIONS[category]) as ToolDescription[];
}

/**
 * Get all artisan's tools
 */
export function getArtisanTools(): ToolDescription[] {
  return getToolsByCategory('artisans-tools');
}

/**
 * Get all gaming sets
 */
export function getGamingSets(): ToolDescription[] {
  return getToolsByCategory('gaming-sets');
}

/**
 * Get all musical instruments
 */
export function getMusicalInstruments(): ToolDescription[] {
  return getToolsByCategory('musical-instruments');
}

/**
 * Get all specialist tools (thieves' tools, herbalism kit, etc.)
 */
export function getSpecialistTools(): ToolDescription[] {
  return getToolsByCategory('other-tools');
}

/**
 * Search tools by engine tag
 *
 * @param tag - Engine tag to search for
 * @returns Array of matching tool descriptions
 *
 * @example
 * const craftingTools = getToolsByTag('crafting');
 * const socialTools = getToolsByTag('social');
 */
export function getToolsByTag(tag: EngineTag): ToolDescription[] {
  const results: ToolDescription[] = [];

  for (const category of Object.values(TOOL_DESCRIPTIONS)) {
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
 *
 * @param toolSlug - Tool slug
 * @param ability - Ability name
 * @returns True if the tool typically uses this ability
 *
 * @example
 * const usesInt = toolUsesAbility('alchemist-supplies', 'Intelligence'); // true
 * const usesStr = toolUsesAbility('alchemist-supplies', 'Strength'); // false
 */
export function toolUsesAbility(
  toolSlug: string,
  ability: AbilityName
): boolean {
  const tool = getToolDescription(toolSlug);
  return tool?.typicalAbilities.includes(ability) ?? false;
}

/**
 * Get suggested ability check for a tool
 *
 * @param toolSlug - Tool slug
 * @returns Primary ability (first in list) or undefined
 *
 * @example
 * const ability = getPrimaryAbility('alchemist-supplies'); // 'Intelligence'
 */
export function getPrimaryAbility(toolSlug: string): AbilityName | undefined {
  const tool = getToolDescription(toolSlug);
  return tool?.typicalAbilities[0];
}

/**
 * Get all tools that use a specific ability
 *
 * @param ability - Ability name
 * @returns Array of tools that use this ability
 *
 * @example
 * const dexTools = getToolsUsingAbility('Dexterity');
 */
export function getToolsUsingAbility(ability: AbilityName): ToolDescription[] {
  const results: ToolDescription[] = [];

  for (const category of Object.values(TOOL_DESCRIPTIONS)) {
    for (const tool of Object.values(category) as ToolDescription[]) {
      if (tool.typicalAbilities.includes(ability)) {
        results.push(tool);
      }
    }
  }

  return results;
}

/**
 * Format tool uses as bullet list for display
 *
 * @param toolSlug - Tool slug
 * @returns Formatted string with uses or empty string
 */
export function formatToolUses(toolSlug: string): string {
  const tool = getToolDescription(toolSlug);
  if (!tool) return '';

  return tool.uses.map((use) => `• ${use}`).join('\n');
}

/**
 * Get tool display card data
 *
 * @param toolSlug - Tool slug
 * @returns Formatted data for UI card or undefined
 */
export function getToolCard(toolSlug: string): {
  name: string;
  category: string;
  commonUses: string;
  abilities: string;
  uses: string[];
  specialUse: string;
  tags: string[];
} | undefined {
  const tool = getToolDescription(toolSlug);
  if (!tool) return undefined;

  return {
    name: tool.name,
    category: tool.category,
    commonUses: tool.commonUses,
    abilities: tool.typicalAbilities.join(', '),
    uses: tool.uses,
    specialUse: tool.specialUse,
    tags: tool.engineTags,
  };
}

/**
 * Search tools by name (fuzzy match)
 *
 * @param query - Search query
 * @returns Array of matching tools
 *
 * @example
 * const results = searchTools('smith'); // Returns Smith's Tools
 */
export function searchTools(query: string): ToolDescription[] {
  const lowerQuery = query.toLowerCase();
  const results: ToolDescription[] = [];

  for (const category of Object.values(TOOL_DESCRIPTIONS)) {
    for (const tool of Object.values(category) as ToolDescription[]) {
      if (tool.name.toLowerCase().includes(lowerQuery)) {
        results.push(tool);
      }
    }
  }

  return results;
}

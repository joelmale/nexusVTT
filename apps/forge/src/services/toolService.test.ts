/**
 * Tool Service Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getToolDescription,
  getToolsByCategory,
  getToolsByTag,
  toolUsesAbility,
  getPrimaryAbility,
  getToolsUsingAbility,
  searchTools,
  getToolCard,
  TOOL_DESCRIPTIONS,
} from './toolService';

describe('Tool Service', () => {
  describe('TOOL_DESCRIPTIONS', () => {
    it('should have all four categories', () => {
      expect(TOOL_DESCRIPTIONS).toHaveProperty('artisans-tools');
      expect(TOOL_DESCRIPTIONS).toHaveProperty('gaming-sets');
      expect(TOOL_DESCRIPTIONS).toHaveProperty('musical-instruments');
      expect(TOOL_DESCRIPTIONS).toHaveProperty('other-tools');
    });

    it('should have artisan tools', () => {
      const artisanTools = Object.keys(TOOL_DESCRIPTIONS['artisans-tools']);
      expect(artisanTools).toContain('alchemist-supplies');
      expect(artisanTools).toContain('smith-tools');
      expect(artisanTools).toContain('carpenter-tools');
    });

    it('should have specialist tools', () => {
      const specialistTools = Object.keys(TOOL_DESCRIPTIONS['other-tools']);
      expect(specialistTools).toContain('thieves-tools');
      expect(specialistTools).toContain('herbalism-kit');
      expect(specialistTools).toContain('navigator-tools');
    });
  });

  describe('getToolDescription', () => {
    it('should get alchemist supplies description', () => {
      const tool = getToolDescription('alchemist-supplies');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("Alchemist's Supplies");
      expect(tool?.category).toBe("Artisan's Tools");
      expect(tool?.commonUses).toBe('Chemicals, mixtures, reactions');
      expect(tool?.typicalAbilities).toContain('Intelligence');
      expect(tool?.engineTags).toContain('crafting');
    });

    it('should get thieves tools description', () => {
      const tool = getToolDescription('thieves-tools');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("Thieves' Tools");
      expect(tool?.category).toBe('Specialist Tool');
      expect(tool?.uses).toContain('Pick locks');
    });

    it('should get musical instrument description', () => {
      const tool = getToolDescription('lute');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('Lute');
      expect(tool?.category).toBe('Musical Instrument');
      expect(tool?.engineTags).toContain('performance');
    });

    it('should return undefined for unknown tool', () => {
      const tool = getToolDescription('unknown-tool');
      expect(tool).toBeUndefined();
    });

    it('should normalize tool names with spaces', () => {
      const tool1 = getToolDescription('alchemist supplies');
      const tool2 = getToolDescription('alchemist-supplies');

      expect(tool1).toEqual(tool2);
    });
  });

  describe('getToolsByCategory', () => {
    it('should get all artisan tools', () => {
      const tools = getToolsByCategory('artisans-tools');

      expect(tools.length).toBeGreaterThan(10);
      expect(tools.some((t) => t.name === "Alchemist's Supplies")).toBe(true);
      expect(tools.some((t) => t.name === "Smith's Tools")).toBe(true);
    });

    it('should get all gaming sets', () => {
      const tools = getToolsByCategory('gaming-sets');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === 'Dice Set')).toBe(true);
    });

    it('should get all musical instruments', () => {
      const tools = getToolsByCategory('musical-instruments');

      expect(tools.length).toBeGreaterThan(5);
      expect(tools.some((t) => t.name === 'Lute')).toBe(true);
      expect(tools.some((t) => t.name === 'Flute')).toBe(true);
    });
  });

  describe('getToolsByTag', () => {
    it('should get all crafting tools', () => {
      const tools = getToolsByTag('crafting');

      expect(tools.length).toBeGreaterThan(5);
      expect(tools.some((t) => t.name === "Alchemist's Supplies")).toBe(true);
      expect(tools.some((t) => t.name === "Smith's Tools")).toBe(true);
    });

    it('should get all social tools', () => {
      const tools = getToolsByTag('social');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.engineTags.includes('social'))).toBe(true);
    });

    it('should get all navigation tools', () => {
      const tools = getToolsByTag('navigation');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === "Navigator's Tools")).toBe(true);
    });
  });

  describe('toolUsesAbility', () => {
    it('should confirm alchemist supplies uses Intelligence', () => {
      expect(toolUsesAbility('alchemist-supplies', 'Intelligence')).toBe(true);
    });

    it('should confirm alchemist supplies uses Dexterity', () => {
      expect(toolUsesAbility('alchemist-supplies', 'Dexterity')).toBe(true);
    });

    it('should confirm alchemist supplies does not use Strength', () => {
      expect(toolUsesAbility('alchemist-supplies', 'Strength')).toBe(false);
    });

    it('should confirm smith tools uses Strength', () => {
      expect(toolUsesAbility('smith-tools', 'Strength')).toBe(true);
    });
  });

  describe('getPrimaryAbility', () => {
    it('should get primary ability for alchemist supplies', () => {
      const ability = getPrimaryAbility('alchemist-supplies');
      expect(ability).toBe('Intelligence');
    });

    it('should get primary ability for thieves tools', () => {
      const ability = getPrimaryAbility('thieves-tools');
      expect(ability).toBe('Dexterity');
    });

    it('should return undefined for unknown tool', () => {
      const ability = getPrimaryAbility('unknown-tool');
      expect(ability).toBeUndefined();
    });
  });

  describe('getToolsUsingAbility', () => {
    it('should get all Dexterity-based tools', () => {
      const tools = getToolsUsingAbility('Dexterity');

      expect(tools.length).toBeGreaterThan(5);
      expect(tools.some((t) => t.name === "Thieves' Tools")).toBe(true);
      expect(tools.some((t) => t.name === "Leatherworker's Tools")).toBe(true);
    });

    it('should get all Intelligence-based tools', () => {
      const tools = getToolsUsingAbility('Intelligence');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === "Alchemist's Supplies")).toBe(true);
    });

    it('should get all Charisma-based tools', () => {
      const tools = getToolsUsingAbility('Charisma');

      expect(tools.length).toBeGreaterThan(0);
      // Musical instruments use Charisma
      expect(tools.some((t) => t.category === 'Musical Instrument')).toBe(true);
    });
  });

  describe('searchTools', () => {
    it('should find tools by partial name', () => {
      const results = searchTools('smith');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("Smith's Tools");
    });

    it('should find tools case-insensitively', () => {
      const results = searchTools('THIEVES');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("Thieves' Tools");
    });

    it('should find multiple matching tools', () => {
      const results = searchTools('tools');

      expect(results.length).toBeGreaterThan(5);
    });

    it('should return empty array for no matches', () => {
      const results = searchTools('xyzabc123');

      expect(results.length).toBe(0);
    });
  });

  describe('getToolCard', () => {
    it('should get formatted card data for alchemist supplies', () => {
      const card = getToolCard('alchemist-supplies');

      expect(card).toBeDefined();
      expect(card?.name).toBe("Alchemist's Supplies");
      expect(card?.abilities).toContain('Intelligence');
      expect(card?.abilities).toContain('Dexterity');
      expect(card?.uses.length).toBeGreaterThan(0);
      expect(card?.specialUse).toBeTruthy();
      expect(card?.tags).toContain('crafting');
    });

    it('should return undefined for unknown tool', () => {
      const card = getToolCard('unknown-tool');
      expect(card).toBeUndefined();
    });
  });

  describe('Tool data integrity', () => {
    it('should have all required fields for each tool', () => {
      const allTools = [
        ...getToolsByCategory('artisans-tools'),
        ...getToolsByCategory('gaming-sets'),
        ...getToolsByCategory('musical-instruments'),
        ...getToolsByCategory('other-tools'),
      ];

      allTools.forEach((tool) => {
        expect(tool.name).toBeTruthy();
        expect(tool.category).toBeTruthy();
        expect(tool.commonUses).toBeTruthy();
        expect(tool.typicalAbilities.length).toBeGreaterThan(0);
        expect(tool.uses.length).toBeGreaterThan(0);
        expect(tool.specialUse).toBeTruthy();
        expect(tool.engineTags.length).toBeGreaterThan(0);
      });
    });

    it('should have valid abilities', () => {
      const validAbilities = [
        'Strength',
        'Dexterity',
        'Constitution',
        'Intelligence',
        'Wisdom',
        'Charisma',
      ];

      const allTools = [
        ...getToolsByCategory('artisans-tools'),
        ...getToolsByCategory('gaming-sets'),
        ...getToolsByCategory('musical-instruments'),
        ...getToolsByCategory('other-tools'),
      ];

      allTools.forEach((tool) => {
        tool.typicalAbilities.forEach((ability) => {
          expect(validAbilities).toContain(ability);
        });
      });
    });
  });
});

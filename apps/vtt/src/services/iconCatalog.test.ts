import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_PACKS,
  getIconDefinition,
  getIconsByCategory,
  getAllIconDefinitions,
} from './iconCatalog';

describe('iconCatalog', () => {
  it('contains all 15 core GameUI panels with valid definitions', () => {
    const panels = getIconsByCategory('panels');
    expect(panels.length).toBe(15);

    const requiredPanels = [
      'panel:atlas',
      'panel:tokens',
      'panel:scene',
      'panel:props',
      'panel:session-plan',
      'panel:generator',
      'panel:initiative',
      'panel:characters',
      'panel:dice',
      'panel:documents',
      'panel:chat',
      'panel:sounds',
      'panel:lobby',
      'panel:settings',
      'panel:iconStudio',
    ];

    for (const panelId of requiredPanels) {
      const def = getIconDefinition(panelId);
      expect(def).toBeDefined();
      expect(def?.name).toBeTruthy();
      expect(def?.defaultFallback).toBeTruthy();
      expect(def?.defaultAsset).toContain('/assets/icons/panels/');
      expect(def?.subjectPrompt).toBeTruthy();
    }
  });

  it('contains all 16 standard D&D 5e status conditions', () => {
    const conditions = getIconsByCategory('conditions');
    expect(conditions.length).toBe(16);

    const requiredConditions = [
      'condition:blinded',
      'condition:charmed',
      'condition:deafened',
      'condition:frightened',
      'condition:grappled',
      'condition:incapacitated',
      'condition:invisible',
      'condition:paralyzed',
      'condition:petrified',
      'condition:poisoned',
      'condition:prone',
      'condition:restrained',
      'condition:stunned',
      'condition:unconscious',
      'condition:exhaustion',
      'condition:dead',
    ];

    for (const condId of requiredConditions) {
      const def = getIconDefinition(condId);
      expect(def).toBeDefined();
      expect(def?.category).toBe('conditions');
      expect(def?.defaultFallback).toBeTruthy();
      expect(def?.subjectPrompt).toBeTruthy();
    }
  });

  it('returns all icon definitions across categories', () => {
    const all = getAllIconDefinitions();
    expect(all.length).toBeGreaterThanOrEqual(40);
  });

  it('provides built-in theme packs with proper metadata', () => {
    expect(BUILT_IN_PACKS.length).toBeGreaterThanOrEqual(2);
    const vectorGold = BUILT_IN_PACKS.find((p) => p.id === 'nexus-vector-gold');
    expect(vectorGold).toBeDefined();
    expect(vectorGold?.icons['panel:atlas']).toBe('/assets/icons/panels/atlas.png');
    expect(vectorGold?.isBuiltIn).toBe(true);

    const defaultEmoji = BUILT_IN_PACKS.find((p) => p.id === 'default-emoji');
    expect(defaultEmoji).toBeDefined();
    expect(defaultEmoji?.isBuiltIn).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  generateSingleFaction,
  generateFactionWeb,
  generateKeyFigure,
  type FactionRelationshipType,
} from './factionGenerator';

describe('factionGenerator', () => {
  describe('generateKeyFigure', () => {
    it('generates a leader key figure with proper defaults', () => {
      const figure = generateKeyFigure('leader');
      expect(figure.role).toBe('leader');
      expect(figure.name).toBeTruthy();
      expect(figure.title).toBe('High Overseer');
      expect(figure.ancestry).toBeTruthy();
      expect(figure.personality).toBeTruthy();
      expect(figure.motivation).toBeTruthy();
    });

    it('generates a lieutenant key figure with custom title', () => {
      const figure = generateKeyFigure('lieutenant', 'First Inquisitor');
      expect(figure.role).toBe('lieutenant');
      expect(figure.title).toBe('First Inquisitor');
      expect(figure.name).toBeTruthy();
    });

    it('generates a specialist with default title', () => {
      const figure = generateKeyFigure('specialist');
      expect(figure.role).toBe('specialist');
      expect(figure.title).toBe('Trusted Lieutenant');
    });
  });

  describe('generateSingleFaction', () => {
    it('generates a default city-scoped faction with leader', () => {
      const faction = generateSingleFaction();
      expect(faction.tempId).toBe('faction-temp-1');
      expect(faction.name).toBeTruthy();
      expect(faction.archetype).toBeTruthy();
      expect(faction.scope).toBe('city');
      expect(faction.publicFace).toBeTruthy();
      expect(faction.hiddenAgenda).toBeTruthy();
      expect(faction.motto).toBeTruthy();
      expect(faction.primaryAsset).toBeTruthy();
      expect(faction.vulnerability).toBeTruthy();
      expect(faction.keyFigures.length).toBe(1);
      expect(faction.keyFigures[0].role).toBe('leader');
      expect(['ally', 'neutral', 'opposition', 'unknown']).toContain(faction.status);
    });

    it('supports custom scope and tempId', () => {
      const faction = generateSingleFaction({ scope: 'world' }, 'custom-id-99');
      expect(faction.tempId).toBe('custom-id-99');
      expect(faction.scope).toBe('world');
    });

    it('supports keyFiguresMode none', () => {
      const faction = generateSingleFaction({ keyFiguresMode: 'none' });
      expect(faction.keyFigures.length).toBe(0);
    });

    it('supports keyFiguresMode full (leader and lieutenant)', () => {
      const faction = generateSingleFaction({ keyFiguresMode: 'full' });
      expect(faction.keyFigures.length).toBe(2);
      expect(faction.keyFigures[0].role).toBe('leader');
      expect(faction.keyFigures[1].role).toBe('lieutenant');
    });

    it('filters by comedic theme', () => {
      const comedicFactions = Array.from({ length: 10 }).map(() =>
        generateSingleFaction({ theme: 'comedic' }),
      );
      for (const f of comedicFactions) {
        expect(f.theme).toBe('comedic');
      }
    });

    it('filters by churches theme', () => {
      const churchFactions = Array.from({ length: 10 }).map(() =>
        generateSingleFaction({ theme: 'churches' }),
      );
      for (const f of churchFactions) {
        expect(f.theme).toBe('churches');
      }
    });

    it('filters by intrigue, underworld, arcane, and military themes', () => {
      for (const theme of ['intrigue', 'underworld', 'arcane', 'military'] as const) {
        const faction = generateSingleFaction({ theme });
        expect(faction.theme).toBe(theme);
      }
    });
  });

  describe('generateFactionWeb', () => {
    it('generates an ecosystem of 3 factions with flashpoint and pairwise relationships', () => {
      const web = generateFactionWeb({ count: 3, scope: 'regional' });
      expect(web.factions.length).toBe(3);
      expect(web.scope).toBe('regional');
      expect(web.flashpoint).toBeDefined();
      expect(web.flashpoint?.title).toBeTruthy();
      expect(web.flashpoint?.summary).toBeTruthy();
      expect(web.flashpoint?.contestedResource).toBeTruthy();
      expect(web.flashpoint?.stakes).toBeTruthy();

      // For 3 factions, each faction should have relationships to the other 2
      for (const faction of web.factions) {
        expect(faction.relationships.length).toBe(2);
        for (const rel of faction.relationships) {
          expect(rel.targetTempId).not.toBe(faction.tempId);
          expect(rel.targetFactionName).toBeTruthy();
          expect(rel.summary).toBeTruthy();
          const validTypes: FactionRelationshipType[] = [
            'ally',
            'rival',
            'uneasy-truce',
            'infiltrated',
            'transactional',
            'ambivalent',
            'distant',
            'ignorance',
            'willful-ignorance',
          ];
          expect(validTypes).toContain(rel.type);
        }
      }
    });

    it('respects includeRelationships: false', () => {
      const web = generateFactionWeb({ count: 3, includeRelationships: false });
      expect(web.factions.length).toBe(3);
      for (const f of web.factions) {
        expect(f.relationships.length).toBe(0);
      }
    });

    it('clamps count between 1 and 6', () => {
      const webMin = generateFactionWeb({ count: 0 });
      expect(webMin.factions.length).toBe(1);
      expect(webMin.flashpoint).toBeUndefined(); // single faction has no central flashpoint

      const webMax = generateFactionWeb({ count: 10 });
      expect(webMax.factions.length).toBe(6);
      expect(webMax.flashpoint).toBeDefined();
    });

    it('allows custom flashpoint text', () => {
      const web = generateFactionWeb({
        count: 2,
        customFlashpoint: 'The shattered obelisk of the ancient desert empire.',
      });
      expect(web.flashpoint).toBeDefined();
      expect(web.flashpoint?.summary).toBe('The shattered obelisk of the ancient desert empire.');
      expect(web.flashpoint?.title).toBe('Central Campaign Flashpoint');
    });

    it('supports comedic themed ecosystem with appropriate flashpoints', () => {
      const web = generateFactionWeb({ count: 3, theme: 'comedic' });
      expect(web.theme).toBe('comedic');
      expect(web.factions.length).toBe(3);
      for (const f of web.factions) {
        expect(f.theme).toBe('comedic');
      }
      expect(web.flashpoint).toBeDefined();
    });

    it('generates consistent reciprocal relationships across pairs', () => {
      const web = generateFactionWeb({ count: 4, includeRelationships: true });
      const f0 = web.factions[0];
      const f1 = web.factions[1];

      const f0ToF1 = f0.relationships.find((r) => r.targetTempId === f1.tempId);
      const f1ToF0 = f1.relationships.find((r) => r.targetTempId === f0.tempId);

      expect(f0ToF1).toBeDefined();
      expect(f1ToF0).toBeDefined();
      expect(f0ToF1?.type).toBe(f1ToF0?.type);
    });

    it('handles keyFiguresMode none and full in web generation', () => {
      const webNone = generateFactionWeb({ count: 2, keyFiguresMode: 'none' });
      expect(webNone.factions[0].keyFigures.length).toBe(0);

      const webFull = generateFactionWeb({ count: 2, keyFiguresMode: 'full' });
      expect(webFull.factions[0].keyFigures.length).toBe(2);
      expect(webFull.factions[0].keyFigures[0].role).toBe('leader');
      expect(webFull.factions[0].keyFigures[1].role).toBe('lieutenant');
    });
  });
});

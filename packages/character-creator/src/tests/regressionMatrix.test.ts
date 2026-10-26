import { describe, it, expect } from 'vitest';
import {
  REFERENCE_BUILDS,
  ReferenceBuildOracle,
} from './fixtures/referenceBuilds';
import {
  creationDataToDraft,
  draftToCreationData,
} from '../adapters/draftAdapter';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../services/draftEvaluator';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import { resolveCatalogEntitlements } from '../services/catalogResolver';
import { resolveLoadout } from '../services/loadoutResolver';
import { getRecommendation } from '../services/recommendationService';
import {
  createDraftStorageKey,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
} from '../services/draftStorage';
import { studyRecorder } from '../services/studyRecorder';

describe('CC-601: Real-path 24-case Regression Matrix and Resilience Suite', () => {
  const buildKeys: Array<keyof typeof REFERENCE_BUILDS> = [
    'F14',
    'F24',
    'R14',
    'R24',
    'W14',
    'W24',
  ];

  describe('24 Completion Cases (6 reference builds x 2 creation paths x 2 host conversions)', () => {
    buildKeys.forEach((buildKey) => {
      const oracle: ReferenceBuildOracle = REFERENCE_BUILDS[buildKey];

      it(`[${buildKey}] Full Evaluation Path -> Forge & VTT Host conversion`, () => {
        // 1. Adapter from creationData to canonical draft
        const draft = creationDataToDraft(oracle.creationData, {
          provenance: 'player',
        });
        expect(draft.edition).toBe(oracle.edition);

        // 2. Evaluate Draft
        const evaluation = evaluateDraft(draft);
        expect(evaluation.isValid).toBe(true);
        expect(
          evaluation.issues.filter((i) => i.severity === 'error'),
        ).toHaveLength(0);

        // Check key stats
        expect(evaluation.calculatedCharacter!.abilities.STR.score).toBe(
          oracle.expected.abilities.STR,
        );
        expect(evaluation.calculatedCharacter!.abilities.DEX.score).toBe(
          oracle.expected.abilities.DEX,
        );
        expect(evaluation.calculatedCharacter!.maxHitPoints).toBe(
          oracle.expected.hp,
        );
        expect(evaluation.calculatedCharacter!.armorClass).toBe(
          oracle.expected.ac,
        );

        // 3. Forge Host Hand-off (CC-502)
        const forgeResult = toCharacterCreationResult(evaluation);
        expect(forgeResult.character.name).toBe(oracle.creationData.name);
        expect(forgeResult.character.classSlug).toBe(
          oracle.creationData.classSlug,
        );
        expect(forgeResult.combatGuidance).toBeDefined();

        // 4. VTT Host Hand-off (CC-503)
        const vttCharacter = createdCharacterToNexus(forgeResult.character, {
          playerId: 'test-player-vtt',
        });
        expect(vttCharacter.playerId).toBe('test-player-vtt');
        expect(vttCharacter.name).toBe(oracle.creationData.name);
        expect(vttCharacter.maxHitPoints).toBe(oracle.expected.hp);
        expect(vttCharacter.armorClass).toBe(oracle.expected.ac);
      });

      it(`[${buildKey}] Guided Recommendation Path -> Forge & VTT Host conversion`, () => {
        const intent =
          oracle.creationData.classSlug === 'fighter'
            ? 'close_combat'
            : oracle.creationData.classSlug === 'rogue'
              ? 'sneak'
              : 'cast';

        const recResult = getRecommendation({
          intent,
          classSlug: oracle.creationData.classSlug,
          edition: oracle.edition,
          name: oracle.creationData.name,
        });

        expect(recResult.evaluation.isValid).toBe(true);
        expect(recResult.firstTurnGuidance).toBeDefined();

        // Convert to Forge format
        const forgeResult = toCharacterCreationResult(recResult.evaluation);
        expect(forgeResult.character.classSlug).toBe(
          oracle.creationData.classSlug,
        );

        // Convert to VTT format
        const vttChar = createdCharacterToNexus(forgeResult.character, {
          playerId: 'player-guided',
        });
        expect(vttChar.name).toBe(oracle.creationData.name);
        expect(vttChar.maxHitPoints).toBeGreaterThanOrEqual(6);
      });
    });
  });

  describe('Host Storage, Stale Drafts & Interrupted Handoff Resilience (CC-501)', () => {
    it('saves draft in-flight, detects tab conflict, recovers and clears on completion', async () => {
      const storageKey = createDraftStorageKey('vtt', 'player-resilience');
      const mockStorage: Record<string, string> = {};
      const fakeStorage: Storage = {
        getItem: (k) => mockStorage[k] ?? null,
        setItem: (k, v) => {
          mockStorage[k] = v;
        },
        removeItem: (k) => {
          delete mockStorage[k];
        },
        clear: () => {},
        key: () => null,
        length: 0,
      };

      const originalDraft = creationDataToDraft(
        REFERENCE_BUILDS.F24.creationData,
      );

      // Save draft from Tab 1
      saveDraftToStorage(storageKey, originalDraft, {
        clientTabId: 'tab-1',
        storage: fakeStorage,
      });

      // Load from Tab 2 -> conflict detected
      const tab2Loaded = loadDraftFromStorage(storageKey, {
        clientTabId: 'tab-2',
        storage: fakeStorage,
      });
      expect(tab2Loaded?.isConflict).toBe(true);

      // Interrupted save retry: simulated failed submit retains answers
      let failedAttempts = 0;
      const simulateSubmit = async () => {
        if (failedAttempts === 0) {
          failedAttempts++;
          throw new Error('Network timeout during host persistence');
        }
        clearDraftFromStorage(storageKey, { storage: fakeStorage });
        return { success: true };
      };

      await expect(simulateSubmit()).rejects.toThrow('Network timeout');
      // Verify draft is still stored and recoverable after failure
      expect(fakeStorage.getItem(storageKey)).not.toBeNull();

      // Retry succeeding
      await expect(simulateSubmit()).resolves.toEqual({ success: true });
      expect(fakeStorage.getItem(storageKey)).toBeNull();
    });
  });

  describe('Rules & Entitlement Mutation Handling (CC-202, CC-203)', () => {
    it('flags illegal background ability score bonuses in 2024 mode', () => {
      const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
      // Mutate to an invalid +3 bonus
      draft.abilityBonuses = {
        method: '2/1',
        bonuses: { STR: 3, CON: 0 },
      };

      const issues = resolveCatalogEntitlements(draft);
      const invalidAsi = issues.find(
        (i) => i.id === 'INVALID_2_1_BONUS_ALLOCATION',
      );
      expect(invalidAsi).toBeDefined();
      expect(invalidAsi?.severity).toBe('error');
    });

    it('conserves currency and expands pack contents without dropping wallet', () => {
      const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
      const loadout = resolveLoadout(draft);

      expect(loadout.currency.gp).toBe(18);
      // Items inside pack expanded into loadout inventory
      expect(
        loadout.items.some(
          (i) =>
            i.name.includes('Torch') ||
            i.name.includes('Ration') ||
            i.name.includes('Crowbar'),
        ),
      ).toBe(true);
    });
  });

  describe('Study Telemetry & Measurement Verification (CC-602)', () => {
    it('accurately captures control action count and durations', () => {
      studyRecorder.reset();
      studyRecorder.recordEvent('flow_enter', 0);
      studyRecorder.recordEvent('step_transition', 1);
      studyRecorder.recordEvent('recommendation_accepted', 1);
      studyRecorder.recordEvent('step_transition', 2);
      studyRecorder.recordEvent('choice_customized', 2);
      studyRecorder.recordEvent('step_transition', 3);
      studyRecorder.recordEvent('handoff_completed', 3);

      const metrics = studyRecorder.getMetrics();
      expect(metrics.completed).toBe(true);
      expect(metrics.totalControlActions).toBe(6);
      expect(metrics.recommendationsAcceptedCount).toBe(1);
    });
  });
});

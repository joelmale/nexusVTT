import { Character } from '../types/dnd';
import { CharacterCreationResult } from '../api/types';
import { CreationDraft, DraftEvaluationResult, DraftIssue } from '../types/draft';
import { draftToCreationData } from '../adapters/draftAdapter';
import { resolveCatalogEntitlements } from './catalogResolver';
import { resolveLoadout } from './loadoutResolver';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { loadClasses } from './dataService';
import { getMaxPreparedSpells } from '../utils/spellUtils';
import cantripsData from '../data/cantrips.json';

const EVALUATOR_VERSION = '1.0.0';

/**
 * Validates edition-specific spellcasting limits (CC-205)
 */
function validateSpellcasting(draft: CreationDraft, calculated: Character): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const classList = loadClasses(draft.edition);
  const classData = classList.find(c => c.slug === draft.classSlug);

  if (!classData?.spellcasting) {
    return issues;
  }

  // Check Cantrips count
  let requiredCantrips =
    (cantripsData as Record<string, Record<string, number>>)[draft.classSlug || '']?.[draft.level] ||
    classData.spellcasting.cantripsKnown || 0;

  // 2024 Cleric Thaumaturge gets +1 cantrip
  if (draft.classSlug === 'cleric' && draft.edition === '2024') {
    // optional bonus
  }

  const selectedCantripsCount = draft.spells.cantrips.length;
  if (selectedCantripsCount < requiredCantrips) {
    issues.push({
      id: 'INSUFFICIENT_CANTRIPS_SELECTED',
      step: 4,
      group: 'spells',
      severity: 'error',
      message: `${classData.name} requires selecting ${requiredCantrips} cantrips, but ${selectedCantripsCount} were selected.`,
      repairTarget: 'spell-selection',
    });
  }

  // Check Wizard Spellbook and Preparation (2014 vs 2024)
  if (draft.classSlug === 'wizard') {
    const spellbookCount = draft.spells.knownOrBook.length;
    if (draft.level === 1 && spellbookCount < 6) {
      issues.push({
        id: 'INSUFFICIENT_WIZARD_SPELLBOOK',
        step: 4,
        group: 'spells',
        severity: 'warning',
        message: 'A 1st-level Wizard starts with 6 1st-level spells in their spellbook.',
        repairTarget: 'spell-selection',
      });
    }

    const intMod = calculated.abilities.INT.modifier;
    const maxPrepared = Math.max(1, draft.level + intMod);

    const preparedCount = draft.spells.prepared.length;
    if (preparedCount > maxPrepared) {
      issues.push({
        id: 'EXCEEDED_PREPARED_SPELLS_LIMIT',
        step: 4,
        group: 'spells',
        severity: 'error',
        message: `You have prepared ${preparedCount} spells, but your maximum prepared spells is ${maxPrepared}.`,
        repairTarget: 'spell-preparation',
      });
    }
  }

  return issues;
}

/**
 * Evaluates a canonical CreationDraft against rules and catalog entitlements (CC-204, CC-205)
 */
export function evaluateDraft(draft: CreationDraft): DraftEvaluationResult {
  // 1. Resolve loadout
  const resolvedLoadout = resolveLoadout(draft);
  const updatedDraft: CreationDraft = {
    ...draft,
    loadout: resolvedLoadout,
  };

  // 2. Catalog & Entitlement checks (CC-202)
  const catalogIssues = resolveCatalogEntitlements(updatedDraft);

  // 3. Compute Character Stats
  const creationData = draftToCreationData(updatedDraft);
  const calculatedCharacter = calculateCharacterStats(creationData);

  // Sync loadout items and currency into calculated character
  calculatedCharacter.currency = {
    cp: resolvedLoadout.currency.cp,
    sp: resolvedLoadout.currency.sp,
    ep: resolvedLoadout.currency.ep,
    gp: resolvedLoadout.currency.gp,
    pp: resolvedLoadout.currency.pp,
  };

  // 4. Validate Spellcasting (CC-205)
  const spellIssues = validateSpellcasting(updatedDraft, calculatedCharacter);

  const allIssues = [...catalogIssues, ...spellIssues];
  const isValid = allIssues.filter(i => i.severity === 'error').length === 0;

  return {
    draft: updatedDraft,
    calculatedCharacter,
    issues: allIssues,
    isValid,
    evaluatedAt: new Date().toISOString(),
    evaluatorVersion: EVALUATOR_VERSION,
  };
}

import { generateFirstTurnGuidance } from './guidanceService';

/**
 * Converts an evaluation result into the host CharacterCreationResult contract (CC-206, CC-504)
 */
export function toCharacterCreationResult(
  evaluation: DraftEvaluationResult
): CharacterCreationResult {
  const creationData = draftToCreationData(evaluation.draft);
  const isArcher = evaluation.draft.loadout?.items?.some((i) =>
    i.name.toLowerCase().includes('bow') || i.name.toLowerCase().includes('crossbow')
  ) ?? false;
  const combatGuidance = generateFirstTurnGuidance(evaluation.draft, isArcher);

  return {
    character: evaluation.calculatedCharacter,
    creationData,
    edition: evaluation.draft.edition,
    createdAt: evaluation.evaluatedAt,
    combatGuidance,
  };
}

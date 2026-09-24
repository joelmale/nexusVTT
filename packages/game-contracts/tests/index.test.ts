import { describe, it, expect } from 'vitest';
import * as GameContracts from '../src/index';

describe('GameContracts Root Index Re-exports', () => {
  it('exports all expected schemas and builders', () => {
    expect(GameContracts.definitionRefSchema).toBeDefined();
    expect(GameContracts.rulesetRefSchema).toBeDefined();
    expect(GameContracts.characterRecordSchema).toBeDefined();
    expect(GameContracts.campaignActorSchema).toBeDefined();
    expect(GameContracts.monsterDefinitionSchema).toBeDefined();
    expect(GameContracts.encounterTemplateSchema).toBeDefined();
    expect(GameContracts.encounterRunSchema).toBeDefined();
    expect(GameContracts.spellDefinitionSchema).toBeDefined();
    expect(GameContracts.spellCollectionSchema).toBeDefined();
    expect(GameContracts.spellcastingProfileSchema).toBeDefined();
    expect(GameContracts.itemDefinitionSchema).toBeDefined();
    expect(GameContracts.itemInstanceSchema).toBeDefined();
    expect(GameContracts.domainCommandSchema).toBeDefined();
    expect(GameContracts.domainCommandReceiptSchema).toBeDefined();
  });
});

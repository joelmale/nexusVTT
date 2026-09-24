import { describe, it, expect } from 'vitest';
import {
  definitionRefSchema,
  rulesetRefSchema,
  authoredMetadataSchema,
  permissionGrantSchema,
} from '../src';

describe('Identity & Reference Schemas', () => {
  it('validates a correct definitionRef', () => {
    const validRef = {
      kind: 'character',
      id: '11111111-1111-4111-8111-111111111111',
      revision: 3,
    };
    const parsed = definitionRefSchema.parse(validRef);
    expect(parsed.kind).toBe('character');
    expect(parsed.revision).toBe(3);
  });

  it('rejects invalid UUID or negative revision in definitionRef', () => {
    expect(() =>
      definitionRefSchema.parse({
        kind: 'monster',
        id: 'not-a-uuid',
        revision: 1,
      }),
    ).toThrow();

    expect(() =>
      definitionRefSchema.parse({
        kind: 'monster',
        id: '11111111-1111-4111-8111-111111111111',
        revision: -1,
      }),
    ).toThrow();
  });

  it('validates 2014 and 2024 D&D 5e ruleset references', () => {
    const ruleset2014 = {
      system: 'dnd5e',
      edition: '2014',
      contentPackId: 'srd-5.1',
      contentRevision: '1.0',
      rulesRevision: '1.0',
    };
    expect(rulesetRefSchema.parse(ruleset2014).edition).toBe('2014');

    const ruleset2024 = {
      system: 'dnd5e',
      edition: '2024',
      contentPackId: 'srd-5.2.1',
      contentRevision: '1.0',
      rulesRevision: '1.0',
    };
    expect(rulesetRefSchema.parse(ruleset2024).edition).toBe('2024');
  });

  it('validates authored metadata and permission grants', () => {
    const metadata = {
      id: '22222222-2222-4222-8222-222222222222',
      schemaVersion: 1,
      revision: 1,
      ownerId: 'user-1',
      name: 'Test Record',
      createdAt: '2026-09-24T00:00:00Z',
      updatedAt: '2026-09-24T00:00:00Z',
    };
    const parsedMeta = authoredMetadataSchema.parse(metadata);
    expect(parsedMeta.archived).toBe(false);
    expect(parsedMeta.tags).toEqual([]);

    const grant = {
      principalId: 'user-2',
      role: 'controller',
      grantedAt: '2026-09-24T00:00:00Z',
    };
    expect(permissionGrantSchema.parse(grant).role).toBe('controller');
  });
});

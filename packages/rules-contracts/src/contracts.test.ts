import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_RATING_XP,
  CreateRulesEntityRequestSchema,
  MonsterSchema,
  RulesEntityRevisionEnvelopeSchema,
  RulesEntityListQuerySchema,
  SlugSchema,
  averageForDice,
  collectRulesReferences,
  parseRulesEntityData,
  proficiencyBonusForChallengeRating,
  summarizeRulesEntity,
  toCatalogEntity,
  type Monster,
  type RulesEntityData,
} from './index.js';
import {
  fireball2014,
  goblin2014,
  invalidRulesFixtures,
  lich2014,
  longsword2024,
  validRulesFixtures,
  wandOfFireballs2014,
} from './fixtures/index.js';

describe('valid fixtures', () => {
  it('cover every entity type in both rulesets', () => {
    const combos = new Set(validRulesFixtures.map((f) => `${f.entityType}:${f.ruleset}`));
    for (const type of ['spell', 'item', 'monster']) {
      for (const ruleset of ['2014', '2024']) {
        expect(combos.has(`${type}:${ruleset}`)).toBe(true);
      }
    }
  });

  it.each(validRulesFixtures.map((f) => [f.name, f] as const))('%s parses', (_name, fixture) => {
    const result = parseRulesEntityData(fixture.entityType, fixture.ruleset, fixture.data);
    if (!result.success) {
      throw new Error(JSON.stringify(result.issues, null, 2));
    }
    expect(result.data.ruleset).toBe(fixture.ruleset);
  });

  it.each(validRulesFixtures.map((f) => [f.name, f] as const))('%s passes the envelope', (_name, fixture) => {
    const result = RulesEntityRevisionEnvelopeSchema.safeParse({
      entityType: fixture.entityType,
      slug: fixture.slug,
      ruleset: fixture.ruleset,
      data: fixture.data,
      sourceLicense: 'CC-BY-4.0',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.schemaVersion).toBe(1);
  });
});

describe('invalid fixtures', () => {
  it.each(invalidRulesFixtures.map((f) => [f.name, f] as const))('%s is rejected', (_name, fixture) => {
    const result = parseRulesEntityData(fixture.entityType, fixture.ruleset, fixture.data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain(fixture.expectedPath);
    }
  });
});

describe('ruleset compatibility', () => {
  it('rejects data whose ruleset differs from the entity', () => {
    const result = parseRulesEntityData('spell', '2024', fireball2014);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0].code).toBe('ruleset_mismatch');
  });

  it('accepts 2024 mastery but not on a 2014 weapon', () => {
    expect(parseRulesEntityData('item', '2024', longsword2024).success).toBe(true);
    expect(parseRulesEntityData('item', '2014', { ...longsword2024, ruleset: '2014' }).success).toBe(false);
  });

  it('envelope reports data issues under data.*', () => {
    const result = RulesEntityRevisionEnvelopeSchema.safeParse({
      entityType: 'monster',
      slug: 'goblin',
      ruleset: '2014',
      data: { ...goblin2014, xp: 1 },
      sourceLicense: 'CC-BY-4.0',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['data', 'xp']);
  });

  it('envelope rejects unsupported schema versions and bad slugs', () => {
    const base = { entityType: 'spell', slug: 'fireball', ruleset: '2014', data: fireball2014, sourceLicense: 'OGL-1.0a' };
    expect(RulesEntityRevisionEnvelopeSchema.safeParse({ ...base, schemaVersion: 99 }).success).toBe(false);
    expect(RulesEntityRevisionEnvelopeSchema.safeParse({ ...base, slug: 'Fire Ball' }).success).toBe(false);
    expect(RulesEntityRevisionEnvelopeSchema.safeParse({ ...base, sourceLicense: '' }).success).toBe(false);
  });
});

describe('monster rules tables', () => {
  it('accepts every CR with its XP value', () => {
    for (const [cr, xps] of Object.entries(CHALLENGE_RATING_XP)) {
      for (const xp of xps) {
        const result = MonsterSchema.safeParse({ ...goblin2014, challengeRating: Number(cr), xp, proficiencyBonus: undefined });
        expect(result.success, `CR ${cr} / ${xp} XP`).toBe(true);
      }
    }
  });

  it('computes proficiency bonus by CR', () => {
    expect(proficiencyBonusForChallengeRating(0)).toBe(2);
    expect(proficiencyBonusForChallengeRating(4)).toBe(2);
    expect(proficiencyBonusForChallengeRating(5)).toBe(3);
    expect(proficiencyBonusForChallengeRating(17)).toBe(6);
    expect(proficiencyBonusForChallengeRating(21)).toBe(7);
    expect(proficiencyBonusForChallengeRating(30)).toBe(9);
  });

  it('averages dice expressions', () => {
    expect(averageForDice('2d6')).toBe(7);
    expect(averageForDice('18d8 + 54')).toBe(135);
    expect(averageForDice('4d8-4')).toBe(14);
    expect(averageForDice('1')).toBe(1);
    expect(averageForDice('d6')).toBeUndefined();
  });

  it('applies defaults so consumers see normalized arrays', () => {
    const parsed = MonsterSchema.parse(goblin2014) as Monster;
    expect(parsed.reactions).toEqual([]);
    expect(parsed.damageImmunities).toEqual([]);
    expect(parsed.savingThrows).toEqual({});
  });
});

describe('references and presentation', () => {
  it('collects monster spell references and item spell references', () => {
    const lich = parseRulesEntityData('monster', '2014', lich2014);
    const wand = parseRulesEntityData('item', '2014', wandOfFireballs2014);
    if (!lich.success || !wand.success) throw new Error('fixtures must parse');
    expect(collectRulesReferences('monster', lich.data)).toEqual([
      { entityType: 'spell', slug: 'fireball', path: ['spellcasting', 0, 'spells', 0, 'ref'] },
    ]);
    expect(collectRulesReferences('item', wand.data)).toEqual([
      { entityType: 'spell', slug: 'fireball', path: ['spells', 0, 'ref'] },
    ]);
  });

  it('summarizes each entity type', () => {
    const parse = (type: 'spell' | 'item' | 'monster', ruleset: '2014' | '2024', data: unknown) => {
      const result = parseRulesEntityData(type, ruleset, data);
      if (!result.success) throw new Error('fixture must parse');
      return result.data as RulesEntityData;
    };
    expect(summarizeRulesEntity('spell', parse('spell', '2014', fireball2014))).toBe('3rd-level evocation');
    expect(summarizeRulesEntity('item', parse('item', '2014', wandOfFireballs2014))).toBe(
      'Wand, rare (requires attunement by a spellcaster)',
    );
    expect(summarizeRulesEntity('monster', parse('monster', '2014', goblin2014))).toBe(
      'Small humanoid (goblinoid), neutral evil; CR 1/4 (50 XP)',
    );
  });

  it('builds catalog entities and refuses corrupt stored data', () => {
    const meta = {
      id: 'e1',
      entityType: 'spell' as const,
      ruleset: '2014' as const,
      slug: 'fireball',
      schemaVersion: 1,
      revisionId: 'r1',
      revisionNumber: 1,
      catalogVersion: 3,
      publishedAt: '2026-09-23T00:00:00.000Z',
      sourceLicense: 'CC-BY-4.0',
      sourceDocumentId: null,
    };
    const entity = toCatalogEntity(meta, fireball2014);
    expect(entity.summary).toBe('3rd-level evocation');
    expect(entity.data).toMatchObject({ name: 'Fireball' });
    expect(() => toCatalogEntity(meta, { ...fireball2014, level: 12 })).toThrow(/invalid/);
  });
});

describe('api contracts', () => {
  it('validates slugs', () => {
    expect(SlugSchema.safeParse('adult-red-dragon').success).toBe(true);
    for (const slug of ['Adult', 'a--b', '-a', 'a b', '']) {
      expect(SlugSchema.safeParse(slug).success).toBe(false);
    }
  });

  it('defaults list queries and rejects unknown filters', () => {
    expect(RulesEntityListQuerySchema.parse({})).toEqual({ archived: 'false', limit: 50, offset: 0 });
    expect(RulesEntityListQuerySchema.parse({ limit: '10', type: 'spell' })).toMatchObject({ limit: 10, type: 'spell' });
    expect(RulesEntityListQuerySchema.safeParse({ type: 'class' }).success).toBe(false);
    expect(RulesEntityListQuerySchema.safeParse({ bogus: '1' }).success).toBe(false);
  });

  it('requires a source licence when creating entities', () => {
    const base = { entityType: 'spell', ruleset: '2014', slug: 'fireball', data: fireball2014 };
    expect(CreateRulesEntityRequestSchema.safeParse(base).success).toBe(false);
    expect(CreateRulesEntityRequestSchema.safeParse({ ...base, sourceLicense: 'CC-BY-4.0' }).success).toBe(true);
  });
});

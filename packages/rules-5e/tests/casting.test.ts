import { describe, it, expect } from 'vitest';
import { evaluateCastEligibility } from '../src';
import type { CampaignActor, SpellDefinition } from '@nexus/game-contracts';

describe('D&D 5e Cast Eligibility Evaluator', () => {
  const mockSpell: SpellDefinition = {
    id: '22222222-2222-4222-8222-222222222222',
    kind: 'spell',
    schemaVersion: 1,
    revision: 1,
    ownerId: 'system',
    name: 'Hold Person',
    slug: 'hold-person',
    tags: ['enchantment'],
    archived: false,
    ruleset: {
      system: 'dnd5e',
      edition: '2024',
      contentPackId: 'srd-5.2.1',
      contentRevision: '1.0',
      rulesRevision: '1.0',
    },
    level: 2,
    school: 'enchantment',
    castingTime: '1 action',
    range: '60 feet',
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialDescription: 'A small, straight piece of iron',
      materialConsumed: false,
    },
    description: 'Choose a humanoid that you can see within range.',
    classes: ['wizard', 'cleric'],
    createdAt: '2026-09-24T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  };

  const mockActor: CampaignActor = {
    campaignActorId: '77777777-7777-4777-8777-777777777777',
    campaignId: '99999999-9999-4999-8999-999999999999',
    name: 'Gildas',
    actorKind: 'pc',
    sourceRef: {
      kind: 'character',
      id: '11111111-1111-4111-8111-111111111111',
      revision: 1,
    },
    ruleset: mockSpell.ruleset,
    stateVersion: 1,
    controllerUserIds: ['user-1'],
    activeSessionId: null,
    hp: { current: 30, max: 30, temp: 0 },
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    concentration: {
      castId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      spellRef: {
        kind: 'spell',
        id: '55555555-5555-4555-8555-555555555555',
        revision: 1,
      },
      spellName: 'Bless',
      startedAtRound: 1,
      startedAtTurn: 1,
      targetActorIds: [],
      drawingIds: [],
    },
    resourcePools: {
      'standard-slots': {
        id: 'standard-slots',
        name: 'Spell Slots',
        poolType: 'slots',
        slots: {
          1: { total: 4, current: 2 },
          2: { total: 3, current: 1 },
          3: { total: 2, current: 0 },
        },
        resetOn: 'long-rest',
      },
      'pact-slots': {
        id: 'pact-slots',
        name: 'Pact Magic',
        poolType: 'pact',
        current: 2,
        max: 2,
        resetOn: 'short-rest',
      },
    },
    spellcastingProfiles: [
      {
        profileId: 'wiz-1',
        name: 'Wizard Spellcasting',
        sourceType: 'class',
        sourceSlug: 'wizard',
        spellcastingAbility: 'INT',
        spellSaveDC: 15,
        spellAttackBonus: 7,
        isRitualCaster: true,
        preparationMode: 'prepared',
        resourcePoolId: 'standard-slots',
        boundCollectionIds: [],
        knownSpellSlugs: ['hold-person', 'fireball', 'fire-bolt'],
        preparedSpellSlugs: ['hold-person'],
      },
      {
        profileId: 'lock-1',
        name: 'Pact Magic',
        sourceType: 'class',
        sourceSlug: 'warlock',
        spellcastingAbility: 'CHA',
        spellSaveDC: 14,
        spellAttackBonus: 6,
        isRitualCaster: false,
        preparationMode: 'known',
        resourcePoolId: 'pact-slots',
        boundCollectionIds: [],
        knownSpellSlugs: ['hold-person'],
        preparedSpellSlugs: [],
      },
      {
        profileId: 'broken-pool-prof',
        name: 'Broken Pool',
        sourceType: 'class',
        sourceSlug: 'wizard',
        spellcastingAbility: 'INT',
        spellSaveDC: 12,
        spellAttackBonus: 4,
        isRitualCaster: false,
        preparationMode: 'known',
        resourcePoolId: 'missing-pool',
        boundCollectionIds: [],
        knownSpellSlugs: ['hold-person'],
        preparedSpellSlugs: [],
      },
    ],
    inventory: [],
    createdAt: '2026-09-24T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  };

  it('evaluates a valid cast with remaining slots and warns about concentration', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: mockSpell,
      profileId: 'wiz-1',
      castAtLevel: 2,
    });

    expect(result.canCast).toBe(true);
    expect(result.poolIdToCharge).toBe('standard-slots');
    expect(result.slotLevelToCharge).toBe(2);
    expect(result.willBreakConcentration).toBe(true);
    expect(result.breaksConcentrationOn).toBe('Bless');
  });

  it('rejects casting when profile does not exist on actor', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: mockSpell,
      profileId: 'non-existent-profile',
      castAtLevel: 2,
    });

    expect(result.canCast).toBe(false);
    expect(result.reasons[0]).toContain("not have spellcasting profile 'non-existent-profile'");
  });

  it('casts cantrips without slot expenditure and without concentration warning when non-concentration', () => {
    const cantrip: SpellDefinition = {
      ...mockSpell,
      level: 0,
      name: 'Fire Bolt',
      slug: 'fire-bolt',
      concentration: false,
    };

    const actorNoConc = { ...mockActor, concentration: null };
    const result = evaluateCastEligibility({
      actor: actorNoConc,
      spell: cantrip,
      profileId: 'wiz-1',
      castAtLevel: 0,
    });

    expect(result.canCast).toBe(true);
    expect(result.poolIdToCharge).toBeUndefined();
    expect(result.willBreakConcentration).toBe(false);
  });

  it('casts using Pact Magic pool and rejects when pact slots are exhausted', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: mockSpell,
      profileId: 'lock-1',
      castAtLevel: 2,
    });

    expect(result.canCast).toBe(true);
    expect(result.poolIdToCharge).toBe('pact-slots');

    // With 0 pact slots
    const actorNoPact = {
      ...mockActor,
      resourcePools: {
        ...mockActor.resourcePools,
        'pact-slots': {
          ...mockActor.resourcePools['pact-slots'],
          current: 0,
        },
      },
    };

    const failedResult = evaluateCastEligibility({
      actor: actorNoPact,
      spell: mockSpell,
      profileId: 'lock-1',
      castAtLevel: 2,
    });

    expect(failedResult.canCast).toBe(false);
    expect(failedResult.reasons[0]).toContain('No Pact Magic slots remaining');
  });

  it('rejects casting if the resource pool is missing from actor', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: mockSpell,
      profileId: 'broken-pool-prof',
      castAtLevel: 2,
    });

    expect(result.canCast).toBe(false);
    expect(result.reasons[0]).toContain("Associated resource pool 'missing-pool' not found");
  });

  it('rejects casting when spell slots for that level are exhausted', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: mockSpell,
      profileId: 'wiz-1',
      castAtLevel: 3, // Level 3 slots have current: 0
    });

    expect(result.canCast).toBe(false);
    expect(result.reasons[0]).toContain('No level 3 spell slots remaining');
  });

  it('rejects casting when casting below the base spell level', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: mockSpell,
      profileId: 'wiz-1',
      castAtLevel: 1, // Hold person is level 2
    });

    expect(result.canCast).toBe(false);
    expect(result.reasons[0]).toContain('Cannot cast a level 2 spell at slot level 1');
  });

  it('rejects casting an unprepared spell', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: { ...mockSpell, slug: 'fireball', level: 3 },
      profileId: 'wiz-1',
      castAtLevel: 3,
    });

    expect(result.canCast).toBe(false);
    expect(result.reasons[0]).toContain('not currently prepared');
  });

  it('rejects casting an unknown spell for known preparationMode', () => {
    const result = evaluateCastEligibility({
      actor: mockActor,
      spell: { ...mockSpell, slug: 'unknown-spell', level: 2 },
      profileId: 'lock-1',
      castAtLevel: 2,
    });

    expect(result.canCast).toBe(false);
    expect(result.reasons[0]).toContain('not in known spells');
  });
});

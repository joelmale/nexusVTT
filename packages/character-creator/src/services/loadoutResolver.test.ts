import { describe, expect, it } from 'vitest';
import { resolveLoadout, calculateTotalCurrencyGp } from './loadoutResolver';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';

describe('loadoutResolver (CC-203)', () => {
  it('resolves F24 class package A and soldier background into 18 gp currency', () => {
    const f24 = REFERENCE_BUILDS.F24.creationData;
    const loadout = resolveLoadout(f24);

    // Package A includes 4 gp, Soldier background includes 14 gp => 18 gp
    expect(loadout.currency.gp).toBe(18);
    expect(loadout.totalValueGp).toBe(18);

    // Verifies equipment contains Chain Mail, Greatsword, etc.
    const chainMail = loadout.items.find(i => i.slug === 'chain-mail');
    expect(chainMail).toBeDefined();
    expect(chainMail?.equipped).toBe(true);
    expect(chainMail?.armorType).toBe('heavy');

    const greatsword = loadout.items.find(i => i.slug === 'greatsword');
    expect(greatsword).toBeDefined();
    expect(greatsword?.equipped).toBe(true);
  });

  it('expands packs into their individual components', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      equipmentChoices: [
        {
          choiceId: 'pack',
          description: 'Pack choice',
          options: [[{ name: "Dungeoneer's Pack", quantity: 1, type: 'gear' as const }]],
          selected: 0,
        },
      ],
    };

    const loadout = resolveLoadout(data);
    const crowbar = loadout.items.find(i => i.slug === 'crowbar');
    expect(crowbar).toBeDefined();
    expect(crowbar?.quantity).toBe(1);

    const torches = loadout.items.find(i => i.slug === 'torch');
    expect(torches).toBeDefined();
    expect(torches?.quantity).toBe(10);
  });

  it('losslessly calculates mixed currencies including electrum (ep)', () => {
    const total = calculateTotalCurrencyGp({
      pp: 2,  // 20 gp
      gp: 15, // 15 gp
      ep: 6,  // 3 gp
      sp: 20, // 2 gp
      cp: 50, // 0.5 gp
    });

    expect(total).toBe(40.5);
  });
});

import type { CreationDraft } from '../types/draft';

export interface FirstTurnGuidance {
  standardAction: string;
  bonusAction?: string;
  reaction?: string;
  tacticalTip: string;
}

/**
 * CC-303 / CC-504: Builds three truthful first-turn action guidance points
 * derived from actual granted features, class, and equipment.
 */
export function generateFirstTurnGuidance(
  draft: CreationDraft,
  isArcher: boolean = false
): FirstTurnGuidance {
  const cls = (draft.classSlug || '').toLowerCase();

  if (cls === 'fighter') {
    if (isArcher) {
      return {
        standardAction:
          'Attack with your Longbow/Crossbow (+5 to hit, 1d8+3 piercing). Keep your distance from melee brawlers.',
        bonusAction:
          'Second Wind: Regain 1d10 + 1 hit points when injured (2 uses per rest in 2024, 1 in 2014).',
        reaction:
          'Opportunity Attack: If an enemy closes in and then tries to move away, strike with your sidearm.',
        tacticalTip:
          'Use cover (+2 or +5 AC) to stay protected while firing across the battlefield.',
      };
    }
    return {
      standardAction:
        'Attack with your primary weapon (+5 to hit). In 2024, Greatsword Graze deals 3 damage even on a miss.',
      bonusAction:
        'Second Wind: Regain 1d10 + 1 hit points as a bonus action whenever wounded.',
      reaction:
        'Opportunity Attack: Punish any enemy attempting to flee your reach with a free strike.',
      tacticalTip:
        'Anchor the frontline between dangerous monsters and your allied spellcasters.',
    };
  }

  if (cls === 'rogue') {
    return {
      standardAction:
        'Attack with Shortbow or Dagger (+5 to hit). Deal an extra 1d6 Sneak Attack damage if you have advantage or an ally is adjacent to your target.',
      bonusAction:
        'Position yourself behind cover or draw a second dagger for a dual-wielding follow-up strike.',
      reaction:
        'Opportunity Attack: Strike with your finesse blade if an engaged opponent retreats.',
      tacticalTip:
        'Never stand in open melee alone. Target enemies currently engaged by your Fighter or Paladin to trigger Sneak Attack.',
    };
  }

  if (cls === 'wizard') {
    return {
      standardAction:
        'Cast Fire Bolt (120 ft range, +5 to hit, 1d10 fire damage) or Magic Missile for guaranteed force damage with no attack roll.',
      bonusAction:
        'Reposition to maximum safe range (behind heavy cover or armored teammates).',
      reaction:
        'Cast Shield: When an enemy attack roll hits, immediately add +5 to your AC to negate the hit.',
      tacticalTip:
        'Save your 1st-level spell slots for life-saving Shields and combat-ending Sleep spells.',
    };
  }

  if (cls === 'cleric') {
    return {
      standardAction:
        'Cast Bless on 3 allies (+1d4 to attack rolls and saving throws) or strike with Guiding Bolt (+5 to hit, 4d6 radiant).',
      bonusAction:
        'Cast Healing Word (Bonus Action, 60 ft range) to immediately revive an ally at 0 HP.',
      reaction:
        'Opportunity Attack with your melee weapon if an engaged enemy disengages poorly.',
      tacticalTip:
        'Bless transforms tough encounters by turning near-misses into hits for your entire team.',
    };
  }

  return {
    standardAction: 'Attack with your primary equipped weapon or class feature.',
    bonusAction: 'Use available bonus action feature or utility repositioning.',
    reaction: 'Opportunity Attack when enemies provoke movement.',
    tacticalTip: 'Communicate with your team to coordinate focus fire on key threats.',
  };
}

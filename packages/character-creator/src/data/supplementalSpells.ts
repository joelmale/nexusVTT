/**
 * Mechanics-only entries for non-SRD spells that appear on the legacy Artificer
 * spell list (Tasha's Cauldron of Everything and related books).
 *
 * This file deliberately contains facts (level, school, timing, range,
 * components, duration, and the damage or saving throw numbers the sheet needs)
 * and no rules prose, because the descriptions are published, copyrighted text
 * and this repository is public. Players who own the books can supply the prose
 * through the optional local content pack described in `localSpellPack.ts`.
 *
 * Source for the facts: the user-supplied legacy Artificer reference (spell
 * list page), accessed 2026-10-27, and the user's own notes for the damage dice.
 * The three Unearthed Arcana playtest spells on that list are not included.
 */
import type { AbilityName } from '../types/dnd';

export interface SpellMechanics {
  /** Dice rolled for one hit or one failed save at the caster's first tier. */
  damage?: { dice: string; type: string; scalesWithLevel: boolean };
  attack?: 'spell' | 'weapon';
  save?: AbilityName;
}

export interface SupplementalSpell {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: { verbal: boolean; somatic: boolean; material: boolean };
  duration: string;
  concentration?: boolean;
  ritual?: boolean;
  mechanics?: SpellMechanics;
}

const V = { verbal: true, somatic: false, material: false };
const S = { verbal: false, somatic: true, material: false };
const VS = { verbal: true, somatic: true, material: false };
const SM = { verbal: false, somatic: true, material: true };
const VSM = { verbal: true, somatic: true, material: true };

export const SUPPLEMENTAL_SPELLS: readonly SupplementalSpell[] = [
  // Cantrips
  {
    name: 'Booming Blade',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: SM,
    duration: '1 round',
    mechanics: {
      attack: 'weapon',
      damage: { dice: '1d8', type: 'thunder', scalesWithLevel: true },
    },
  },
  {
    name: 'Create Bonfire',
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: VS,
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    mechanics: {
      save: 'DEX',
      damage: { dice: '1d8', type: 'fire', scalesWithLevel: true },
    },
  },
  {
    name: 'Frostbite',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: VS,
    duration: 'Instantaneous',
    mechanics: {
      save: 'CON',
      damage: { dice: '1d6', type: 'cold', scalesWithLevel: true },
    },
  },
  {
    name: 'Green-Flame Blade',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: SM,
    duration: 'Instantaneous',
    mechanics: { attack: 'weapon' },
  },
  {
    name: 'Lightning Lure',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot radius)',
    components: V,
    duration: 'Instantaneous',
    mechanics: {
      save: 'STR',
      damage: { dice: '1d8', type: 'lightning', scalesWithLevel: true },
    },
  },
  {
    name: 'Magic Stone',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 bonus action',
    range: 'Touch',
    components: VS,
    duration: '1 minute',
    mechanics: {
      attack: 'spell',
      damage: { dice: '1d6', type: 'bludgeoning', scalesWithLevel: false },
    },
  },
  {
    name: 'Sword Burst',
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: V,
    duration: 'Instantaneous',
    mechanics: {
      save: 'DEX',
      damage: { dice: '1d6', type: 'force', scalesWithLevel: true },
    },
  },
  {
    name: 'Thorn Whip',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: VSM,
    duration: 'Instantaneous',
    mechanics: {
      attack: 'spell',
      damage: { dice: '1d6', type: 'piercing', scalesWithLevel: true },
    },
  },
  {
    name: 'Thunderclap',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: S,
    duration: 'Instantaneous',
    mechanics: {
      save: 'CON',
      damage: { dice: '1d6', type: 'thunder', scalesWithLevel: true },
    },
  },
  // 1st level
  {
    name: 'Absorb Elements',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction',
    range: 'Self',
    components: S,
    duration: '1 round',
  },
  {
    name: 'Catapult',
    level: 1,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '60 feet',
    components: S,
    duration: 'Instantaneous',
    mechanics: { save: 'DEX' },
  },
  {
    name: 'Snare',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 minute',
    range: 'Touch',
    components: SM,
    duration: '8 hours',
  },
  {
    name: "Tasha's Caustic Brew",
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (30-foot line)',
    components: VSM,
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    mechanics: { save: 'DEX' },
  },
  // 2nd level
  {
    name: 'Air Bubble',
    level: 2,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: S,
    duration: '24 hours',
  },
  {
    name: 'Kinetic Jaunt',
    level: 2,
    school: 'Transmutation',
    castingTime: '1 bonus action',
    range: 'Self',
    components: S,
    duration: 'Concentration, up to 1 minute',
    concentration: true,
  },
  {
    name: 'Pyrotechnics',
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '60 feet',
    components: VS,
    duration: 'Instantaneous',
    mechanics: { save: 'CON' },
  },
  {
    name: 'Skywrite',
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Sight',
    components: VS,
    duration: 'Concentration, up to 1 day',
    concentration: true,
    ritual: true,
  },
  {
    name: 'Vortex Warp',
    level: 2,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '90 feet',
    components: VS,
    duration: 'Instantaneous',
    mechanics: { save: 'CON' },
  },
  // 3rd level
  {
    name: "Ashardalon's Stride",
    level: 3,
    school: 'Transmutation',
    castingTime: '1 bonus action',
    range: 'Self',
    components: VS,
    duration: 'Concentration, up to 1 minute',
    concentration: true,
  },
  {
    name: 'Catnap',
    level: 3,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: SM,
    duration: '10 minutes',
  },
  {
    name: 'Elemental Weapon',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: VS,
    duration: 'Concentration, up to 1 hour',
    concentration: true,
  },
  {
    name: 'Flame Arrows',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: VS,
    duration: 'Concentration, up to 1 hour',
    concentration: true,
  },
  {
    name: 'Intellect Fortress',
    level: 3,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '30 feet',
    components: V,
    duration: 'Concentration, up to 1 hour',
    concentration: true,
  },
  {
    name: 'Tiny Servant',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 minute',
    range: 'Touch',
    components: VS,
    duration: '8 hours',
  },
  // 4th level
  {
    name: 'Elemental Bane',
    level: 4,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '90 feet',
    components: VS,
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    mechanics: { save: 'CON' },
  },
  {
    name: 'Summon Construct',
    level: 4,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '90 feet',
    components: VSM,
    duration: 'Concentration, up to 1 hour',
    concentration: true,
  },
  // 5th level
  {
    name: 'Create Spelljamming Helm',
    level: 5,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: VSM,
    duration: 'Instantaneous',
  },
  {
    name: 'Skill Empowerment',
    level: 5,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: VS,
    duration: 'Concentration, up to 1 hour',
    concentration: true,
  },
  {
    name: 'Transmute Rock',
    level: 5,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '120 feet',
    components: VSM,
    duration: 'Instantaneous',
  },
];

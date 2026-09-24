import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseRulesEntityData } from '@nexus/rules-contracts';
import {
  convertItem2024,
  convertMonster2014,
  convertSpell2014,
  convertSpell2024,
  parseDamageDefenses,
  slugify,
} from '../srd-converters';
import { assertIsolatedDatabase } from '../../../scripts/rules-srd-compare';

const DATA_DIR = path.resolve(__dirname, '../../../../../../../../packages/character-creator/src/data');
const load = (file: string) => JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8')) as Array<Record<string, any>>;

describe('SRD converters', () => {
  it('converts a 2014 spell with a costly consumed material', () => {
    const raw = load('srd/2014/5e-SRD-Spells.json').find((s) => s.index === 'revivify');
    const converted = convertSpell2014(raw!);
    expect(converted.slug).toBe('revivify');
    expect(converted.data).toMatchObject({
      level: 3,
      school: 'conjuration',
      range: { kind: 'touch' },
      components: { material: true, materialCostGp: 300, materialConsumed: true },
    });
    expect(parseRulesEntityData('spell', '2014', converted.data).success).toBe(true);
  });

  it('converts 2024 bonus-action triggers and copper-piece costs', () => {
    const spells = load('srd/2024/5e-SRD-spells.json');
    const smite = convertSpell2024(spells.find((s) => s.name === 'Divine Smite')!);
    expect(smite.slug).toBe('divine-smite');
    expect(smite.data.castingTime).toMatchObject({ unit: 'bonus_action', trigger: expect.stringContaining('after hitting') });
    const repose = convertSpell2024(spells.find((s) => s.name === 'Gentle Repose')!);
    expect(repose.data.components).toMatchObject({ materialCostGp: 0.02, materialConsumed: true });
    expect(parseRulesEntityData('spell', '2024', smite.data).success).toBe(true);
  });

  it('converts the lich with spell references, legendary actions and defenses', () => {
    const raw = load('srd/2014/5e-SRD-Monsters.json').find((m) => m.index === 'lich');
    const converted = convertMonster2014(raw!);
    const parsed = parseRulesEntityData('monster', '2014', converted.data);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
    expect(parsed.data).toMatchObject({
      size: 'medium',
      challengeRating: 21,
      savingThrows: { con: 10, int: 12, wis: 9 },
      senses: { truesight: 120, passivePerception: 19 },
    });
    expect(parsed.data.spellcasting?.[0].spells).toContainEqual({ ref: 'fireball', frequency: 'level 3' });
    expect(parsed.data.legendaryActions?.actions.find((a) => a.name.startsWith('Disrupt Life'))?.cost).toBe(3);
    expect(parsed.data.traits.some((t) => t.name === 'Spellcasting')).toBe(false);
  });

  it('converts swarms and recharge abilities', () => {
    const monsters = load('srd/2014/5e-SRD-Monsters.json');
    const swarm = convertMonster2014(monsters.find((m) => m.index === 'swarm-of-rats')!);
    expect(swarm.data).toMatchObject({ type: 'beast', swarmOf: 'tiny' });
    const dragon = convertMonster2014(monsters.find((m) => m.index === 'adult-red-dragon')!);
    const breath = (dragon.data.actions as Array<Record<string, unknown>>).find((a) => a.name === 'Fire Breath');
    expect(breath?.usage).toEqual({ type: 'recharge', rechargeOn: 5 });
  });

  it('converts 2024 weapons and armor', () => {
    const equipment = load('equipment.json');
    const longsword = convertItem2024(equipment.find((e) => e.index === 'longsword')!);
    expect(longsword.data).toMatchObject({
      category: 'weapon',
      weapon: { category: 'martial', kind: 'melee', mastery: 'sap', versatileDamage: { dice: '1d10', type: 'slashing' } },
    });
    const shield = convertItem2024(equipment.find((e) => e.index === 'shield')!);
    expect(shield.data).toMatchObject({ category: 'shield', armor: { category: 'shield', baseAc: 2 } });
    for (const item of [longsword, shield]) {
      expect(parseRulesEntityData('item', '2024', item.data).success).toBe(true);
    }
  });

  it('parses damage defenses with qualifiers', () => {
    const warnings: string[] = [];
    expect(parseDamageDefenses(['fire', 'bludgeoning, piercing, and slashing from nonmagical weapons'], warnings)).toEqual([
      { type: 'fire' },
      { type: 'bludgeoning', qualifier: 'from nonmagical weapons' },
      { type: 'piercing', qualifier: 'from nonmagical weapons' },
      { type: 'slashing', qualifier: 'from nonmagical weapons' },
    ]);
    expect(parseDamageDefenses(['damage from spells'], warnings)).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('slugifies names stably', () => {
    expect(slugify("Tasha's Hideous Laughter")).toBe('tashas-hideous-laughter');
    expect(slugify('  Arcane Lock ')).toBe('arcane-lock');
  });
});

describe('assertIsolatedDatabase', () => {
  it('allows only databases named for tests or isolation', () => {
    expect(assertIsolatedDatabase('postgresql://u:p@localhost:5432/rules_srd_isolated')).toBe('rules_srd_isolated');
    expect(assertIsolatedDatabase('postgresql://u:p@localhost:5432/codex_test?schema=x')).toBe('codex_test');
    expect(() => assertIsolatedDatabase('postgresql://u:p@db:5432/nexus_codex')).toThrow(/refusing/);
    expect(() => assertIsolatedDatabase('not a url')).toThrow(/valid URL/);
  });
});

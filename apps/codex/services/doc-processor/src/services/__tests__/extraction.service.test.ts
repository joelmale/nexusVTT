import { extractionService } from '../extraction.service';

describe('ExtractionService', () => {
  describe('extractSpells', () => {
    it('should extract a valid spell from text', () => {
      const text = `
Fireball
3rd-level evocation
Casting Time: 1 action
Range: 150 feet
Components: V, S, M (a tiny ball of bat guano and sulfur)
Duration: Instantaneous
Description: A bright streak flashes from your pointing finger to a point you choose.
      `;

      const spells = extractionService.extractSpells(text);

      expect(spells).toHaveLength(1);
      expect(spells[0].entity.name).toBe('Fireball');
      expect(spells[0].entity.level).toBe('3rd-level');
      expect(spells[0].entity.school).toBe('evocation');
    });

    it('should extract multiple spells from text', () => {
      const text = `
Magic Missile
1st-level evocation
Casting Time: 1 action

Shield
1st-level abjuration
Casting Time: 1 reaction
      `;

      const spells = extractionService.extractSpells(text);

      expect(spells).toHaveLength(2);
      expect(spells[0].entity.name).toBe('Magic Missile');
      expect(spells[1].entity.name).toBe('Shield');
    });

    it('should extract cantrips', () => {
      const text = `
Prestidigitation
Cantrip (transmutation)
Casting Time: 1 action
      `;

      const spells = extractionService.extractSpells(text);

      expect(spells).toHaveLength(1);
      expect(spells[0].entity.name).toBe('Prestidigitation');
      expect(spells[0].entity.level).toContain('Cantrip');
    });

    it('should return empty array when no spells found', () => {
      const text = 'This is just regular text with no spells.';
      const spells = extractionService.extractSpells(text);
      expect(spells).toHaveLength(0);
    });
  });

  describe('extractMonsters', () => {
    it('should extract a valid monster from text', () => {
      const text = `
Goblin
Small humanoid (goblinoid), neutral evil
Armor Class: 15 (leather armor, shield)
Hit Points: 7 (2d6)
Speed: 30 ft.
STR 8 (-1) DEX 14 (+2) CON 10 (+0)
Challenge: 1/4 (50 XP)
      `;

      const monsters = extractionService.extractMonsters(text);

      expect(monsters).toHaveLength(1);
      expect(monsters[0].entity.name).toBe('Goblin');
      expect(monsters[0].entity.size).toBe('Small');
      expect(monsters[0].entity.type).toBe('humanoid (goblinoid)');
    });

    it('should extract armor class and hit points', () => {
      const text = `
Dragon
Large dragon, chaotic evil
Armor Class: 18 (natural armor)
Hit Points: 200 (16d12 + 96)
Speed: 40 ft., fly 80 ft.
Challenge: 13 (10,000 XP)
      `;

      const monsters = extractionService.extractMonsters(text);

      expect(monsters).toHaveLength(1);
      expect(monsters[0].entity.name).toBe('Dragon');
      expect(monsters[0].entity.ac).toContain('18');
      expect(monsters[0].entity.hp).toContain('200');
    });

    it('should return empty array when no monsters found', () => {
      const text = 'This is just regular text with no monsters.';
      const monsters = extractionService.extractMonsters(text);
      expect(monsters).toHaveLength(0);
    });
  });

  describe('extractItems', () => {
    it('should extract a valid magic item from text', () => {
      const text = `
Sword of Sharpness
Weapon (any sword), very rare (requires attunement)
When you attack an object with this magic sword and hit, maximize your weapon damage dice against the target.
      `;

      const items = extractionService.extractItems(text);

      expect(items).toHaveLength(1);
      expect(items[0].entity.name).toBe('Sword of Sharpness');
      expect(items[0].entity.type).toContain('Weapon');
      expect(items[0].entity.rarity).toContain('very rare');
    });

    it('should detect attunement requirement', () => {
      const text = `
Ring of Protection
Ring, rare (requires attunement)
You gain a +1 bonus to AC and saving throws while wearing this ring.
      `;

      const items = extractionService.extractItems(text);

      expect(items).toHaveLength(1);
      expect(items[0].entity.attunement).toBe(true);
    });

    it('should handle items without attunement', () => {
      const text = `
Potion of Healing
Potion, common
You regain 2d4 + 2 hit points when you drink this potion.
      `;

      const items = extractionService.extractItems(text);

      expect(items).toHaveLength(1);
      expect(items[0].entity.attunement).toBe(false);
    });

    it('should return empty array when no items found', () => {
      const text = 'This is just regular text with no items.';
      const items = extractionService.extractItems(text);
      expect(items).toHaveLength(0);
    });
  });

  describe('extractAll', () => {
    it('should extract all types from mixed content', () => {
      const text = `
Fireball
3rd-level evocation
Casting Time: 1 action

Goblin
Small humanoid (goblinoid), neutral evil
Armor Class: 15
Hit Points: 7 (2d6)
Challenge: 1/4 (50 XP)

Sword of Sharpness
Weapon (any sword), very rare (requires attunement)
      `;

      const result = extractionService.extractAll(text);

      expect(result.spells).toHaveLength(1);
      expect(result.monsters).toHaveLength(1);
      expect(result.items).toHaveLength(1);
    });

    it('should return empty arrays when no content found', () => {
      const text = 'This is just regular text.';
      const result = extractionService.extractAll(text);

      expect(result.spells).toHaveLength(0);
      expect(result.monsters).toHaveLength(0);
      expect(result.items).toHaveLength(0);
    });
  });
});

import { MonsterParser } from '../monster-parser';

describe('MonsterParser', () => {
  test('returns confidence and raw snippet', () => {
    const parser = new MonsterParser();
    const text = `
Goblin
Small humanoid (goblinoid), neutral evil
Armor Class: 15 (leather armor, shield)
Hit Points: 7 (2d6)
Speed: 30 ft.
Challenge: 1/4 (50 XP)
    `;

    const results = parser.parse(text);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].rawSnippet.length).toBeGreaterThan(10);
  });
});

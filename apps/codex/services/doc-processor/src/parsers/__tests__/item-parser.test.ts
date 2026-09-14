import { ItemParser } from '../item-parser';

describe('ItemParser', () => {
  test('returns confidence and raw snippet', () => {
    const parser = new ItemParser();
    const text = `
Potion of Healing
Potion, common
You regain 2d4 + 2 hit points when you drink this potion.
    `;

    const results = parser.parse(text);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].rawSnippet.length).toBeGreaterThan(10);
  });
});

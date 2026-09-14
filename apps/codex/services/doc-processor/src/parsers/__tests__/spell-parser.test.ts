import { SpellParser } from '../spell-parser';

describe('SpellParser', () => {
  test('returns confidence and raw snippet', () => {
    const parser = new SpellParser();
    const text = `
Fireball
3rd-level evocation
Casting Time: 1 action
Range: 150 feet
Components: V, S, M
Duration: Instantaneous
Description: A bright streak flashes from your pointing finger.
    `;

    const results = parser.parse(text);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].rawSnippet.length).toBeGreaterThan(10);
  });
});

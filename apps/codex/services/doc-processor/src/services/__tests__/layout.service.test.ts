import { detectColumns, groupLines } from '../layout.service';

describe('layout.service', () => {
  test('detectColumns returns 2 for balanced left/right items', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      str: `L${index}`,
      transform: [1, 0, 0, 1, 100, 700 - index],
    })).concat(
      Array.from({ length: 30 }, (_, index) => ({
        str: `R${index}`,
        transform: [1, 0, 0, 1, 500, 700 - index],
      }))
    );

    expect(detectColumns(items, 800)).toBe(2);
  });

  test('detectColumns returns 1 for mostly single-column items', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      str: `A${index}`,
      transform: [1, 0, 0, 1, 120, 700 - index],
    }));

    expect(detectColumns(items, 800)).toBe(1);
  });

  test('groupLines merges text on the same line', () => {
    const items = [
      { str: 'Fireball', transform: [1, 0, 0, 1, 100, 700] },
      { str: '3rd-level', transform: [1, 0, 0, 1, 200, 700] },
      { str: 'Evocation', transform: [1, 0, 0, 1, 100, 690] },
    ];

    const lines = groupLines(items);
    expect(lines.length).toBe(2);
    expect(lines[0].text).toContain('Fireball');
  });
});

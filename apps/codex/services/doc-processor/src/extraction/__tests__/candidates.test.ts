import { classifySection, detectCandidates } from '../candidates';
import { SRD_PAGES } from './fixtures/pages';

describe('detectCandidates', () => {
  const candidates = detectCandidates(SRD_PAGES);

  test('finds one monster, one spell and one item in reading order', () => {
    expect(candidates.map((c) => [c.type, c.title])).toEqual([
      ['monster', 'Gorgon'],
      ['spell', 'Fireball'],
      ['item', 'Bag of Holding'],
    ]);
  });

  test('merges a stat block that continues on the next page, skipping header, footer and art', () => {
    const gorgon = candidates[0];
    expect(gorgon.key).toBe('monster:p12:p12-b4');
    expect(gorgon.regions.map((r) => [r.pageNumber, r.blockIds])).toEqual([
      [12, ['p12-b4', 'p12-b5']],
      [13, ['p13-b1', 'p13-b2']],
    ]);
    expect(gorgon.markdown).toContain('Petrifying Breath');
    expect(gorgon.markdown).not.toMatch(/PageFooter|Monsters/);
  });

  test('trims lore that follows the stat block', () => {
    expect(candidates[0].markdown).not.toContain('travellers mistake for monuments');
    expect(candidates[0].blockIds).not.toContain('p13-b3');
  });

  test('region bbox is the union of the blocks on that page', () => {
    expect(candidates[0].regions[0].bbox).toEqual([0.52, 0.06, 0.94, 0.5]);
    expect(candidates[0].regions[1].bbox).toEqual([0.06, 0.05, 0.45, 0.4]);
  });

  test('blockHash is stable and changes with the text', () => {
    const again = detectCandidates(SRD_PAGES);
    expect(again.map((c) => c.blockHash)).toEqual(candidates.map((c) => c.blockHash));
    const edited = structuredClone(SRD_PAGES);
    edited[1].blocks[5].markdown = edited[1].blocks[5].markdown!.replace('150 feet', '120 feet');
    expect(detectCandidates(edited)[1].blockHash).not.toBe(candidates[1].blockHash);
  });

  test('two stat blocks under separate headings are separate candidates', () => {
    const block = (id: string, markdown: string, heading = false) => ({
      id,
      class: heading ? ('heading' as const) : ('body' as const),
      markerType: heading ? 'SectionHeader' : 'Text',
      bbox: [0, 0, 1, 1] as [number, number, number, number],
      markdown,
    });
    const stat = 'Armor Class 12\n\nHit Points 11 (2d8 + 2)\n\nChallenge 1/4 (50 XP)';
    const found = detectCandidates([
      {
        pageNumber: 1,
        markdown: '',
        blocks: [block('a', '## Wolf', true), block('b', stat), block('c', '## Jackal', true), block('d', stat)],
      },
    ]);
    expect(found.map((c) => c.title)).toEqual(['Wolf', 'Jackal']);
  });

  test('a Markdown-upload page (one block holding several headings) is split into sections', () => {
    const page = {
      pageNumber: 1,
      markdown: '',
      blocks: [
        {
          id: 'p1-b0',
          class: 'body' as const,
          markerType: 'MarkdownSection',
          bbox: [0, 0, 1, 1] as [number, number, number, number],
          markdown: '# Shield\n1st-level abjuration\nCasting Time: 1 reaction\nRange: Self\nComponents: V, S\nDuration: 1 round\n\n# Ring of Warmth\nRing, uncommon (requires attunement)',
        },
      ],
    };
    const found = detectCandidates([page]);
    expect(found.map((c) => [c.type, c.key])).toEqual([
      ['spell', 'spell:p1:p1-b0#0'],
      ['item', 'item:p1:p1-b0#1'],
    ]);
  });
});

describe('item sections holding two entries', () => {
  // Synthetic text: no rulebook content in the repo. Shaped like a page where an item
  // and a second item share a section because the second title is not a layout heading.
  const block = (id: string, markdown: string, bbox: [number, number, number, number], heading = false) => ({
    id,
    class: heading ? ('heading' as const) : ('body' as const),
    markerType: heading ? 'SectionHeader' : 'Text',
    bbox,
    markdown,
  });

  const lamp = [
    '*Wondrous item, legendary (requires attunement)*',
    'This brass lamp burns without oil. While you hold it, you shed bright light in a 30-foot radius.',
  ].join('\n');
  const cube = [
    '**Ember Cube**',
    '*Wondrous item, rare*',
    'This warm cube of glass can be set down to heat a small room.',
  ].join('\n');

  test('splits an item and a second item that shares its block', () => {
    const found = detectCandidates([
      {
        pageNumber: 317,
        markdown: '',
        blocks: [block('a', '#### Lantern of Dawn', [0.1, 0.1, 0.5, 0.15], true), block('b', `${lamp}

${cube}`, [0.1, 0.16, 0.5, 0.6])],
      },
    ]);
    expect(found.map((c) => [c.type, c.title])).toEqual([
      ['item', 'Lantern of Dawn'],
      ['item', 'Ember Cube'],
    ]);
    expect(found[0].markdown).toContain('burns without oil');
    expect(found[0].markdown).not.toContain('Ember Cube');
    expect(found[1].markdown).toContain('*Wondrous item, rare*');
    expect(found[1].markdown).not.toContain('Lantern');
    expect(found[1].key).toBe('item:p317:b~1');
    expect(new Set(found.map((c) => c.key)).size).toBe(2);
  });

  test('splits when the second item is its own non-heading block (a sidebar)', () => {
    const found = detectCandidates([
      {
        pageNumber: 1,
        markdown: '',
        blocks: [
          block('a', '#### Lantern of Dawn', [0, 0, 1, 0.1], true),
          block('b', lamp, [0, 0.1, 0.5, 0.4]),
          block('c', cube, [0.5, 0.1, 1, 0.4]),
        ],
      },
    ]);
    expect(found.map((c) => c.title)).toEqual(['Lantern of Dawn', 'Ember Cube']);
    expect(found[1].blockIds).toEqual(['c']);
    expect(found[1].regions[0].bbox).toEqual([0.5, 0.1, 1, 0.4]);
  });

  test('a single item is left alone, and prose mentioning rarity is not a type line', () => {
    const prose = 'You find a ring that is rare in these parts, and a weapon of legendary make, and nothing else of note here.';
    const found = detectCandidates([
      { pageNumber: 1, markdown: '', blocks: [block('a', '#### Lantern of Dawn', [0, 0, 1, 0.1], true), block('b', `${lamp}

${prose}`, [0, 0.1, 1, 0.5])] },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe('item:p1:a');
  });

  test('does not take the last sentence of the first item for the second items title', () => {
    const tail = 'It sheds light for one hour.';
    const found = detectCandidates([
      { pageNumber: 1, markdown: '', blocks: [block('a', '#### Lantern of Dawn', [0, 0, 1, 0.1], true), block('b', `${lamp}
${tail}
*Wondrous item, rare*
A second thing.`, [0, 0.1, 1, 0.5])] },
    ]);
    expect(found).toHaveLength(2);
    expect(found[0].markdown).toContain(tail);
    expect(found[1].markdown.startsWith('*Wondrous item, rare*')).toBe(true);
  });
});

describe('classifySection', () => {
  test('requires every spell field plus a level line', () => {
    expect(classifySection('Casting Time: 1 action\nRange: 60 feet\nComponents: V\nDuration: 1 minute')).toBeNull();
    expect(classifySection('Evocation cantrip\nCasting Time: 1 action\nRange: 60 feet\nComponents: V\nDuration: Instantaneous')).toBe('spell');
  });

  test('prose that mentions armor class is not a monster', () => {
    expect(classifySection('Your Armor Class improves while wearing a shield.')).toBeNull();
  });
});

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

describe('classifySection', () => {
  test('requires every spell field plus a level line', () => {
    expect(classifySection('Casting Time: 1 action\nRange: 60 feet\nComponents: V\nDuration: 1 minute')).toBeNull();
    expect(classifySection('Evocation cantrip\nCasting Time: 1 action\nRange: 60 feet\nComponents: V\nDuration: Instantaneous')).toBe('spell');
  });

  test('prose that mentions armor class is not a monster', () => {
    expect(classifySection('Your Armor Class improves while wearing a shield.')).toBeNull();
  });
});

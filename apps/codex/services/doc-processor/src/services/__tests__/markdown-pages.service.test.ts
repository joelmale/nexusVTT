import { splitMarkdownPages } from '../markdown-pages.service';

describe('splitMarkdownPages', () => {
  test('starts a page at each heading, keeping preamble on page 1', () => {
    const pages = splitMarkdownPages('Intro text\n\n# Fireball\nA bright streak\n\n## Shield\nAn invisible barrier\n');
    expect(pages.map((p) => [p.pageNumber, p.markdown.split('\n')[0]])).toEqual([
      [1, 'Intro text'],
      [2, '# Fireball'],
      [3, '## Shield'],
    ]);
    expect(pages[0].blocks[0]).toMatchObject({ id: 'p1-b0', class: 'body', bbox: [0, 0, 1, 1] });
  });

  test('does not split on # inside fenced code', () => {
    const pages = splitMarkdownPages('# Title\n```\n# not a heading\n```\ntext');
    expect(pages).toHaveLength(1);
  });

  test('a document that starts with a heading has no empty first page', () => {
    expect(splitMarkdownPages('# One\na\n# Two\nb').map((p) => p.pageNumber)).toEqual([1, 2]);
    expect(splitMarkdownPages('')).toEqual([]);
  });
});

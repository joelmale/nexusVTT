import { buildOrTsQuery, splitHeadline, tokenizeQuery } from '../query';

describe('search query helpers', () => {
  it('lowercases, de-duplicates and strips punctuation', () => {
    expect(tokenizeQuery("Fireball, FIREBALL & (Dragon's) breath!")).toEqual(['fireball', 'dragon', 's', 'breath']);
  });

  it('keeps accented letters and digits', () => {
    expect(tokenizeQuery('Café 5e')).toEqual(['café', '5e']);
  });

  it('caps the number of terms', () => {
    const query = Array.from({ length: 60 }, (_, i) => `term${i}`).join(' ');
    expect(tokenizeQuery(query)).toHaveLength(24);
  });

  it('joins terms with OR for to_tsquery', () => {
    expect(buildOrTsQuery('red dragon')).toBe('red | dragon');
  });

  it('cannot smuggle tsquery operators through', () => {
    expect(buildOrTsQuery("a' | b & !c <-> d:*")).toBe('a | b | c | d');
    expect(buildOrTsQuery('   !!! ')).toBe('');
  });

  it('splits ts_headline output into highlighted fragments only', () => {
    const headline = 'a <em>fire</em>ball ||| nothing here ||| more <em>fire</em>';
    expect(splitHeadline(headline)).toEqual(['a <em>fire</em>ball', 'more <em>fire</em>']);
    expect(splitHeadline('')).toEqual([]);
    expect(splitHeadline(null)).toEqual([]);
    expect(splitHeadline('no highlight')).toEqual([]);
  });
});

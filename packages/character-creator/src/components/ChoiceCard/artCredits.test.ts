import { describe, expect, it } from 'vitest';
import { ART_CREDITS } from './artCredits';

describe('art credits', () => {
  it('names an author, licence and source for every credited work', () => {
    for (const credit of ART_CREDITS) {
      expect(credit.author, credit.usedFor).toBeTruthy();
      expect(credit.licence, credit.usedFor).toBeTruthy();
      expect(credit.source, credit.usedFor).toMatch(/^https?:\/\//);
    }
  });
});

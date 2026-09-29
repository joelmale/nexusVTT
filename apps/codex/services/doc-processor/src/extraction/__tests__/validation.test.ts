import { readFileSync } from 'fs';
import { join } from 'path';
import { detectCandidates } from '../candidates';
import { Item, Monster, Spell } from '../schemas';
import { baselineAgreement, reviewEntity, sourceNumbers } from '../validation';
import { SRD_PAGES } from './fixtures/pages';

const fixture = <T>(name: string): T =>
  JSON.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', 'ollama', name), 'utf8')).message.content).entities[0];

const [gorgonCandidate, fireballCandidate, bagCandidate] = detectCandidates(SRD_PAGES);
const gorgon = fixture<Monster>('monster-gorgon.json');
const fireball = fixture<Spell>('spell-fireball.json');
const bag = fixture<Item>('item-bag-of-holding.json');

describe('reviewEntity', () => {
  test('a faithful extraction is auto-approved', () => {
    for (const [type, entity, source] of [
      ['monster', gorgon, gorgonCandidate.markdown],
      ['spell', fireball, fireballCandidate.markdown],
      ['item', bag, bagCandidate.markdown],
    ] as const) {
      const review = reviewEntity(type, entity, source);
      expect({ type, reasons: review.reasons, status: review.status }).toEqual({ type, reasons: [], status: 'auto' });
    }
  });

  test('numbers missing from the source are flagged as ungrounded', () => {
    const invented = fixture<Monster>('monster-gorgon-invented.json');
    const review = reviewEntity('monster', invented, gorgonCandidate.markdown);
    expect(review.status).toBe('needs_review');
    expect(review.reasons).toEqual(
      expect.arrayContaining(['ungrounded:hitPoints=126', 'ungrounded:abilities.str=21', 'hit_dice_average:114!=126'])
    );
    expect(review.confidence).toBeLessThan(0.6);
  });

  test('printed modifiers that disagree with printed scores are flagged (OCR misread)', () => {
    const source = gorgonCandidate.markdown.replace('20 (+5)', '28 (+5)');
    expect(reviewEntity('monster', { ...gorgon, abilities: { ...gorgon.abilities, str: 28 } }, source).reasons)
      .toContain('ability_modifier_mismatch');
  });

  test('XP that does not match the challenge rating is flagged', () => {
    expect(reviewEntity('monster', { ...gorgon, challengeRating: '5 (2,300 XP)' }, gorgonCandidate.markdown).reasons)
      .toContain('xp_cr_mismatch');
    expect(reviewEntity('monster', { ...gorgon, challengeRating: 'five' }, gorgonCandidate.markdown).reasons)
      .toContain('unknown_cr:five');
  });

  test('spell and item consistency checks', () => {
    const spell = reviewEntity('spell', { ...fireball, school: 'pyromancy', components: 'V, S, X' }, fireballCandidate.markdown);
    expect(spell.reasons).toEqual(expect.arrayContaining(['unknown_school:pyromancy', 'invalid_components:V, S, X']));
    const item = reviewEntity('item', { ...bag, rarity: 'mythic', type: 'Gadget' }, bagCandidate.markdown);
    expect(item.reasons).toEqual(expect.arrayContaining(['unknown_rarity:mythic', 'unknown_item_type:Gadget']));
  });

  test('cantrips need no printed level number', () => {
    const cantrip = { ...fireball, level: 0 };
    expect(reviewEntity('spell', cantrip, 'Evocation cantrip ...').reasons.filter((r) => r.startsWith('ungrounded:level'))).toEqual([]);
  });
});

describe('baselineAgreement', () => {
  test('agrees when the regex parser reads the same values', () => {
    const text = 'Fireball\n3rd-level evocation\nCasting Time: 1 action\nRange: 150 feet\nComponents: V, S, M\nDuration: Instantaneous';
    expect(baselineAgreement('spell', fireball, text).result).toBe('agrees');
  });

  test('a field-level disagreement becomes a review reason', () => {
    const text = 'Fireball\n3rd-level evocation\nCasting Time: 1 action\nRange: 150 feet\nComponents: V, S, M\nDuration: Instantaneous';
    const result = baselineAgreement('spell', { ...fireball, level: 4 }, text);
    expect(result).toEqual({ result: 'disagrees', reasons: ['baseline_disagrees:level=3'] });
  });
});

test('sourceNumbers reads thousands separators and dice', () => {
  expect([...sourceNumbers('Challenge 5 (1,800 XP), 114 (12d10 + 48)')]).toEqual([5, 1800, 114, 12, 10, 48]);
});

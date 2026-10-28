import { describe, expect, it } from 'vitest';
import { loadSpells } from '../services/dataService';

// SRD 5.1 pp105-109 (Spell Lists). An audit of every class list against the
// SRD found these three omissions in the bundled 2014 data; the rest of the
// audited lists already matched. Entries beyond the SRD list (for example Arcane
// Eye on Cleric) come from other books and are left in place.
describe('SRD 5.1 class spell list memberships', () => {
  const classesOf = (slug: string) =>
    loadSpells('2014').find((spell) => spell.slug === slug)?.classes ?? [];

  it.each([
    ['faerie-fire', 'bard'],
    ['divination', 'cleric'],
    ['meld-into-stone', 'druid'],
  ])('%s is on the %s list', (slug, className) => {
    expect(classesOf(slug)).toContain(className);
  });

  it('keeps the memberships it already had', () => {
    expect(classesOf('faerie-fire')).toContain('druid');
    expect(classesOf('divination')).toContain('druid');
  });
});

import { describe, expect, it } from 'vitest';
import type { Equipment } from '../types/dnd';
import { equipmentNameKey, mergeEquipmentCatalog } from './equipmentCatalog';
import { loadEquipmentCatalog } from './equipmentService';

const item = (name: string, year: number, slug = name): Equipment =>
  ({
    index: slug,
    slug,
    name,
    year,
    equipment_category: 'Adventuring Gear',
    cost: { quantity: 1, unit: 'gp' },
    weight: 1,
  }) as Equipment;

describe('mergeEquipmentCatalog', () => {
  it('ignores case, punctuation, qualifiers and word order in names', () => {
    expect(equipmentNameKey("Clothes, Traveler's")).toBe(
      equipmentNameKey("traveler’s clothes"),
    );
    expect(equipmentNameKey('Acid (vial)')).toBe(equipmentNameKey('ACID'));
  });

  it('prefers the 2024 entry when both editions have the item', () => {
    const merged = mergeEquipmentCatalog(
      [item('Club', 2014, 'club-old')],
      [item('club', 2024, 'club')],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ slug: 'club', year: 2024 });
  });

  it('dedupes reordered names and keeps 2014-only items tagged 2014', () => {
    const merged = mergeEquipmentCatalog(
      [item("Traveler's Clothes", 2014), item('Signet Ring', 2014)],
      [item("Clothes, Traveler's", 2024)],
    );
    expect(merged.map((m) => [m.name, m.year])).toEqual([
      ["Clothes, Traveler's", 2024],
      ['Signet Ring', 2014],
    ]);
  });

  it('collapses duplicates inside one list, preferring one with a slug', () => {
    const noSlug = { ...item('Hooded Lantern', 2024), slug: '' };
    const merged = mergeEquipmentCatalog(
      [],
      [noSlug, item('Hooded Lantern', 2024, 'hooded-lantern')],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].slug).toBe('hooded-lantern');
  });
});

describe('loadEquipmentCatalog (real data)', () => {
  it('contains both editions with unique names', () => {
    const catalog = loadEquipmentCatalog();
    const keys = catalog.map((c) => equipmentNameKey(c.name));
    expect(new Set(keys).size).toBe(keys.length);
    expect(catalog.some((c) => c.year === 2014)).toBe(true);
    expect(catalog.some((c) => c.year === 2024)).toBe(true);
    // 2024 wins on shared items; 2014 survives only for 2014-only items.
    expect(catalog.find((c) => c.name === 'Club')?.year).toBe(2024);
    expect(catalog.find((c) => c.name === 'Signet ring')?.year).toBe(2014);
  });
});

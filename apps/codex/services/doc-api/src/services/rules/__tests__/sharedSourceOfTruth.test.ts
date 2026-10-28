import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RulesSeederService } from '../rules-seeder.service';

/**
 * The 2024 SRD equipment lives once, in the shared character creator package.
 * doc-api used to commit a byte-identical copy that could silently drift.
 */
describe('single source of truth for SRD equipment', () => {
  it('does not commit a second copy of the 2024 equipment', () => {
    expect(
      existsSync(path.resolve(__dirname, '../../../data/equipment-2024.json')),
    ).toBe(false);
  });

  it('still seeds every 2024 equipment item from the shared package', () => {
    const { items2024 } = new RulesSeederService(
      {} as never,
    ).buildBaselineItems();
    // 213 SRD 5.2 equipment entries plus the classic magic items.
    expect(items2024.length).toBeGreaterThan(213);
    expect(items2024.some((item) => item.slug === 'thieves-tools')).toBe(true);
  });
});

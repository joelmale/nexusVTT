import { describe, expect, it } from 'vitest';
import { STARTER_KITS_2024 } from '../data/recommendations/2024/starterKits';
import { getRecommendation } from './recommendationService';
import { loadClasses, BACKGROUNDS } from './dataService';

describe('authored 2024 starter kits', () => {
  it('covers every verified 2024 class once', () => {
    const classes = loadClasses('2024')
      .map((c) => c.slug)
      .filter((slug) => slug !== 'artificer')
      .sort();
    expect(STARTER_KITS_2024.map((k) => k.classSlug).sort()).toEqual(classes);
  });

  it.each(STARTER_KITS_2024)('$classSlug kit is legal', (kit) => {
    const background = BACKGROUNDS.find((b) => b.slug === kit.backgroundSlug) as
      | { abilityScores?: { from: string[] } }
      | undefined;
    expect(background, kit.backgroundSlug).toBeDefined();
    for (const ability of Object.keys(kit.bonuses))
      expect(background?.abilityScores?.from).toContain(ability);

    const result = getRecommendation({ edition: '2024', classSlug: kit.classSlug });
    expect(result.draft.backgroundSlug).toBe(kit.backgroundSlug);
    expect(result.evaluation.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.evaluation.isValid).toBe(true);
  });
});

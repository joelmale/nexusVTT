import { describe, expect, it } from 'vitest';
import {
  CERTIFIED_SUPPORT_MANIFEST,
} from '../data/supportManifest';
import { loadClasses } from '../services/dataService';
import { getRecommendation } from '../services/recommendationService';

describe('CC-304: Broader Support Certification Matrix', () => {
  it('manifest contains 12 certified classes', () => {
    expect(CERTIFIED_SUPPORT_MANIFEST).toHaveLength(12);
  });

  CERTIFIED_SUPPORT_MANIFEST.forEach((cert) => {
    describe(`Class: ${cert.name} (${cert.classSlug})`, () => {
      it('exists in both 2014 and 2024 class catalogs', () => {
        const classes2014 = loadClasses('2014');
        const classes2024 = loadClasses('2024');

        const found14 = classes2014.find((c) => c.slug === cert.classSlug || c.name.toLowerCase() === cert.name.toLowerCase());
        const found24 = classes2024.find((c) => c.slug === cert.classSlug || c.name.toLowerCase() === cert.name.toLowerCase());

        expect(found14, `Missing 2014 class for ${cert.name}`).toBeDefined();
        expect(found24, `Missing 2024 class for ${cert.name}`).toBeDefined();
      });

      if (cert.recommendationSupported) {
        it('generates a legal evaluated 2024 level 1 build', () => {
          const rec24 = getRecommendation({
            classSlug: cert.classSlug,
            edition: '2024',
            name: `Test-${cert.name}-2024`,
          });

          expect(rec24.draft.classSlug).toBe(cert.classSlug);
          expect(rec24.evaluation.isValid).toBe(true);
          expect(
            rec24.evaluation.issues.filter((i) => i.severity === 'error')
          ).toHaveLength(0);
        });

        it('generates a legal evaluated 2014 level 1 build', () => {
          const rec14 = getRecommendation({
            classSlug: cert.classSlug,
            edition: '2014',
            name: `Test-${cert.name}-2014`,
          });

          expect(rec14.draft.classSlug).toBe(cert.classSlug);
          expect(rec14.evaluation.isValid).toBe(true);
          expect(
            rec14.evaluation.issues.filter((i) => i.severity === 'error')
          ).toHaveLength(0);
        });
      }
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  CREATION_SECTIONS,
  sectionForStep,
  visibleSections,
} from './creationSections';

describe('creation sections', () => {
  it('places every one of the fourteen steps in exactly one section', () => {
    for (let step = 0; step <= 13; step++) {
      const owners = CREATION_SECTIONS.filter((s) => s.steps.includes(step));
      expect(owners, `step ${step}`).toHaveLength(1);
    }
    expect(CREATION_SECTIONS).toHaveLength(7);
  });

  it('drops sections with no visible steps', () => {
    const ids = visibleSections([0, 1, 2, 3, 4, 11, 12, 13]).map((s) => s.id);
    expect(ids).toEqual(['start', 'origin', 'class', 'abilities', 'gear', 'story']);
    expect(sectionForStep(8)?.id).toBe('magic');
  });
});

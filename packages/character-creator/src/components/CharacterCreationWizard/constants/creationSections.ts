/**
 * The seven sections the wizard is organised into.
 *
 * The fourteen step indices stay stable (saved drafts remember a step index),
 * so sections are a grouping layered over them, not a renumbering.
 */
export type CreationSectionId =
  | 'start'
  | 'origin'
  | 'class'
  | 'abilities'
  | 'magic'
  | 'gear'
  | 'story';

export interface CreationSection {
  id: CreationSectionId;
  label: string;
  steps: readonly number[];
}

export const CREATION_SECTIONS: readonly CreationSection[] = [
  { id: 'start', label: 'Start', steps: [0] },
  { id: 'origin', label: 'Origin', steps: [1, 2, 10] },
  { id: 'class', label: 'Class', steps: [3, 5, 7] },
  { id: 'abilities', label: 'Abilities', steps: [4, 6, 9] },
  { id: 'magic', label: 'Magic', steps: [8] },
  { id: 'gear', label: 'Gear', steps: [11, 12] },
  { id: 'story', label: 'Story', steps: [13] },
];

export function sectionForStep(step: number): CreationSection | undefined {
  return CREATION_SECTIONS.find((section) => section.steps.includes(step));
}

/** Sections with at least one visible step, in order, with their visible steps. */
export function visibleSections(visibleSteps: readonly number[]) {
  return CREATION_SECTIONS.map((section) => ({
    ...section,
    steps: section.steps.filter((step) => visibleSteps.includes(step)),
  })).filter((section) => section.steps.length > 0);
}

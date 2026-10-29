import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import { FEAT_DATABASE, loadClasses } from '../services/dataService';
import { isLegacyFeatForEdition } from '../utils/featUtils';
import { describeLevelResources } from '../components/CharacterCreationWizard/components/LevelResourceSummary';
import { StepCumulativeASI } from '../components/CharacterCreationWizard/steps/StepCumulativeASI';
import { Step5point5Feats } from '../components/CharacterCreationWizard/steps/Step5point5Feats';

const base = REFERENCE_BUILDS.W24.creationData as CharacterCreationData;
const stepProps = (data: CharacterCreationData) => ({
  data,
  updateData: vi.fn(),
  nextStep: vi.fn(),
  prevStep: vi.fn(),
  getNextStepLabel: () => 'Next',
  stepIndex: 0,
});

describe('2014 feats in a 2024 build', () => {
  const bySlug = (slug: string) => FEAT_DATABASE.find((f) => f.slug === slug)!;
  it('classifies legacy feats, not 2024 origin or SRD 2024 feats', () => {
    expect(isLegacyFeatForEdition(bySlug('actor'), '2024')).toBe(true);
    expect(isLegacyFeatForEdition(bySlug('alert'), '2024')).toBe(false);
    expect(isLegacyFeatForEdition(bySlug('grappler'), '2024')).toBe(false);
    expect(isLegacyFeatForEdition(bySlug('actor'), '2014')).toBe(false);
  });

  it('hides them in the Feats step until asked', () => {
    const data = { ...base, level: 8 } as CharacterCreationData;
    render(<Step5point5Feats {...stepProps(data)} />);
    expect(screen.queryByText('Actor')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Include 2014-rules feats/));
    expect(screen.getByText('Actor')).toBeTruthy();
  });
});

describe('SRD Warlock Pact Magic text', () => {
  it('no longer claims two 1st-level slots for every level', () => {
    const warlock = loadClasses('2024').find((c) => c.slug === 'warlock')!;
    const pact = warlock.level_1_features?.find((f) => f.id === 'pact_magic');
    expect(pact?.desc).not.toMatch(/two 1st-level/i);
  });
});

describe('level resources', () => {
  it('reports Pact Magic slots and invocation counts for a level 5 Warlock', () => {
    const r = describeLevelResources({
      ...base,
      classSlug: 'warlock',
      level: 5,
      eldritchInvocations: ['armor-of-shadows'],
    } as CharacterCreationData);
    expect(r.slots).toEqual(['2 Pact Magic slots (3rd level)']);
    expect(r.invocations).toEqual({ chosen: 1, allowed: 5 });
  });

  it('reports full-caster slots for a level 5 Wizard and no invocations', () => {
    const r = describeLevelResources({ ...base, level: 5 } as CharacterCreationData);
    expect(r.slots).toEqual(['1st: 4', '2nd: 3', '3rd: 2']);
    expect(r.invocations).toBeUndefined();
  });
});

describe('ASI 20 cap across levels', () => {
  it('counts points spent at an earlier ASI level', () => {
    const data = { ...base, level: 8, cumulativeASI: undefined } as CharacterCreationData;
    render(<StepCumulativeASI {...stepProps(data)} />);
    const intRow = () =>
      screen.getByText('INT').closest('div.flex.items-center.justify-between')!;
    const plus = () => intRow().querySelectorAll('button')[1];
    expect(intRow().textContent).toContain('Current: 17');
    fireEvent.click(plus());
    fireEvent.click(plus());
    expect(intRow().textContent).toContain('New: 19');
    fireEvent.click(screen.getByRole('button', { name: /Next ASI/ }));
    // The second ASI starts from the 19 already reached, so only +1 fits.
    expect(intRow().textContent).toContain('Current: 19');
    fireEvent.click(plus());
    expect(intRow().textContent).toContain('New: 20');
    expect(plus().hasAttribute('disabled')).toBe(true);
  });
});

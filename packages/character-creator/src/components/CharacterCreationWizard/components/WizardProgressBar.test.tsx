/**
 * The progress bar counts the steps a character will actually be asked.
 *
 * Most of the fourteen steps are conditional — a level-1 Fighter never sees
 * High-Level Setup, ASI, Spells or Feats — so reporting "Step 1 of 14" told
 * that player their character creation was half again as long as it was.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WizardProgressBar } from './WizardProgressBar';

const ALL_TITLES = Array.from({ length: 14 }, (_, i) => `Step ${i + 1}`);

describe('WizardProgressBar', () => {
  it('counts only the steps that will render', () => {
    // A level-1 Fighter: no high-level setup, ASI, spells or feats.
    const visible = [0, 1, 2, 3, 4, 7, 10, 11, 12, 13];

    render(
      <WizardProgressBar
        currentStep={0}
        stepTitles={ALL_TITLES}
        visibleStepIndices={visible}
      />,
    );

    expect(screen.getByText('Step 1 of 10')).toBeInTheDocument();
  });

  it('reports position within the visible set, not the raw index', () => {
    const visible = [0, 1, 2, 3, 4, 7, 10, 11, 12, 13];

    // Raw index 7 is the sixth step this character actually sees.
    render(
      <WizardProgressBar
        currentStep={7}
        stepTitles={ALL_TITLES}
        visibleStepIndices={visible}
      />,
    );

    expect(screen.getByText('Step 6 of 10')).toBeInTheDocument();
  });

  it('falls back to the full list when no visible set is supplied', () => {
    render(<WizardProgressBar currentStep={3} stepTitles={ALL_TITLES} />);
    expect(screen.getByText('Step 4 of 14')).toBeInTheDocument();
  });

  it('never reports a position of zero for an unlisted step', () => {
    render(
      <WizardProgressBar
        currentStep={9}
        stepTitles={ALL_TITLES}
        visibleStepIndices={[0, 1, 2]}
      />,
    );
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });
});

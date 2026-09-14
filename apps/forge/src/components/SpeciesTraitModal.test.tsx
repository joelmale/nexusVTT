import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpeciesTraitModal from './SpeciesTraitModal';

describe('SpeciesTraitModal', () => {
  it('should display correct description for Mask of the Wild', () => {
    render(
      <SpeciesTraitModal
        isOpen={true}
        onClose={() => {}}
        traitName="Mask of the Wild"
        speciesName="Wood Elf"
      />
    );

    expect(screen.getByText(/You can attempt to hide even when you are only lightly obscured/)).toBeInTheDocument();
  });

  it('should display correct description for Fleet of Foot', () => {
    render(
      <SpeciesTraitModal
        isOpen={true}
        onClose={() => {}}
        traitName="Fleet of Foot"
        speciesName="Wood Elf"
      />
    );

    expect(screen.getByText(/Your base walking speed increases to 35 feet/)).toBeInTheDocument();
  });

  it('should display fallback message for unknown traits', () => {
    render(
      <SpeciesTraitModal
        isOpen={true}
        onClose={() => {}}
        traitName="Unknown Trait"
        speciesName="Test Species"
      />
    );

    expect(screen.getByText(/This species trait provides special abilities or bonuses to Test Species characters/)).toBeInTheDocument();
  });
});
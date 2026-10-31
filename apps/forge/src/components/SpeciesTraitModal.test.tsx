import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpeciesTraitModal from './SpeciesTraitModal';

describe('SpeciesTraitModal', () => {
  it('shows the rules and a usage tip for the edition being built', () => {
    render(
      <SpeciesTraitModal
        isOpen={true}
        onClose={() => {}}
        traitName="Stonecunning"
        speciesName="Dwarf"
        edition="2024"
      />
    );

    expect(screen.getByText(/tremorsense out to 60 feet/)).toBeInTheDocument();
    expect(screen.getByText('How to use it')).toBeInTheDocument();
  });

  it('uses the darkvision range the species has', () => {
    render(
      <SpeciesTraitModal
        isOpen={true}
        onClose={() => {}}
        traitName="Darkvision"
        speciesName="Orc"
        edition="2024"
        detailedTraits={['Darkvision (120 ft)']}
      />
    );

    expect(screen.getByText(/Out to 120 feet/)).toBeInTheDocument();
  });

  it('falls back to the feature text for subrace traits', () => {
    render(
      <SpeciesTraitModal
        isOpen={true}
        onClose={() => {}}
        traitName="Mask of the Wild"
        speciesName="Wood Elf"
        edition="2014"
      />
    );

    expect(screen.getByText(/You can attempt to hide even when you are only lightly obscured/)).toBeInTheDocument();
    expect(screen.queryByText('How to use it')).toBeNull();
  });

  it('says plainly when a trait has no description', () => {
    render(
      <SpeciesTraitModal
        isOpen={true}
        onClose={() => {}}
        traitName="Unknown Trait"
        speciesName="Test Species"
        edition="2024"
      />
    );

    expect(screen.getByText(/No description is available for this trait yet/)).toBeInTheDocument();
  });
});

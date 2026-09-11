import React, { useState } from 'react';
import SpeciesTraitModal from './components/SpeciesTraitModal';

const TestModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [trait] = useState('Darkvision');
  const [species] = useState('Elf');

  return (
    <div className="p-8">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Open Modal
      </button>

      <SpeciesTraitModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        traitName={trait}
        speciesName={species}
      />
    </div>
  );
};

export default TestModal;
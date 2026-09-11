import React from 'react';
import { X } from 'lucide-react';
import { featureDescriptions } from '../utils/featureDescriptions';

interface SpeciesTraitModalProps {
  isOpen: boolean;
  onClose: () => void;
  traitName: string;
  speciesName: string;
  traitDescription?: string;
  position?: { x: number; y: number } | null;
}

const SpeciesTraitModal: React.FC<SpeciesTraitModalProps> = ({
  isOpen,
  onClose,
  traitName,
  speciesName,
  traitDescription,
  position
}) => {
  if (!isOpen) return null;

  // Get trait description from centralized feature descriptions
  const getTraitDescription = (trait: string): string => {
    if (traitDescription) return traitDescription;

    // Use centralized feature descriptions from JSON
    const featureDesc = featureDescriptions[trait];
    if (featureDesc) {
      return featureDesc.description;
    }

    return `This species trait provides special abilities or bonuses to ${speciesName} characters.`;
  };

  // Calculate modal position
  const getModalStyle = () => {
    if (position) {
      // Position near the click location with some offset
      return {
        position: 'fixed' as const,
        left: Math.min(position.x + 10, window.innerWidth - 400), // 400px is approx modal width
        top: Math.min(position.y + 10, window.innerHeight - 300), // 300px is approx modal height
        zIndex: 60,
      };
    }
    // Default centered position
    return {
      position: 'fixed' as const,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 60,
    };
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={position ? {} : { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        className="bg-theme-secondary border border-theme-primary rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={getModalStyle()}
      >
        <div className="flex items-center justify-between p-4 border-b border-theme-primary">
          <h3 className="text-lg font-bold text-accent-yellow-light">{traitName}</h3>
           <button
             onClick={(e) => {
               e.stopPropagation();
               onClose();
             }}
             className="text-theme-muted hover:text-white transition-colors"
           >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-3">
           <div>
             <span className="text-sm text-theme-muted">From: </span>
             <span className="text-sm text-blue-300">{speciesName}</span>
           </div>

          <div>
            <p className="text-sm text-theme-tertiary leading-relaxed">
              {getTraitDescription(traitName)}
            </p>
          </div>
         </div>
      </div>
    </div>
  );
};

export default SpeciesTraitModal;
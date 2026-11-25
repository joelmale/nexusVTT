import React from 'react';
import { X } from 'lucide-react';
import { getSpeciesTraitText } from '../data/speciesTraitText';
import { featureDescriptions } from '../utils/featureDescriptions';
import type { Edition } from '../types/dnd';

interface SpeciesTraitModalProps {
  isOpen: boolean;
  onClose: () => void;
  traitName: string;
  speciesName: string;
  /** Rules differ by edition for many traits (2024 Stonecunning is tremorsense). */
  edition: Edition;
  /** The species' parenthetical traits, e.g. "Darkvision (120 ft)", for ranges. */
  detailedTraits?: readonly string[];
  position?: { x: number; y: number } | null;
}

const SpeciesTraitModal: React.FC<SpeciesTraitModalProps> = ({
  isOpen,
  onClose,
  traitName,
  speciesName,
  edition,
  detailedTraits,
  position
}) => {
  if (!isOpen) return null;

  // Subrace traits ("Mask of the Wild") are not in the species table yet, so
  // fall back to the older feature text, which has rules but no usage tip.
  const text =
    getSpeciesTraitText(traitName, edition, detailedTraits) ??
    (featureDescriptions[traitName]
      ? { rules: featureDescriptions[traitName].description, tip: '' }
      : null);

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
             className="text-theme-muted hover:text-theme-primary transition-colors"
           >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-3">
           <div>
             <span className="text-sm text-theme-muted">From: </span>
             <span className="text-sm text-tone-info">{speciesName}</span>
           </div>

          {text ? (
            <>
              <p className="text-sm text-theme-tertiary leading-relaxed">
                {text.rules}
              </p>
              {text.tip && (
                <div>
                  <h4 className="text-sm font-semibold text-theme-primary">
                    How to use it
                  </h4>
                  <p className="text-sm text-theme-tertiary leading-relaxed">
                    {text.tip}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-theme-tertiary leading-relaxed">
              No description is available for this trait yet.
            </p>
          )}
         </div>
      </div>
    </div>
  );
};

export default SpeciesTraitModal;
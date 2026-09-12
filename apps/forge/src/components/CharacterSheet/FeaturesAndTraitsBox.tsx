import React, { useState } from 'react';
import { Character } from '../../types/dnd';
import { FeatModal } from '../FeatModal';

interface FeaturesAndTraitsBoxProps {
  character: Character;
}

/**
 * FeaturesAndTraitsBox - Large scrollable features area matching official D&D 5e sheet
 *
 * Combines all features in a single unified scrollable box:
 * - Racial traits
 * - Class features (with level badges)
 * - Subclass features (with level badges)
 * - Selected feats
 */
export const FeaturesAndTraitsBox: React.FC<FeaturesAndTraitsBoxProps> = ({ character }) => {
  const [featModalState, setFeatModalState] = useState<{ isOpen: boolean; featSlug: string | null }>({
    isOpen: false,
    featSlug: null
  });

  const openFeatModal = (featSlug: string) => {
    setFeatModalState({ isOpen: true, featSlug });
  };

  const closeFeatModal = () => {
    setFeatModalState({ isOpen: false, featSlug: null });
  };

  return (
    <div className="border-2 border-[#1e140a] bg-[#fcf6e3] rounded-sm shadow-md p-3">
      <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2 pb-1 border-b border-[#1e140a]/20">
        Features & Traits
      </div>

      {/* Scrollable content area */}
      <div className="overflow-y-auto min-h-[400px] max-h-[600px] space-y-3 features-scroll pr-1">
        {/* Class Features (SRD) */}
        {character.srdFeatures?.classFeatures && character.srdFeatures.classFeatures.length > 0 && (
          <div>
            <div className="text-xs font-cinzel font-semibold text-[#8b4513] uppercase mb-1.5">
              Class Features
            </div>
            <div className="space-y-1.5">
              {character.srdFeatures.classFeatures
                .reduce((unique, feature) => {
                  const existing = unique.find(f => f.name === feature.name);
                  if (!existing || feature.level > existing.level) {
                    return existing
                      ? unique.map(f => f.name === feature.name ? feature : f)
                      : [...unique, feature];
                  }
                  return unique;
                }, [] as typeof character.srdFeatures.classFeatures)
                .map((feature, index) => (
                  <div
                    key={`class-${index}`}
                    className="flex items-start gap-1.5"
                  >
                    <span className="text-[9px] font-cinzel font-bold bg-[#8b4513] text-[#fcf6e3] px-1 py-0.5 rounded-sm flex-shrink-0 mt-0.5">
                      L{feature.level}
                    </span>
                    <span className="text-xs homemade-apple-regular text-[#3d2817] leading-tight">
                      {feature.name}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Subclass Features (SRD) */}
        {character.srdFeatures?.subclassFeatures && character.srdFeatures.subclassFeatures.length > 0 && (
          <div>
            <div className="text-xs font-cinzel font-semibold text-[#8b4513] uppercase mb-1.5">
              Subclass Features
            </div>
            <div className="space-y-1.5">
              {character.srdFeatures.subclassFeatures.map((feature, index) => (
                <div
                  key={`subclass-${index}`}
                  className="flex items-start gap-1.5"
                >
                  <span className="text-[9px] font-cinzel font-bold bg-[#8b4513] text-[#fcf6e3] px-1 py-0.5 rounded-sm flex-shrink-0 mt-0.5">
                    L{feature.level}
                  </span>
                  <span className="text-xs homemade-apple-regular text-[#3d2817] leading-tight">
                    {feature.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Class Features */}
        {character.featuresAndTraits?.classFeatures && character.featuresAndTraits.classFeatures.length > 0 && (
          <div>
            <div className="text-xs font-cinzel font-semibold text-[#8b4513] uppercase mb-1.5">
              Other Features
            </div>
            <div className="space-y-1">
              {character.featuresAndTraits.classFeatures.map((feature, index) => (
                <div
                  key={`other-${index}`}
                  className="text-xs homemade-apple-regular text-[#3d2817] leading-tight"
                >
                  • {feature}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Feats */}
        {character.selectedFeats && character.selectedFeats.length > 0 && (
          <div>
            <div className="text-xs font-cinzel font-semibold text-[#8b4513] uppercase mb-1.5">
              Feats
            </div>
            <div className="space-y-1">
              {character.selectedFeats.map((featSlug, index) => (
                <div
                  key={`feat-${index}`}
                  className="text-xs homemade-apple-regular text-[#3d2817] leading-tight cursor-pointer hover:text-accent-gold transition-colors"
                  onClick={() => openFeatModal(featSlug)}
                >
                  • {featSlug}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!character.srdFeatures?.classFeatures?.length &&
         !character.srdFeatures?.subclassFeatures?.length &&
         !character.featuresAndTraits?.classFeatures?.length &&
         !character.selectedFeats?.length && (
          <div className="text-xs homemade-apple-regular text-[#3d2817]/50 italic text-center py-8">
            No features or traits to display
          </div>
        )}
      </div>

      {/* Feat Modal */}
      <FeatModal
        featSlug={featModalState.featSlug || ''}
        isOpen={featModalState.isOpen}
        onClose={closeFeatModal}
      />

      {/* Custom scrollbar styles */}
      <style>{`
        .features-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .features-scroll::-webkit-scrollbar-track {
          background: #f5ebd2;
          border-radius: 4px;
        }
        .features-scroll::-webkit-scrollbar-thumb {
          background: #8b4513;
          border-radius: 4px;
        }
        .features-scroll::-webkit-scrollbar-thumb:hover {
          background: #a0522d;
        }
      `}</style>
    </div>
  );
};

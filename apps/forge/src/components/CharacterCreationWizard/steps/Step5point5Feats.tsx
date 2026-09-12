import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Shuffle } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { Feat, FeatChoiceMap } from '../../../types/dnd';
import { FEAT_DATABASE, randomizeFeats, loadFeats } from '../../../services/dataService';
import {
  calculateFeatAvailability,
  featProvidesAbilityIncrease,
  getFeatSourceInfo,
  canSelectMoreFeats,
  getFeatAvailability
} from '../../../utils/featUtils';
import { FeatChoiceModal } from '../components';

const RandomizeButton: React.FC<{ onClick: () => void; title?: string; className?: string }> = ({
  onClick,
  title = "Randomize this section",
  className = ""
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2 ${className}`}
      title={title}
    >
      <Shuffle className="w-4 h-4" />
      Randomize
    </button>
  );
};

export const Step5point5Feats: React.FC<StepProps> = ({ data, updateData, nextStep, prevStep, getNextStepLabel }) => {
  const [showFeatDetails, setShowFeatDetails] = useState<string | null>(null);
  const [featChoiceModal, setFeatChoiceModal] = useState<{ isOpen: boolean; feat: Feat | null }>({ isOpen: false, feat: null });
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  // Calculate how many feats the character can take
  const maxFeats = calculateFeatAvailability(data);
  const selectedFeats = data.selectedFeats || [];

  // Load all feats and calculate availability
  const allFeats = useMemo(() => loadFeats().map(feat => {
    const availability = getFeatAvailability(feat, data);
    return {
      feat,
      isAvailable: availability.isAvailable,
      reason: availability.reason,
      requirements: feat.prerequisite || ''
    };
  }), [data]);

  const displayedFeats = useMemo(() => {
    return showAvailableOnly ? allFeats.filter(f => f.isAvailable) : allFeats;
  }, [allFeats, showAvailableOnly]);

  // Helper function to check if a feat requires choices
  const featRequiresChoices = (featSlug: string): boolean => {
    const feat = loadFeats().find(f => f.slug === featSlug);
    return !!(feat?.abilityScoreIncrease);
  };



  const handleFeatToggle = (featSlug: string) => {
    const isSelected = selectedFeats.includes(featSlug);

    if (isSelected) {
      // Deselect
      updateData({
        selectedFeats: selectedFeats.filter(s => s !== featSlug)
      });
    } else if (canSelectMoreFeats(selectedFeats, data)) {
      // Check if feat requires additional choices
      if (featRequiresChoices(featSlug)) {
        // For feats that require choices, we need to get the feat data
        const featData = allFeats.find(f => f.feat.slug === featSlug);
        if (featData && featData.feat) {
          setFeatChoiceModal({ isOpen: true, feat: featData.feat });
        } else {
          // Fallback: select directly if feat not found
          updateData({
            selectedFeats: [...selectedFeats, featSlug]
          });
        }
      } else {
        // Select directly
        updateData({
          selectedFeats: [...selectedFeats, featSlug]
        });
      }
    }
  };

  const handleFeatChoiceConfirm = (choices: FeatChoiceMap) => {
    if (!featChoiceModal.feat) return;

    // Store the choices in the character data
    const featChoices = { ...(data.featChoices || {}), [featChoiceModal.feat.slug]: choices };

    updateData({
      selectedFeats: [...selectedFeats, featChoiceModal.feat.slug],
      featChoices
    });
  };

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-start'>
        <div className='flex-1'>
          <h3 className='text-xl font-bold text-red-300'>Choose Feats (Optional)</h3>
          <p className='text-sm text-theme-muted mt-2'>
            Feats represent special talents or areas of expertise. At certain levels, you can choose to take a feat instead of an Ability Score Improvement.
          </p>
          <div className="mt-2 p-3 bg-blue-900/30 border border-accent-blue-dark rounded-lg">
            <div className="text-sm text-blue-300">
              <strong>Level {data.level}:</strong> You can select up to {maxFeats} feat{maxFeats !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="text-xs text-theme-muted mt-1">
            ℹ️ Feats are optional. You can also choose Ability Score Improvements at these levels.
          </div>
        </div>
        <RandomizeButton
          onClick={() => {
            const feats = randomizeFeats();
            updateData({ selectedFeats: feats });
          }}
          title="Randomize feat selection"
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-theme-muted">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="form-checkbox text-accent-yellow-light"
            checked={showAvailableOnly}
            onChange={(e) => setShowAvailableOnly(e.target.checked)}
          />
          Show available only
        </label>
      </div>

      {selectedFeats.length > 0 && (
        <div className="bg-accent-green-darker/20 border border-accent-green-dark rounded-lg p-3">
          <div className="text-sm font-semibold text-accent-green-light mb-2">
            Selected Feats ({selectedFeats.length} / {maxFeats}):
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedFeats.map(slug => {
              const feat = FEAT_DATABASE.find(f => f.slug === slug);
              return (
                <span key={slug} className="px-2 py-1 bg-accent-green-dark text-white text-xs rounded">
                  {feat?.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {maxFeats > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2">
          {displayedFeats.map(({ feat, isAvailable, requirements, reason }) => {
            const isSelected = selectedFeats.includes(feat.slug);
            const canSelect = canSelectMoreFeats(selectedFeats, data) && isAvailable;

            return (
              <div key={feat.slug} className="relative">
                <button
                  onClick={() => handleFeatToggle(feat.slug)}
                  disabled={(!canSelect && !isSelected) || !isAvailable}
                  className={`w-full p-3 rounded-lg text-left border-2 transition-all ${
                    isSelected
                      ? 'bg-green-800 border-green-500 shadow-md'
                      : isAvailable && canSelect
                      ? 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
                      : isAvailable
                      ? 'bg-theme-secondary border-theme-secondary text-theme-disabled cursor-not-allowed'
                      : 'bg-gray-800 border-gray-600 text-gray-500 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className={`text-sm font-bold ${isAvailable ? 'text-accent-yellow-light' : 'text-gray-400'}`}>
                      {feat.name}
                    </p>
                    {featProvidesAbilityIncrease(feat) && (
                      <span className="text-xs bg-accent-blue text-white px-1 py-0.5 rounded ml-2">
                        +ASI
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${isAvailable ? 'text-theme-disabled' : 'text-gray-500'}`}>
                    {getFeatSourceInfo(feat)}
                  </p>
                  {!isAvailable && (
                    <p className="text-xs text-red-400 mt-1">
                      Unavailable: {reason || requirements}
                    </p>
                  )}
                  {feat.prerequisite && isAvailable && (
                    <p className="text-xs text-accent-yellow-light mt-1">
                      Requires: {feat.prerequisite}
                    </p>
                  )}
                  <p className={`text-xs mt-2 line-clamp-2 ${isAvailable ? 'text-theme-muted' : 'text-gray-500'}`}>
                    {feat.description}
                  </p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFeatDetails(showFeatDetails === feat.slug ? null : feat.slug);
                  }}
                  className="absolute top-2 right-2 text-xs text-accent-blue-light hover:text-blue-300"
                  title="View details"
                >
                  {showFeatDetails === feat.slug ? '✕' : 'ℹ️'}
                </button>
                {showFeatDetails === feat.slug && (
                  <div className="absolute z-10 mt-2 p-3 bg-theme-primary border border-theme-primary rounded-lg shadow-xl w-80 left-0">
                    <h5 className="font-bold text-accent-yellow-light text-sm mb-2">{feat.name}</h5>
                    <p className="text-xs text-theme-tertiary mb-2">{feat.description}</p>
                    <div className="text-xs text-theme-muted">
                      <strong className="text-theme-tertiary">Benefits:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {feat.benefits.map((benefit, idx) => (
                          <li key={idx}>{benefit}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {maxFeats === 0 && (
        <div className="text-center text-theme-muted py-8">
          <p>Feats become available starting at level 4.</p>
          <p className="text-sm mt-2">Your character is currently level {data.level}.</p>
        </div>
      )}

      <div className='flex justify-between'>
        <button onClick={prevStep} className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <button
          onClick={nextStep}
          className="px-4 py-2 bg-accent-red hover:bg-accent-red-light rounded-lg text-white flex items-center"
        >
          Next: {getNextStepLabel?.() || 'Continue'} <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>

      <FeatChoiceModal
        isOpen={featChoiceModal.isOpen}
        onClose={() => setFeatChoiceModal({ isOpen: false, feat: null })}
        feat={featChoiceModal.feat}
        onConfirm={handleFeatChoiceConfirm}
      />
    </div>
  );
};

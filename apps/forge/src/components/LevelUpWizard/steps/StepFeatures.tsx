/**
 * Level-Up Wizard - Features Step
 *
 * Summary of automatic features gained at this level
 */

import React from 'react';
import { Character } from '../../../types/dnd';
import { LevelUpData } from '../../../data/classProgression';

interface StepFeaturesProps {
  character: Character;
  levelUpData: LevelUpData;
  onNext: () => void;
  onPrev: () => void;
}

export const StepFeatures: React.FC<StepFeaturesProps> = ({
  character: _character,
  levelUpData,
  onNext,
  onPrev
}) => {
  const automaticFeatures = levelUpData.features.filter(f => f.automatic);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-accent-gold mb-2">
          New Features
        </h3>
        <p className="text-[#992600]">
          Here are the features you gain at level {levelUpData.toLevel}.
        </p>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {automaticFeatures.length > 0 ? (
          automaticFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-theme-primary rounded-lg p-5 border border-theme-border"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-accent-gold bg-opacity-20 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-5 h-5 text-accent-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-accent-gold mb-2">
                    {feature.name}
                  </h4>
                  <p className="text-theme-text text-sm leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Show resources gained */}
                  {feature.resources && feature.resources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-theme-border">
                      {feature.resources.map((resource, rIndex) => (
                        <div key={rIndex} className="flex items-center text-sm">
                          <svg className="w-4 h-4 text-accent-gold mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                          </svg>
                          <span className="text-[#992600]">
                            {resource.maxUses} use{resource.maxUses !== 1 ? 's' : ''} •
                            Recharges on {resource.rechargeType === 'short-rest' ? 'short or long rest' : resource.rechargeType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-theme-primary rounded-lg p-6 text-center">
            <p className="text-[#992600]">
              No automatic features at this level. Continue to see your level-up summary.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-3 bg-theme-primary text-theme-text font-semibold rounded-lg hover:bg-opacity-80 transition-colors border border-theme-border"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 bg-[#ffaa00] border bg-accent-gold text-theme-primary font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

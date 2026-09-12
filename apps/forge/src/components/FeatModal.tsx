/**
 * Feat Modal Component
 *
 * Displays detailed information about a feat, including description,
 * benefits, prerequisites, and granted abilities/spells.
 */

import React from 'react';
import { loadFeats } from '../services/dataService';

interface FeatModalProps {
  featSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

export const FeatModal: React.FC<FeatModalProps> = ({
  featSlug,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const feats = loadFeats();
  const feat = feats.find(f => f.slug === featSlug);

  if (!feat) {
    return (
      <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-[100] p-4">
        <div className="relative z-10 bg-theme-primary border-2 border-theme-border rounded-sm shadow-md w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-xl font-bold text-accent-gold mb-4">Feat Not Found</h2>
            <p className="text-theme-text mb-4">Could not find feat: {featSlug}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent-gold text-theme-primary rounded hover:bg-opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="relative z-10 bg-theme-primary border-2 border-theme-border rounded-sm shadow-md w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-theme-border">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-accent-gold mb-1">{feat.name}</h2>
              <div className="flex items-center gap-2 text-sm text-theme-muted">
                <span className="px-2 py-1 bg-accent-gold bg-opacity-20 text-accent-gold rounded text-xs uppercase font-semibold">
                  {feat.category || 'General'}
                </span>
                <span>•</span>
                <span>{feat.source} {feat.year}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-700 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Prerequisites */}
          {feat.prerequisite && (
            <div>
              <h3 className="text-lg font-semibold text-accent-gold mb-2">Prerequisites</h3>
              <p className="text-theme-text">{feat.prerequisite}</p>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-accent-gold mb-2">Description</h3>
            <p className="text-theme-text leading-relaxed">{feat.description}</p>
          </div>

          {/* Benefits */}
          {feat.benefits && feat.benefits.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-accent-gold mb-2">Benefits</h3>
              <ul className="space-y-1">
                {feat.benefits.map((benefit, index) => (
                  <li key={index} className="text-theme-text flex items-start">
                    <span className="text-accent-gold mr-2">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Special handling for Drow High Magic */}
          {feat.slug === 'drow-high-magic' && (
            <div className="bg-accent-purple bg-opacity-10 border border-accent-purple border-opacity-30 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-accent-purple mb-3">Granted Spells</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <span className="font-semibold text-theme-text">Detect Magic</span>
                    <span className="text-sm text-theme-muted ml-2">(at will, CHA)</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <span className="font-semibold text-theme-text">Levitate</span>
                    <span className="text-sm text-theme-muted ml-2">(1/long rest, CHA)</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <span className="font-semibold text-theme-text">Dispel Magic</span>
                    <span className="text-sm text-theme-muted ml-2">(1/long rest, CHA)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-theme-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-accent-gold text-theme-primary font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
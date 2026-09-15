import React from 'react';
import { AutomaticWidgetProps } from '../../../types/widgets';

/**
 * AutomaticWidget
 *
 * Display-only component for features that don't require user selection.
 * Used for: Sneak Attack, Thieves' Cant, passive class features
 *
 * Features:
 * - Shows feature name and description
 * - Lists automatic grants (languages, abilities, etc.)
 * - No interaction required
 * - Informational display only
 */
export const AutomaticWidget: React.FC<AutomaticWidgetProps> = ({
  feature,
}) => {
  const config = feature.widget_config;

  return (
    <div className="automatic-widget mb-6">
      {/* Feature Card */}
      <div className="p-6 rounded-xl border-2 border-gray-600 bg-gray-800/50">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-amber-400">
            {feature.name}
          </h3>
          <div className="text-xs font-semibold text-green-400 px-3 py-1 rounded-full bg-green-400/20 border border-green-400/50">
            AUTO-GRANTED
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-300 text-sm mb-4">
          {feature.desc}
        </p>

        {/* Grants Section */}
        {(config.grants || config.bonus_language_choices || config.effect) && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="text-xs font-semibold text-amber-400 mb-2">
              You Receive:
            </div>
            <ul className="space-y-1">
              {/* Automatic Grants */}
              {config.grants?.map((grant, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{formatGrant(grant)}</span>
                </li>
              ))}

              {/* Bonus Language Choices */}
              {config.bonus_language_choices && (
                <li className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>
                    Choice of {config.bonus_language_choices} additional{' '}
                    {config.bonus_language_choices === 1 ? 'language' : 'languages'}
                  </span>
                </li>
              )}

              {/* Effect */}
              {config.effect && (
                <li className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{formatEffect(config.effect)}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format grant string into readable text
 */
const formatGrant = (grant: string): string => {
  // Language grants
  if (grant.startsWith('language_')) {
    const langName = grant.replace('language_', '').replace(/_/g, ' ');
    return `${formatLanguageName(langName)} language`;
  }

  // Feature grants
  if (grant.startsWith('feature_')) {
    const featureName = grant.replace('feature_', '').replace(/_/g, ' ');
    return `${formatFeatureName(featureName)} feature`;
  }

  // Default formatting
  return grant.replace(/_/g, ' ').split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Format language name
 */
const formatLanguageName = (lang: string): string => {
  const langMap: Record<string, string> = {
    'thieves cant': "Thieves' Cant",
    'common': 'Common',
    'elvish': 'Elvish',
    'dwarvish': 'Dwarvish',
    'draconic': 'Draconic',
  };

  return langMap[lang.toLowerCase()] || lang.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Format feature name
 */
const formatFeatureName = (feature: string): string => {
  return feature.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Format effect description
 */
const formatEffect = (effect: string): string => {
  const effectMap: Record<string, string> = {
    'sneak_attack_1d6': 'Sneak Attack: Deal an extra 1d6 damage once per turn with Finesse or Ranged weapons when you have Advantage',
    'sneak_attack': 'Sneak Attack: Extra damage with Finesse or Ranged weapons',
    'divine_sense': 'Divine Sense: Detect celestials, fiends, and undead within 60 feet',
    'lay_on_hands': 'Lay on Hands: Pool of healing equal to 5 × your Paladin level',
  };

  return effectMap[effect] || effect.replace(/_/g, ' ').split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

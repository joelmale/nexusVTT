import React from 'react';
import { BranchChoiceWidgetProps, GrantConfig } from '../../../types/widgets';

/**
 * BranchChoiceWidget
 *
 * Component for selecting between 2-3 mutually exclusive options.
 * Used for: Divine Order (Cleric), Primal Order (Druid), Pact Boon (Warlock)
 *
 * Features:
 * - Large, prominent choice cards
 * - Shows benefits/grants clearly
 * - Visual distinction between options
 * - Radio button-style selection (one choice only)
 */
export const BranchChoiceWidget: React.FC<BranchChoiceWidgetProps> = ({
  feature,
  currentChoice,
  onChoiceChange,
}) => {
  const config = feature.widget_config;

  const handleSelect = (optionId: string) => {
    onChoiceChange(optionId);
  };

  return (
    <div className="branch-choice-widget mb-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-amber-400 mb-2">
          {feature.name}
        </h3>
        <p className="text-gray-300 text-sm mb-3">
          {feature.desc}
        </p>
        {!currentChoice && (
          <div className="text-amber-400 text-sm">
            ⚠️ Please choose one option
          </div>
        )}
      </div>

      {/* Choice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {config.options.map((option) => {
          const isSelected = currentChoice === option.id;

          return (
            <BranchCard
              key={option.id}
              option={option}
              selected={isSelected}
              onClick={() => handleSelect(option.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

interface BranchCardProps {
  option: {
    id: string;
    label: string;
    description: string;
    icon?: string;
    grants?: GrantConfig[];
  };
  selected: boolean;
  onClick: () => void;
}

const BranchCard: React.FC<BranchCardProps> = ({ option, selected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        p-6 rounded-xl border-2 text-left transition-all
        ${selected
          ? 'border-amber-400 bg-amber-400/20 shadow-2xl shadow-amber-400/50 scale-105'
          : 'border-gray-600 bg-gray-800/50 hover:border-amber-400/50 hover:bg-gray-700/50 hover:scale-102 cursor-pointer'
        }
      `}
    >
      {/* Header with Icon */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {option.icon && (
            <div className="text-3xl">{option.icon}</div>
          )}
          <div>
            <h4 className="text-lg font-bold text-white">
              {option.label}
              {selected && <span className="ml-2 text-amber-400">✓</span>}
            </h4>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm mb-4">
        {option.description}
      </p>

      {/* Grants/Benefits */}
      {option.grants && option.grants.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <div className="text-xs font-semibold text-amber-400 mb-2">
            Benefits:
          </div>
          <ul className="space-y-1">
            {option.grants.map((grant, index) => (
              <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>{formatGrant(grant)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selection Indicator */}
      {selected && (
        <div className="mt-4 pt-4 border-t border-amber-400/30">
          <div className="text-xs font-semibold text-amber-400 text-center">
            ✓ SELECTED
          </div>
        </div>
      )}
    </button>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format grant configuration into readable text
 */
type Grant = GrantConfig;

const formatGrant = (grant: Grant): string => {
  switch (grant.type) {
    case 'proficiency':
      if (grant.proficiencies || grant.items) {
        const profs = grant.proficiencies || grant.items || [];
        const formattedProfs = profs.map((prof: string) => formatProficiencyName(prof)).join(', ');
        return `Proficiency: ${formattedProfs}`;
      }
      return 'Additional proficiency';

    case 'skill_bonus':
      if (grant.skill_bonuses && grant.skill_bonuses.length > 0) {
        const bonuses = grant.skill_bonuses.map((bonus) => {
          const ability = bonus.ability || '';
          return `+${ability} modifier to ${formatSkillName(bonus.skill)}`;
        });
        return bonuses.join(', ');
      }
      if (grant.skills && grant.skills.length > 0) {
        const bonusLabel = formatSkillBonus(grant.bonus);
        return `${bonusLabel} to ${grant.skills.map(formatSkillName).join(', ')}`;
      }
      return 'Skill bonus';

    case 'cantrip_bonus':
      return `+${grant.value || grant.cantrip_bonus || 1} cantrip known`;

    case 'language':
      if (grant.languages && grant.languages.length > 0) {
        return `Languages: ${grant.languages.join(', ')}`;
      }
      return 'Additional language';

    case 'feature':
      return 'Special feature';

    default:
      return 'Special benefit';
  }
};

/**
 * Format proficiency name
 */
const formatProficiencyName = (prof: string): string => {
  const profMap: Record<string, string> = {
    'heavy-armor': 'Heavy Armor',
    'heavy': 'Heavy Armor',
    'medium-armor': 'Medium Armor',
    'light-armor': 'Light Armor',
    'shields': 'Shields',
    'simple-weapons': 'Simple Weapons',
    'martial-weapons': 'Martial Weapons',
    'martial': 'Martial Weapons',
  };

  return profMap[prof] || prof.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Format skill name
 */
const formatSkillName = (skill: string): string => {
  const skillMap: Record<string, string> = {
    'arcana': 'Arcana',
    'religion': 'Religion',
    'nature': 'Nature',
    'medicine': 'Medicine',
    'animal_handling': 'Animal Handling',
    'survival': 'Survival',
  };

  return skillMap[skill] || skill.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const formatSkillBonus = (bonus?: string): string => {
  if (!bonus) return '+Ability modifier';
  if (bonus.includes('wisdom')) return '+WIS modifier';
  if (bonus.includes('intelligence')) return '+INT modifier';
  if (bonus.includes('charisma')) return '+CHA modifier';
  if (bonus.includes('strength')) return '+STR modifier';
  if (bonus.includes('dexterity')) return '+DEX modifier';
  if (bonus.includes('constitution')) return '+CON modifier';
  return '+Ability modifier';
};

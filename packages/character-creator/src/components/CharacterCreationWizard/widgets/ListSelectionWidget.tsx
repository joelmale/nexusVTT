import React from 'react';
import { ListSelectionWidgetProps } from '../../../types/widgets';

/**
 * ListSelectionWidget
 *
 * Radio-style selection component for choosing 1 item from a list.
 * Used for: Fighting Styles, Eldritch Invocations, feat selection
 *
 * Features:
 * - Single-choice radio button style
 * - Large option cards with descriptions
 * - Shows prerequisites if applicable
 * - Amber theme matching existing widgets
 */
export const ListSelectionWidget: React.FC<ListSelectionWidgetProps> = ({
  feature,
  currentSelection,
  onSelectionChange,
}) => {
  const config = feature.widget_config;

  // Get options based on type
  const options = getOptionsForType(config.type, config.filter);

  const handleSelect = (optionId: string) => {
    // For single selection, replace the array
    onSelectionChange([optionId]);
  };

  const selectedOption = currentSelection.length > 0 ? currentSelection[0] : null;

  return (
    <div className="list-selection-widget mb-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-amber-400 mb-2">
          {feature.name}
        </h3>
        <p className="text-gray-300 text-sm mb-3">
          {feature.desc}
        </p>
        {!selectedOption && (
          <div className="text-amber-400 text-sm">
            ⚠️ Please choose one option
          </div>
        )}
      </div>

      {/* Option Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option) => {
          const isSelected = selectedOption === option.id;

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={!!(option.prerequisite && option.prerequisite.trim()) && !option.prerequisiteMet}
              className={`
                p-5 rounded-xl border-2 text-left transition-all
                ${isSelected
                  ? 'border-amber-400 bg-amber-400/20 shadow-2xl shadow-amber-400/50 scale-[1.02]'
                  : option.prerequisite && !option.prerequisiteMet
                    ? 'border-gray-700 bg-gray-800/30 opacity-50 cursor-not-allowed'
                    : 'border-gray-600 bg-gray-800/50 hover:border-amber-400/50 hover:bg-gray-700/50 cursor-pointer'
                }
              `}
            >
              {/* Option Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-white mb-1">
                    {option.name}
                    {isSelected && <span className="ml-2 text-amber-400">✓</span>}
                  </h4>
                  {option.shortDesc && (
                    <p className="text-xs text-amber-300 font-semibold">
                      {option.shortDesc}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-300 mb-3">
                {option.description}
              </p>

              {/* Prerequisites (if any) */}
              {option.prerequisite && (
                <div className="pt-3 border-t border-gray-600">
                  <p className="text-xs text-gray-400">
                    <strong>Prerequisite:</strong> {option.prerequisite}
                  </p>
                </div>
              )}

              {/* Selection Indicator */}
              {isSelected && (
                <div className="mt-3 pt-3 border-t border-amber-400/30">
                  <div className="text-xs font-semibold text-amber-400 text-center">
                    ✓ SELECTED
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selection Confirmation */}
      {selectedOption && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg">
          <div className="text-green-300 text-sm">
            ✓ Selected: <strong className="text-green-400">
              {options.find(o => o.id === selectedOption)?.name}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

interface ListOption {
  id: string;
  name: string;
  shortDesc?: string;
  description: string;
  prerequisite?: string;
  prerequisiteMet?: boolean;
}

/**
 * Get options based on selection type
 */
function getOptionsForType(type: 'fighting_style' | 'invocation' | 'feat', filter?: string): ListOption[] {
  switch (type) {
    case 'fighting_style':
      return getFightingStyleOptions();
    case 'invocation':
      return getInvocationOptions(filter);
    case 'feat':
      return getFeatOptions(filter);
    default:
      return [];
  }
}

/**
 * Fighting Style Options (2024 PHB)
 */
function getFightingStyleOptions(): ListOption[] {
  return [
    {
      id: 'archery',
      name: 'Archery',
      shortDesc: '+2 to ranged attack rolls',
      description: 'You gain a +2 bonus to attack rolls you make with Ranged weapons.',
    },
    {
      id: 'defense',
      name: 'Defense',
      shortDesc: '+1 AC while wearing armor',
      description: 'While you are wearing armor, you gain a +1 bonus to Armor Class.',
    },
    {
      id: 'dueling',
      name: 'Dueling',
      shortDesc: '+2 damage with one-handed weapon',
      description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
    },
    {
      id: 'great-weapon-fighting',
      name: 'Great Weapon Fighting',
      shortDesc: 'Reroll 1s and 2s on damage',
      description: 'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll. The weapon must have the Two-Handed or Versatile property for you to gain this benefit.',
    },
    {
      id: 'two-weapon-fighting',
      name: 'Two-Weapon Fighting',
      shortDesc: 'Add ability modifier to off-hand attack',
      description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
    },
    {
      id: 'blind-fighting',
      name: 'Blind Fighting',
      shortDesc: 'Blindsight 10 feet',
      description: 'You have Blindsight with a range of 10 feet. Within that range, you can effectively see anything that isn\'t behind Total Cover, even if you\'re Blinded or in Darkness. Moreover, you can see an invisible creature within that range, unless the creature successfully hides from you.',
    },
    {
      id: 'interception',
      name: 'Interception',
      shortDesc: 'Reduce damage to nearby ally',
      description: 'When a creature you can see hits a target, other than you, within 5 feet of you with an attack, you can use your reaction to reduce the damage the target takes by 1d10 + your proficiency bonus (to a minimum of 0 damage). You must be wielding a Shield or a Simple or Martial weapon to use this reaction.',
    },
    {
      id: 'protection',
      name: 'Protection',
      shortDesc: 'Impose disadvantage on attacks',
      description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a Shield.',
    },
    {
      id: 'thrown-weapon-fighting',
      name: 'Thrown Weapon Fighting',
      shortDesc: '+2 damage with thrown weapons',
      description: 'You can draw a weapon that has the Thrown property as part of the attack you make with the weapon. In addition, when you hit with a ranged attack using a thrown weapon, you gain a +2 bonus to the damage roll.',
    },
    {
      id: 'unarmed-fighting',
      name: 'Unarmed Fighting',
      shortDesc: '1d6 (or 1d8) unarmed damage',
      description: 'Your unarmed strikes can deal bludgeoning damage equal to 1d6 + your Strength modifier on a hit. If you aren\'t wielding any weapons or a Shield when you make the attack roll, the d6 becomes a d8. At the start of each of your turns, you can deal 1d4 bludgeoning damage to one creature grappled by you.',
    },
  ];
}

/**
 * Eldritch Invocation Options (Level 1 compatible only)
 */
function getInvocationOptions(filter?: string): ListOption[] {
  // Only level 1 compatible invocations (no Pact Boon prerequisites)
  const allInvocations: ListOption[] = [
    {
      id: 'armor-of-shadows',
      name: 'Armor of Shadows',
      shortDesc: 'Cast Mage Armor at will',
      description: 'You can cast Mage Armor on yourself at will, without expending a spell slot or material components.',
    },
    {
      id: 'beast-speech',
      name: 'Beast Speech',
      shortDesc: 'Speak with animals at will',
      description: 'You can cast Speak with Animals at will, without expending a spell slot.',
    },
    {
      id: 'eldritch-mind',
      name: 'Eldritch Mind',
      shortDesc: 'Advantage on concentration saves',
      description: 'You have advantage on Constitution saving throws that you make to maintain your concentration on a spell.',
    },
    {
      id: 'fiendish-vigor',
      name: 'Fiendish Vigor',
      shortDesc: 'Cast False Life at will',
      description: 'You can cast False Life on yourself at will as a 1st-level spell, without expending a spell slot or material components.',
    },
    {
      id: 'misty-visions',
      name: 'Misty Visions',
      shortDesc: 'Cast Silent Image at will',
      description: 'You can cast Silent Image at will, without expending a spell slot or material components.',
    },
    {
      id: 'thief-of-five-fates',
      name: 'Thief of Five Fates',
      shortDesc: 'Cast Bane once per long rest',
      description: 'You can cast Bane once using a Warlock spell slot. You can\'t do so again until you finish a long rest.',
    },
  ];

  // Filter based on level requirements
  if (filter === 'level_1_compatible') {
    return allInvocations;
  }

  return allInvocations;
}

/**
 * Feat Options (placeholder - would need full feat database)
 */
function getFeatOptions(_filter?: string): ListOption[] {
  // This would need to be populated from a feat database
  // For now, return empty array as feats are handled separately
  return [];
}

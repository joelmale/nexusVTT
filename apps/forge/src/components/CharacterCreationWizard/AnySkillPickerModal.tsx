import React, { useState } from 'react';
import { SkillName } from '../../types/dnd';

/**
 * AnySkillPickerModal
 *
 * Modal for handling the 2024 "Any Skill" duplicate proficiency rule.
 * When a character gains the same skill from multiple sources (Background + Class),
 * they can choose ANY skill to replace the duplicate.
 *
 * 2024 Rule (PHB):
 * "If you gain proficiency in a skill that you're already proficient in,
 * you can choose any other skill proficiency in its place."
 *
 * Features:
 * - Shows all 18 D&D skills
 * - Filters out already-selected skills
 * - Highlights the replacement choice
 * - Modal overlay with backdrop blur
 */

interface AnySkillPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateSkill: string;
  alreadySelectedSkills: string[];
  onSelectReplacement: (replacementSkill: string) => void;
}

export const AnySkillPickerModal: React.FC<AnySkillPickerModalProps> = ({
  isOpen,
  onClose,
  duplicateSkill,
  alreadySelectedSkills,
  onSelectReplacement,
}) => {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  if (!isOpen) return null;

  // All 18 D&D skills with their governing abilities
  const allSkills: Array<{ name: SkillName; ability: string }> = [
    { name: 'Acrobatics', ability: 'DEX' },
    { name: 'AnimalHandling', ability: 'WIS' },
    { name: 'Arcana', ability: 'INT' },
    { name: 'Athletics', ability: 'STR' },
    { name: 'Deception', ability: 'CHA' },
    { name: 'History', ability: 'INT' },
    { name: 'Insight', ability: 'WIS' },
    { name: 'Intimidation', ability: 'CHA' },
    { name: 'Investigation', ability: 'INT' },
    { name: 'Medicine', ability: 'WIS' },
    { name: 'Nature', ability: 'INT' },
    { name: 'Perception', ability: 'WIS' },
    { name: 'Performance', ability: 'CHA' },
    { name: 'Persuasion', ability: 'CHA' },
    { name: 'Religion', ability: 'INT' },
    { name: 'SleightOfHand', ability: 'DEX' },
    { name: 'Stealth', ability: 'DEX' },
    { name: 'Survival', ability: 'WIS' },
  ];

  // Filter out already selected skills
  const availableSkills = allSkills.filter(
    skill => !alreadySelectedSkills.includes(skill.name)
  );

  const handleConfirm = () => {
    if (selectedSkill) {
      onSelectReplacement(selectedSkill);
      setSelectedSkill(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedSkill(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-xl border-2 border-amber-400 shadow-2xl shadow-amber-400/50 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 z-10">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold text-amber-400 mb-2">
                ⚠️ Duplicate Skill Proficiency
              </h2>
              <div className="text-gray-300 text-sm">
                <strong className="text-amber-400">{formatSkillName(duplicateSkill)}</strong> is already granted by your Background
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* 2024 Rule Explanation */}
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mt-4">
            <div className="text-blue-300 text-sm">
              <strong className="text-blue-400">2024 Rule:</strong> When you gain proficiency
              in a skill you already have, you may choose <strong>ANY</strong> other skill proficiency
              to replace it.
            </div>
          </div>
        </div>

        {/* Skill Grid */}
        <div className="p-6">
          <div className="text-white font-semibold mb-4">
            Choose a replacement skill:
          </div>

          <div className="grid grid-cols-2 gap-3">
            {availableSkills.map((skill) => {
              const isSelected = selectedSkill === skill.name;

              return (
                <button
                  key={skill.name}
                  onClick={() => setSelectedSkill(skill.name)}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all
                    ${isSelected
                      ? 'border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/50'
                      : 'border-gray-600 bg-gray-800/50 hover:border-amber-400/50 hover:bg-gray-700/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        {formatSkillName(skill.name)}
                        {isSelected && <span className="ml-2 text-amber-400">✓</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {skill.ability} based
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedSkill && (
            <div className="mt-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg">
              <div className="text-green-300 text-sm">
                ✓ You will gain <strong className="text-green-400">{formatSkillName(selectedSkill)}</strong> proficiency
                instead of the duplicate <strong>{formatSkillName(duplicateSkill)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6 flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-6 py-3 rounded-lg border-2 border-gray-600 bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSkill}
            className={`
              px-6 py-3 rounded-lg border-2 font-semibold transition-all
              ${selectedSkill
                ? 'border-amber-400 bg-amber-400 text-gray-900 hover:bg-amber-300 hover:border-amber-300 shadow-lg shadow-amber-400/50'
                : 'border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Confirm Replacement
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format skill name from camelCase to display format
 */
const formatSkillName = (skill: string): string => {
  const skillMap: Record<string, string> = {
    'Acrobatics': 'Acrobatics',
    'AnimalHandling': 'Animal Handling',
    'Arcana': 'Arcana',
    'Athletics': 'Athletics',
    'Deception': 'Deception',
    'History': 'History',
    'Insight': 'Insight',
    'Intimidation': 'Intimidation',
    'Investigation': 'Investigation',
    'Medicine': 'Medicine',
    'Nature': 'Nature',
    'Perception': 'Perception',
    'Performance': 'Performance',
    'Persuasion': 'Persuasion',
    'Religion': 'Religion',
    'SleightOfHand': 'Sleight of Hand',
    'Stealth': 'Stealth',
    'Survival': 'Survival',
  };

  return skillMap[skill] || skill;
};

/**
 * FeatChoiceModal - Modal for selecting additional options when choosing feats
 *
 * Handles feats that require additional player choices like:
 * - Elemental Adept: Damage type selection
 * - Metamagic Adept: Metamagic option selection
 * - Armor feats: STR vs DEX choice
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Feat, FeatChoiceMap } from '../../../types/dnd';

interface FeatChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  feat: Feat | null;
  onConfirm: (choices: FeatChoiceMap) => void;
}

export const FeatChoiceModal: React.FC<FeatChoiceModalProps> = ({
  isOpen,
  onClose,
  feat,
  onConfirm
}) => {
  const getChoiceOptions = () => {
    if (!feat) return null;

    switch (feat.slug) {
      case 'elemental-adept':
        return {
          title: 'Choose Damage Type',
          description: 'Select the damage type your spells will ignore resistance to:',
          options: [
            { value: 'acid', label: 'Acid' },
            { value: 'cold', label: 'Cold' },
            { value: 'fire', label: 'Fire' },
            { value: 'lightning', label: 'Lightning' },
            { value: 'thunder', label: 'Thunder' }
          ],
          key: 'damageType'
        };

      case 'metamagic-adept':
        return {
          title: 'Choose Metamagic Options',
          description: 'Select two metamagic options you gain access to:',
          options: [
            { value: 'careful-spell', label: 'Careful Spell' },
            { value: 'distant-spell', label: 'Distant Spell' },
            { value: 'empowered-spell', label: 'Empowered Spell' },
            { value: 'extended-spell', label: 'Extended Spell' },
            { value: 'heightened-spell', label: 'Heightened Spell' },
            { value: 'quickened-spell', label: 'Quickened Spell' },
            { value: 'subtle-spell', label: 'Subtle Spell' },
            { value: 'twinned-spell', label: 'Twinned Spell' }
          ],
          key: 'metamagicOptions',
          multiple: true,
          maxSelect: 2
        };

      case 'lightly-armored':
        return {
          title: 'Choose Ability Increase',
          description: 'Select which ability score to increase by 1:',
          options: [
            { value: 'STR', label: 'Strength' },
            { value: 'DEX', label: 'Dexterity' }
          ],
          key: 'abilityChoice'
        };

      case 'moderately-armored':
        return {
          title: 'Choose Ability Increase',
          description: 'Select which ability score to increase by 1:',
          options: [
            { value: 'STR', label: 'Strength' },
            { value: 'DEX', label: 'Dexterity' }
          ],
          key: 'abilityChoice'
        };

      default:
        return null;
    }
  };

  const choiceConfig = getChoiceOptions();
  const defaultSelections = choiceConfig && choiceConfig.multiple
    ? { [choiceConfig.key]: [choiceConfig.options[0]?.value] }
    : { [choiceConfig?.key || '']: choiceConfig?.options[0]?.value };

  const [selections, setSelections] = useState<Record<string, string | string[]>>(defaultSelections as Record<string, string | string[]> || {});



  if (!isOpen || !feat || !choiceConfig) return null;

  const handleSelection = (key: string, value: string | string[]) => {
    setSelections(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    onConfirm(selections);
    setSelections({});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-theme-primary border border-theme-primary rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-accent-yellow-light">{choiceConfig.title}</h3>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-theme-tertiary mb-4">{choiceConfig.description}</p>

        <div className="space-y-2 mb-6">
          {choiceConfig.options.map(option => (
            <label key={option.value} className="flex items-center space-x-3">
              <input
                type={choiceConfig.multiple ? "checkbox" : "radio"}
                name={choiceConfig.key}
                value={option.value}
                checked={
                  choiceConfig.multiple
                    ? (selections[choiceConfig.key] || []).includes(option.value)
                    : selections[choiceConfig.key] === option.value
                }
                onChange={(e) => {
                  if (choiceConfig.multiple) {
                    const current = selections[choiceConfig.key] || [];
                    if (e.target.checked) {
                      if (current.length < (choiceConfig.maxSelect || Infinity)) {
                        handleSelection(choiceConfig.key, [...current, option.value]);
                      }
                    } else {
                      handleSelection(choiceConfig.key, (current as string[]).filter((v: string) => v !== option.value));
                    }
                  } else {
                    handleSelection(choiceConfig.key, option.value);
                  }
                }}
                className="text-accent-blue focus:ring-accent-blue"
              />
              <span className="text-sm text-theme-tertiary">{option.label}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-secondary text-theme-tertiary rounded-lg hover:bg-theme-quaternary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              choiceConfig.multiple
                ? !(selections[choiceConfig.key] && selections[choiceConfig.key].length === (choiceConfig.maxSelect || 0))
                : !selections[choiceConfig.key]
            }
            className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

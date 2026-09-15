import React from 'react';
import { X } from 'lucide-react';
import { AppSpell } from '../services/dataService';

interface SpellDetailsModalProps {
  spell: AppSpell | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
  isSelected: boolean;
  canSelect: boolean;
}

const SpellDetailsModal: React.FC<SpellDetailsModalProps> = ({
  spell,
  isOpen,
  onClose,
  onSelect,
  isSelected,
  canSelect
}) => {
  if (!isOpen || !spell) return null;

  // Format components for display
  const formatComponents = () => {
    const parts: string[] = [];
    if (spell.components.verbal) parts.push('V');
    if (spell.components.somatic) parts.push('S');
    if (spell.components.material) parts.push('M');

    let componentText = parts.join(', ');
    if (spell.components.material && spell.components.materialDescription) {
      componentText += ` (${spell.components.materialDescription})`;
    }

    return componentText;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-theme-primary rounded-lg shadow-2xl border border-theme-primary w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-purple-300">{spell.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-theme-tertiary rounded text-theme-tertiary">
                {spell.level === 0 ? 'Cantrip' : `${spell.level}${spell.level === 1 ? 'st' : spell.level === 2 ? 'nd' : spell.level === 3 ? 'rd' : 'th'} Level`}
              </span>
              <span className="text-xs px-2 py-1 bg-theme-tertiary rounded text-theme-tertiary">
                {spell.school}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-600 rounded-lg transition-colors ml-2"
            title="Close modal"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Spell Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-theme-secondary rounded p-3">
              <div className="text-xs text-theme-muted mb-1">Casting Time</div>
              <div className="text-sm text-purple-200 font-medium">{spell.castingTime}</div>
            </div>
            <div className="bg-theme-secondary rounded p-3">
              <div className="text-xs text-theme-muted mb-1">Range</div>
              <div className="text-sm text-purple-200 font-medium">{spell.range}</div>
            </div>
            <div className="bg-theme-secondary rounded p-3">
              <div className="text-xs text-theme-muted mb-1">Components</div>
              <div className="text-sm text-purple-200 font-medium">{formatComponents()}</div>
            </div>
            <div className="bg-theme-secondary rounded p-3">
              <div className="text-xs text-theme-muted mb-1">Duration</div>
              <div className="text-sm text-purple-200 font-medium">{spell.duration}</div>
            </div>
          </div>

          {/* Special Properties */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1 rounded-full ${
                spell.concentration
                  ? 'bg-yellow-900 text-yellow-200'
                  : 'bg-theme-secondary text-theme-muted'
              }`}>
                {spell.concentration ? '🧠 Concentration' : 'No Concentration'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1 rounded-full ${
                spell.ritual
                  ? 'bg-blue-900 text-blue-200'
                  : 'bg-theme-secondary text-theme-muted'
              }`}>
                {spell.ritual ? '📖 Ritual' : 'No Ritual'}
              </span>
            </div>
          </div>

          {/* Full Description */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-theme-tertiary mb-2">Description</h3>
            <div className="bg-theme-secondary rounded p-4">
              <p className="text-sm text-theme-tertiary leading-relaxed">
                {spell.description}
              </p>
            </div>
          </div>

          {/* At Higher Levels */}
          {spell.atHigherLevels && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-theme-tertiary mb-2">At Higher Levels</h3>
              <div className="bg-theme-secondary rounded p-4 border-l-4 border-accent-purple">
                <p className="text-sm text-purple-200">
                  {spell.atHigherLevels}
                </p>
              </div>
            </div>
          )}

          {/* Damage/Save Info */}
          {(spell.damageType || spell.saveType) && (
            <div className="flex items-center gap-6 text-sm">
              {spell.damageType && (
                <div className="flex items-center gap-2">
                  <span className="text-theme-tertiary">Damage:</span>
                  <span className="text-red-300 font-medium">{spell.damageType}</span>
                </div>
              )}
              {spell.saveType && (
                <div className="flex items-center gap-2">
                  <span className="text-theme-tertiary">Save:</span>
                  <span className="text-orange-300 font-medium">{spell.saveType}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Select Button */}
        <div className="flex justify-end p-6 border-t border-theme-primary">
          <button
            onClick={onSelect}
            disabled={!canSelect && !isSelected}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isSelected
                ? 'bg-green-600 text-white cursor-default'
                : canSelect
                ? 'bg-accent-purple hover:bg-accent-purple-light text-white shadow-lg'
                : 'bg-theme-secondary text-theme-muted cursor-not-allowed'
            }`}
          >
            {isSelected ? 'Selected' : canSelect ? 'Select Spell' : 'Cannot Select'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpellDetailsModal;
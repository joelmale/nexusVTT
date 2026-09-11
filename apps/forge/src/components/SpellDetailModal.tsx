import React from 'react';
import { X } from 'lucide-react';
import { AppSpell } from '../services/dataService';

interface SpellDetailModalProps {
  spell: AppSpell | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SpellDetailModal: React.FC<SpellDetailModalProps> = ({
  spell,
  isOpen,
  onClose
}) => {
  if (!isOpen || !spell) return null;

  const formatComponents = (components: AppSpell['components']) => {
    const parts = [];
    if (components.verbal) parts.push('V (Verbal)');
    if (components.somatic) parts.push('S (Somatic)');
    if (components.material) {
      parts.push('M (Material)');
      if (components.materialDescription) {
        parts[parts.length - 1] += ` (${components.materialDescription})`;
      }
    }
    return parts.length > 0 ? parts.join(', ') : 'None';
  };

  const formatClasses = (classes: string[]) => {
    // Group by edition if needed
    return classes.join(', ');
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <div>
            <h2 className="text-2xl font-bold text-theme-primary">{spell.name}</h2>
            <div className="text-sm text-theme-muted mt-1">
              {spell.level === 0 ? 'Cantrip' : `${spell.level}${spell.level === 1 ? 'st' : spell.level === 2 ? 'nd' : spell.level === 3 ? 'rd' : 'th'} Level`} {spell.school}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-4 text-sm">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold text-theme-primary">Casting Time:</span>
                <span className="ml-2 text-theme-tertiary">{spell.castingTime}</span>
              </div>
              <div>
                <span className="font-semibold text-theme-primary">Range:</span>
                <span className="ml-2 text-theme-tertiary">{spell.range}</span>
              </div>
              <div>
                <span className="font-semibold text-theme-primary">Duration:</span>
                <span className="ml-2 text-theme-tertiary">{spell.duration}</span>
              </div>
              <div>
                <span className="font-semibold text-theme-primary">School:</span>
                <span className="ml-2 text-theme-tertiary">{spell.school}</span>
              </div>
            </div>

            {/* Components */}
            <div>
              <span className="font-semibold text-theme-primary">Components:</span>
              <span className="ml-2 text-theme-tertiary">
                {spell.components ? formatComponents(spell.components) : 'None'}
              </span>
            </div>

            {/* Special Properties */}
            <div className="flex flex-wrap gap-2">
              {spell.concentration && (
                <span className="px-2 py-1 bg-orange-900/50 text-orange-300 text-xs rounded border border-orange-700">
                  Concentration
                </span>
              )}
              {spell.ritual && (
                <span className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded border border-purple-700">
                  Ritual
                </span>
              )}
              {spell.source && (
                <span className={`px-2 py-1 text-xs rounded border ${
                  spell.source === '2024'
                    ? 'bg-blue-900/50 text-blue-300 border-accent-blue-dark'
                    : 'bg-theme-tertiary/50 text-theme-tertiary border-theme-primary'
                }`}>
                  {spell.source}
                </span>
              )}
            </div>

            {/* Classes */}
            <div>
              <span className="font-semibold text-theme-primary">Classes:</span>
              <span className="ml-2 text-theme-tertiary">{formatClasses(spell.classes)}</span>
            </div>

            {/* Description */}
            <div className="border-t border-theme-primary pt-4">
              <div className="text-theme-tertiary leading-relaxed whitespace-pre-line">
                {spell.description}
              </div>
            </div>

            {/* Higher Levels */}
            {spell.atHigherLevels && (
              <div className="border-t border-theme-primary pt-4">
                <div className="font-semibold text-theme-primary mb-2">At Higher Levels:</div>
                <div className="text-theme-tertiary leading-relaxed whitespace-pre-line">
                  {spell.atHigherLevels}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
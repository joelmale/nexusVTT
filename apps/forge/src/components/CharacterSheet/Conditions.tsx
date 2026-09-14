import React, { useState } from 'react';
import { AlertTriangle, X, Plus, EyeOff, Heart, VolumeX, Zap, Hand, Ban, Ghost, Mountain, Skull, ArrowDown, Lock, Star, Moon } from 'lucide-react';
import { Character } from '../../types/dnd';

interface ConditionsProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
}

export const Conditions: React.FC<ConditionsProps> = ({
  character,
  onUpdateCharacter,
}) => {
  const [newCondition, setNewCondition] = useState('');

  // Common D&D 5e conditions
  const commonConditions = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled',
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned',
    'Prone', 'Restrained', 'Stunned', 'Unconscious'
  ];

  // Condition icons mapping
  const conditionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    'Blinded': EyeOff,
    'Charmed': Heart,
    'Deafened': VolumeX,
    'Frightened': AlertTriangle,
    'Grappled': Hand,
    'Incapacitated': Ban,
    'Invisible': Ghost,
    'Paralyzed': Zap,
    'Petrified': Mountain,
    'Poisoned': Skull,
    'Prone': ArrowDown,
    'Restrained': Lock,
    'Stunned': Star,
    'Unconscious': Moon
  };

  // Condition effects mapping
  const conditionEffects: Record<string, string> = {
    'Blinded': 'Cannot see, automatically fails checks requiring sight, attacks have disadvantage, attacks against you have advantage',
    'Charmed': 'Cannot attack charmer, charmer has advantage on social checks against you',
    'Deafened': 'Cannot hear, automatically fails checks requiring hearing',
    'Frightened': 'Disadvantage on ability checks and attack rolls while source of fear is in sight, cannot willingly move closer to source',
    'Grappled': 'Speed becomes 0, ends if grappler incapacitated or if you move out of reach',
    'Incapacitated': 'Cannot take actions or reactions',
    'Invisible': 'Cannot be seen, attacks have advantage, attacks against you have disadvantage',
    'Paralyzed': 'Cannot move or speak, automatically fails STR and DEX saves, attacks have advantage, auto-crit on hit',
    'Petrified': 'Transformed to stone, incapacitated, speed becomes 0, cannot speak, fails all saves',
    'Poisoned': 'Disadvantage on attack rolls and ability checks',
    'Prone': 'Can only crawl, disadvantage on attacks, attacks against you have advantage (melee) or disadvantage (ranged)',
    'Restrained': 'Speed becomes 0, disadvantage on attacks and DEX saves, attacks against you have advantage',
    'Stunned': 'Incapacitated, cannot move, can speak falteringly, automatically fails STR and DEX saves',
    'Unconscious': 'Incapacitated, unaware of surroundings, drops everything, falls prone, automatically fails STR and DEX saves'
  };

  const activeConditions = character.conditions || [];

  const addCondition = (condition: string) => {
    if (!condition.trim() || activeConditions.includes(condition)) return;

    const updatedCharacter = {
      ...character,
      conditions: [...activeConditions, condition]
    };

    onUpdateCharacter(updatedCharacter);
    setNewCondition('');
  };

  const removeCondition = (condition: string) => {
    const updatedCharacter = {
      ...character,
      conditions: activeConditions.filter(c => c !== condition)
    };

    onUpdateCharacter(updatedCharacter);
  };

  const addCustomCondition = () => {
    if (newCondition.trim()) {
      addCondition(newCondition.trim());
    }
  };

  return (
    <div className="bg-red-900 rounded-xl shadow-lg border-l-4 border-yellow-500 p-3">
      <h3 className="text-sm font-bold text-accent-yellow-light mb-2 flex items-center gap-2 uppercase tracking-wider font-cinzel">
        <AlertTriangle className="w-4 h-4" />
        Conditions
      </h3>

      {/* Active Conditions */}
      {activeConditions.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1 mb-2">
            {activeConditions.map((condition, index) => (
              <div
                key={index}
                className="flex items-center gap-1 px-2 py-0.5 bg-accent-red-darker/70 rounded-full text-xs text-theme-primary"
              >
                <span>{condition}</span>
                <button
                  onClick={() => removeCondition(condition)}
                  className="ml-0.5 hover:bg-accent-red-dark rounded-full p-0.5"
                  title={`Remove ${condition}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Condition */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newCondition}
            onChange={(e) => setNewCondition(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomCondition()}
            placeholder="Add custom condition"
            className="flex-1 px-3 py-2 input-handwritten focus:border-yellow-500"
          />
          <button
            onClick={addCustomCondition}
            className="px-2 py-2 bg-accent-yellow-dark hover:bg-accent-yellow rounded transition-colors flex items-center justify-center"
            title="Add condition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Common Conditions */}
        <div>
          <h4 className="text-sm font-semibold text-red-300 mb-2">Common Conditions:</h4>
          <div className="flex flex-wrap gap-2">
            {commonConditions
              .filter(condition => !activeConditions.includes(condition))
              .map((condition, index) => {
                const IconComponent = conditionIcons[condition];
                return (
                  <button
                    key={index}
                    onClick={() => addCondition(condition)}
                    className="flex items-center gap-1 px-2 py-1 bg-theme-secondary/50 hover:bg-accent-red-darker/70 rounded text-xs text-theme-tertiary hover:text-theme-primary transition-colors text-left"
                    title={`Add ${condition}`}
                  >
                    {IconComponent && <IconComponent className="w-3 h-3 flex-shrink-0" />}
                    <span className="truncate">{condition}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Condition Effects Summary */}
      <div className="mt-4 pt-4 border-t border-theme-primary">
        {activeConditions.length > 0 ? (
          <div className="space-y-2">
            {activeConditions.map((condition, index) => (
              <div key={index} className="text-xs text-theme-tertiary">
                <div className="font-semibold text-red-300 mb-1">{condition}:</div>
                <div className="text-theme-muted leading-relaxed">
                  {conditionEffects[condition] || 'Effect details not available'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-theme-muted text-center">
            Active conditions may affect ability checks, attacks, and movement
          </div>
        )}
      </div>
    </div>
  );
};
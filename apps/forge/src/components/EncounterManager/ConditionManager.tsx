import React, { useState } from 'react';
import { Condition, InitiativeEntry } from '../../types/encounterCombat';

// Predefined D&D 5e conditions
const PREDEFINED_CONDITIONS: Condition[] = [
  { name: 'Blinded', description: 'A blinded creature can\'t see and automatically fails any ability check that requires sight.', isCustom: false },
  { name: 'Charmed', description: 'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects.', isCustom: false },
  { name: 'Deafened', description: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.', isCustom: false },
  { name: 'Frightened', description: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.', isCustom: false },
  { name: 'Grappled', description: 'A grappled creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed.', isCustom: false },
  { name: 'Incapacitated', description: 'An incapacitated creature can\'t take actions or reactions.', isCustom: false },
  { name: 'Invisible', description: 'An invisible creature is impossible to see without the aid of magic or a special sense.', isCustom: false },
  { name: 'Paralyzed', description: 'A paralyzed creature is incapacitated and can\'t move or speak.', isCustom: false },
  { name: 'Petrified', description: 'A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance.', isCustom: false },
  { name: 'Poisoned', description: 'A poisoned creature has disadvantage on attack rolls and ability checks.', isCustom: false },
  { name: 'Prone', description: 'A prone creature\'s only movement option is to crawl, unless it stands up and thereby ends the condition.', isCustom: false },
  { name: 'Restrained', description: 'A restrained creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed.', isCustom: false },
  { name: 'Stunned', description: 'A stunned creature is incapacitated, can\'t move, and can speak only falteringly.', isCustom: false },
  { name: 'Unconscious', description: 'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings.', isCustom: false },
];

interface ConditionManagerProps {
  combatants: InitiativeEntry[];
  onAddCondition: (combatantId: string, condition: Condition) => void;
  onRemoveCondition: (combatantId: string, conditionName: string) => void;
}

export function ConditionManager({ combatants, onAddCondition, onRemoveCondition }: ConditionManagerProps) {
  const [selectedCombatant, setSelectedCombatant] = useState<string>('');
  const [showCustomCondition, setShowCustomCondition] = useState(false);
  const [customConditionName, setCustomConditionName] = useState('');
  const [customConditionDescription, setCustomConditionDescription] = useState('');

  const selectedEntry = combatants.find(c => c.id === selectedCombatant);

  const handleAddPredefinedCondition = (condition: Condition) => {
    if (!selectedEntry) return;

    // Check if condition already exists
    const existingCondition = selectedEntry.conditions.find(c => c.name === condition.name);
    if (existingCondition) return;

    onAddCondition(selectedEntry.id, condition);
  };

  const handleAddCustomCondition = () => {
    if (!selectedEntry || !customConditionName.trim()) return;

    const customCondition: Condition = {
      name: customConditionName.trim(),
      description: customConditionDescription.trim() || 'Custom condition',
      isCustom: true,
    };

    // Check if condition already exists
    const existingCondition = selectedEntry.conditions.find(c => c.name === customCondition.name);
    if (existingCondition) return;

    onAddCondition(selectedEntry.id, customCondition);
    setCustomConditionName('');
    setCustomConditionDescription('');
    setShowCustomCondition(false);
  };

  const handleRemoveCondition = (conditionName: string) => {
    if (!selectedEntry) return;
    onRemoveCondition(selectedEntry.id, conditionName);
  };

  return (
    <div className="condition-manager">
      <h3>Condition Manager</h3>

      {/* Combatant Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Combatant</label>
        <select
          value={selectedCombatant}
          onChange={(e) => setSelectedCombatant(e.target.value)}
          className="w-full p-2 bg-theme-secondary border border-theme-tertiary rounded"
        >
          <option value="">Choose a combatant...</option>
          {combatants.map(combatant => (
            <option key={combatant.id} value={combatant.id}>
              {combatant.name} ({combatant.conditions.length} conditions)
            </option>
          ))}
        </select>
      </div>

      {selectedEntry && (
        <>
          {/* Current Conditions */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Current Conditions</h4>
            {selectedEntry.conditions.length === 0 ? (
              <p className="text-theme-muted text-sm">No conditions applied</p>
            ) : (
              <div className="space-y-2">
                {selectedEntry.conditions.map((condition, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-theme-secondary rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{condition.name}</span>
                        {condition.isCustom && (
                          <span className="text-xs bg-accent-purple px-1 py-0.5 rounded text-white">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-theme-muted mt-1">{condition.description}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveCondition(condition.name)}
                      className="ml-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded"
                      title="Remove condition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Conditions */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Add Condition</h4>

            {/* Predefined Conditions */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PREDEFINED_CONDITIONS.map((condition) => {
                const hasCondition = selectedEntry.conditions.some(c => c.name === condition.name);
                return (
                  <button
                    key={condition.name}
                    onClick={() => handleAddPredefinedCondition(condition)}
                    disabled={hasCondition}
                    className={`p-2 text-left rounded transition-colors ${
                      hasCondition
                        ? 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
                        : 'bg-theme-secondary hover:bg-theme-tertiary text-white'
                    }`}
                    title={condition.description}
                  >
                    <div className="font-medium text-sm">{condition.name}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Condition Toggle */}
            <button
              onClick={() => setShowCustomCondition(!showCustomCondition)}
              className="w-full p-2 bg-accent-purple text-white rounded hover:bg-accent-purple-light transition-colors"
            >
              {showCustomCondition ? 'Cancel Custom Condition' : '+ Add Custom Condition'}
            </button>

            {/* Custom Condition Form */}
            {showCustomCondition && (
              <div className="mt-3 p-3 bg-theme-secondary rounded">
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Condition Name</label>
                  <input
                    type="text"
                    value={customConditionName}
                    onChange={(e) => setCustomConditionName(e.target.value)}
                    placeholder="Enter condition name..."
                    className="w-full p-2 bg-theme-tertiary border border-theme-muted rounded"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                  <textarea
                    value={customConditionDescription}
                    onChange={(e) => setCustomConditionDescription(e.target.value)}
                    placeholder="Describe the condition..."
                    rows={3}
                    className="w-full p-2 bg-theme-tertiary border border-theme-muted rounded resize-none"
                  />
                </div>
                <button
                  onClick={handleAddCustomCondition}
                  disabled={!customConditionName.trim()}
                  className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Custom Condition
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

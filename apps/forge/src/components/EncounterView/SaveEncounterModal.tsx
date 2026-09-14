import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMonsterContext } from '../../hooks';
import { log } from '../../utils/logger';

interface SaveEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onStartCombat?: () => void;
}

export const SaveEncounterModal: React.FC<SaveEncounterModalProps> = ({ isOpen, onClose, onSave, onStartCombat }) => {
  const { saveEncounter, selectedEncounterMonsters, allMonsters } = useMonsterContext();
  const [encounterName, setEncounterName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const totalMonsters = Object.values(selectedEncounterMonsters).reduce((sum, qty) => sum + qty, 0);
  const uniqueMonsters = Object.keys(selectedEncounterMonsters).length;

  const handleSave = async () => {
    if (!encounterName.trim()) {
      alert('Please enter a name for this encounter');
      return;
    }

    if (totalMonsters === 0) {
      alert('Please add at least one monster to this encounter');
      return;
    }

    setSaving(true);
    try {
      const success = await saveEncounter(encounterName.trim());
      if (success) {
        setEncounterName('');
        onSave();
      } else {
        alert('Failed to save encounter. Please try again.');
      }
    } catch (err) {
      log.error('Error saving encounter', { error: err, name: encounterName, totalMonsters });
      alert('Failed to save encounter. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setEncounterName('');
    onClose();
  };

  // Get monster names for preview
  const monsterNames = Object.keys(selectedEncounterMonsters).map((monsterId) => {
    const monster = allMonsters.find((m) => m.index === monsterId);
    const quantity = selectedEncounterMonsters[monsterId];
    return monster ? `${monster.name} x${quantity}` : null;
  }).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-theme-primary rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-red-900 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Save Encounter</h2>
          <button
            onClick={handleClose}
            className="p-2 bg-theme-secondary hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Encounter Name Input */}
          <div>
            <label className="block text-sm font-bold text-theme-tertiary mb-2">
              Encounter Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={encounterName}
              onChange={(e) => setEncounterName(e.target.value)}
              placeholder="e.g., Goblin Ambush, Dragon's Lair"
              className="w-full px-4 py-2 bg-theme-secondary border border-theme-secondary rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSave();
                }
              }}
            />
          </div>

          {/* Encounter Summary */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="font-bold text-accent-purple-light mb-3">Encounter Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-theme-muted">Total Monsters:</span>
                <span className="text-white font-bold">{totalMonsters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-theme-muted">Unique Types:</span>
                <span className="text-white font-bold">{uniqueMonsters}</span>
              </div>
            </div>
            <button
              className="bg-theme-secondary rounded-lg p-4 hover:bg-gray-750 transition-colors w-full mt-3 text-left"
              onClick={() => {
                onStartCombat?.();
                onClose();
              }}
            >
              <span className="text-accent-purple-light font-bold">⚔️ Start Combat</span>
              <p className="text-theme-muted text-sm">Launch the new encounter combat system</p>
            </button>
          </div>

          {/* Monster List Preview */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="font-bold text-accent-purple-light mb-3">Monsters in Encounter</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {monsterNames.map((name, index) => (
                <div key={index} className="text-sm text-theme-tertiary py-1 border-b border-theme-secondary last:border-0">
                  {name}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-theme-tertiary hover:bg-theme-quaternary text-white font-semibold rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-accent-green hover:bg-accent-green-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving || !encounterName.trim() || totalMonsters === 0}
            >
              {saving ? 'Saving...' : 'Save Encounter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

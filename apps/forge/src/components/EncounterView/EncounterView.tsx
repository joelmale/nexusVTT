import React, { useState } from 'react';
import { ArrowLeft, Save, Grid, List, Trash2 } from 'lucide-react';
import { Monster, UserMonster } from '../../types/dnd';
import { useMonsterContext } from '../../hooks';
import { EncounterGrid } from './EncounterGrid';
import { EncounterTabs } from './EncounterTabs';
import { SaveEncounterModal } from './SaveEncounterModal';

interface EncounterViewProps {
  onBack: () => void;
  onStartCombat?: () => void;
}

export const EncounterView: React.FC<EncounterViewProps> = ({ onBack, onStartCombat }) => {
  const {
    selectedEncounterMonsters,
    encounterViewMode,
    setEncounterViewMode,
    clearSelection,
    allMonsters,
  } = useMonsterContext();

  const [showSaveModal, setShowSaveModal] = useState(false);

  // Get actual monster objects from IDs
  const encounterMonsters: (Monster | UserMonster)[] = [];
  Object.entries(selectedEncounterMonsters).forEach(([monsterId, quantity]) => {
    const monster = allMonsters.find((m) => m.index === monsterId);
    if (monster) {
      // Add the monster multiple times based on quantity
      for (let i = 0; i < quantity; i++) {
        encounterMonsters.push(monster);
      }
    }
  });

  const totalMonsters = encounterMonsters.length;
  const uniqueMonsters = Object.keys(selectedEncounterMonsters).length;

  const handleClear = () => {
    if (window.confirm('Clear this encounter? This will remove all selected monsters.')) {
      clearSelection();
      onBack();
    }
  };

  if (totalMonsters === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🐉</div>
          <h2 className="text-2xl font-bold mb-2">No Monsters Selected</h2>
          <p className="text-theme-muted mb-6">Select monsters from the library to create an encounter</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-accent-purple hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 bg-theme-secondary hover:bg-theme-tertiary rounded-lg transition-colors"
              title="Back to library"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-4xl font-bold">Encounter</h1>
              <p className="text-theme-muted mt-1">
                {totalMonsters} monster{totalMonsters !== 1 ? 's' : ''}
                {uniqueMonsters !== totalMonsters && (
                  <span className="ml-1">({uniqueMonsters} unique)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-4 py-2 bg-accent-green hover:bg-accent-green-dark text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Encounter
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-accent-red hover:bg-accent-red-dark text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Clear
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="bg-theme-secondary rounded-lg p-1 inline-flex">
          <button
            onClick={() => setEncounterViewMode('grid')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              encounterViewMode === 'grid'
                ? 'bg-accent-purple text-white'
                : 'text-theme-muted hover:text-white'
            }`}
          >
            <Grid className="w-5 h-5" />
            Grid View
          </button>
          <button
            onClick={() => setEncounterViewMode('tabs')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              encounterViewMode === 'tabs'
                ? 'bg-accent-purple text-white'
                : 'text-theme-muted hover:text-white'
            }`}
          >
            <List className="w-5 h-5" />
            Tab View
          </button>
        </div>
      </div>

      {/* Encounter Content */}
      {encounterViewMode === 'grid' ? (
        <EncounterGrid monsters={encounterMonsters} />
      ) : (
        <EncounterTabs monsters={encounterMonsters} />
      )}

      {/* Save Encounter Modal */}
      <SaveEncounterModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={() => {
          setShowSaveModal(false);
          onBack();
        }}
        onStartCombat={onStartCombat}
      />
    </div>
  );
};

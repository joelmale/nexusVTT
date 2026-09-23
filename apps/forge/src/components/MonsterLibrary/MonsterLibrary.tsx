import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react';
import { useMonsterContext } from '../../hooks';
import { MonsterList } from './MonsterList';
import { MonsterFilters } from './MonsterFilters';
import { CreateMonsterModal } from './CreateMonsterModal';
import { SavedEncountersList } from './SavedEncountersList';
import { Monster, UserMonster } from '../../types/dnd';

interface MonsterLibraryProps {
  onSelectMonster: (monster: Monster | UserMonster) => void;
  onViewEncounter?: () => void;
  onStartCombat?: (encounterId: string) => void;
  // Controlled by the parent page shell, which must drop its own max-width
  // cap for this tab when widescreen is on -- this component's container
  // alone can't reach past that. Falls back to internal state when unset
  // (e.g. standalone usage) so the toggle still works.
  widescreen?: boolean;
  onWidescreenChange?: (widescreen: boolean) => void;
}

export const MonsterLibrary: React.FC<MonsterLibraryProps> = ({
  onSelectMonster,
  onViewEncounter,
  onStartCombat,
  widescreen: widescreenProp,
  onWidescreenChange,
}) => {
  const {
    filteredMonsters,
    loading,
    error,
    selectedEncounterMonsters,
    toggleMonsterSelection,
    setMonsterQuantity,
    clearSelection,
    encounters,
  } = useMonsterContext();

  const [selectionMode, setSelectionMode] = useState(false);
  const [internalWidescreen, setInternalWidescreen] = useState(false);
  const widescreen = widescreenProp ?? internalWidescreen;
  const setWidescreen = onWidescreenChange ?? setInternalWidescreen;
  const [showCreateMonster, setShowCreateMonster] = useState(false);
  const [editingMonster, setEditingMonster] = useState<UserMonster | null>(null);
  const [showSavedEncounters, setShowSavedEncounters] = useState(false);

  // Calculate total monsters selected (considering quantities)
  const totalMonstersSelected = Object.values(selectedEncounterMonsters).reduce(
    (sum, quantity) => sum + quantity,
    0
  );
  const uniqueMonstersSelected = Object.keys(selectedEncounterMonsters).length;

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      clearSelection();
    }
    setSelectionMode(!selectionMode);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🐉</div>
          <div className="text-xl">Loading Monster Library...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    // Widescreen drops the standard container's max-width cap so extra page
    // width -- not shrunken cards -- is what fits more of them per row.
    <div className={widescreen ? 'w-full px-4 py-8' : 'container mx-auto px-4 py-8'}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold text-theme-primary">Monster Library</h1>
            <p className="text-gray-600 mt-2">
              {filteredMonsters.length} monster{filteredMonsters.length !== 1 ? 's' : ''} available
            </p>
          </div>

          <div className="flex gap-3">
            {!selectionMode && (
              <button
                onClick={() => setShowCreateMonster(true)}
                className="px-4 py-2 bg-accent-green text-white rounded-lg hover:bg-accent-green-dark transition-colors"
              >
                + Create Custom Monster
              </button>
            )}

            <button
              onClick={() => setWidescreen(!widescreen)}
              title={widescreen ? 'Switch to 3 cards across' : 'Switch to 5 cards across (widescreen)'}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                widescreen
                  ? 'bg-accent-purple text-white hover:bg-purple-700'
                  : 'bg-theme-secondary text-theme-primary hover:bg-gray-750'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              {widescreen ? 'Widescreen (5)' : 'Standard (3)'}
            </button>

            <button
              onClick={handleToggleSelectionMode}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectionMode
                  ? 'bg-accent-red text-white hover:bg-accent-red-dark'
                  : 'bg-accent-blue text-white hover:bg-blue-700'
              }`}
            >
              {selectionMode ? 'Exit Selection Mode' : 'Select for Encounter'}
            </button>
          </div>
        </div>

        {selectionMode && (
          <div className="bg-theme-secondary border border-theme-primary rounded-lg p-4 flex justify-between items-center">
            <div>
              <span className="font-semibold text-theme-primary">
                {totalMonstersSelected} monster{totalMonstersSelected !== 1 ? 's' : ''} selected
                {uniqueMonstersSelected > 0 && uniqueMonstersSelected !== totalMonstersSelected && (
                  <span className="text-theme-muted ml-1">
                    ({uniqueMonstersSelected} unique)
                  </span>
                )}
              </span>
              {uniqueMonstersSelected > 0 && (
                <button
                  onClick={clearSelection}
                  className="ml-4 text-sm text-accent-blue hover:text-accent-blue-light underline transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>
            {uniqueMonstersSelected > 0 && onViewEncounter && (
              <button
                className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={onViewEncounter}
              >
                View Encounter →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Saved Encounters Section */}
      <div className="mb-6">
        <button
          onClick={() => setShowSavedEncounters(!showSavedEncounters)}
          className="w-full flex items-center justify-between p-4 bg-theme-secondary hover:bg-gray-750 rounded-lg transition-colors mb-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-theme-primary">Saved Encounters</span>
            <span className="px-2 py-0.5 bg-accent-purple text-white text-xs rounded-full">
              {encounters.length}
            </span>
          </div>
          {showSavedEncounters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {showSavedEncounters && (
          <div className="mb-4">
            <SavedEncountersList onStartCombat={onStartCombat} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <MonsterFilters />
      </div>

      {/* Monster List */}
      <MonsterList
        monsters={filteredMonsters}
        onSelectMonster={onSelectMonster}
        selectionMode={selectionMode}
        selectedMonsters={selectedEncounterMonsters}
        onToggleSelection={toggleMonsterSelection}
        onSetQuantity={setMonsterQuantity}
        widescreen={widescreen}
        onEditMonster={(monster) => {
          setEditingMonster(monster as UserMonster);
          setShowCreateMonster(true);
        }}
      />

      {/* Create/Edit Monster Modal */}
      <CreateMonsterModal
        isOpen={showCreateMonster || editingMonster !== null}
        onClose={() => {
          setShowCreateMonster(false);
          setEditingMonster(null);
        }}
        editingMonster={editingMonster}
      />

      {/* Floating selection toggle to avoid scrolling back to top */}
      <div className="fixed right-4 bottom-20 z-40 hidden lg:block">
        <button
          onClick={handleToggleSelectionMode}
          className={`px-4 py-3 rounded-full shadow-lg border transition-colors ${
            selectionMode
              ? 'bg-accent-red text-white border-accent-red-dark hover:bg-accent-red-dark'
              : 'bg-accent-blue text-white border-blue-700 hover:bg-blue-700'
          }`}
        >
          {selectionMode ? 'Exit Selection Mode' : 'Select for Encounter'}
        </button>
      </div>
    </div>
  );
};

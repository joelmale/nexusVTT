import React, { useState } from 'react';
import { InitiativeTracker } from '../InitiativeTracker';
import { PlayerImporter } from '../PlayerImporter';
import { PlayerEntry, InitiativeEntry } from '../../../types/encounterCombat';

interface TabletViewProps {
  // Combat state
  initiativeOrder: InitiativeEntry[];
  currentTurn: number;
  round: number;
  players: PlayerEntry[];
  isCombatActive: boolean;

  // Actions
  onReorderInitiative: (fromIndex: number, toIndex: number) => void;
  onUpdateInitiativeEntry: (id: string, updates: Partial<InitiativeEntry>) => void;
  onImportPlayers: (players: PlayerEntry[]) => void;
  onNextTurn: () => void;
  onPreviousTurn: () => void;
  onNewRound: () => void;
  onSaveCombat: () => void;
  onBack?: () => void;
}

export function TabletView({
  initiativeOrder,
  currentTurn,
  round,
  players,
  isCombatActive,
  onReorderInitiative,
  onUpdateInitiativeEntry,
  onImportPlayers,
  onNextTurn,
  onPreviousTurn,
  onNewRound,
  onSaveCombat,
  onBack,
}: TabletViewProps) {
  const [showPlayerImporter, setShowPlayerImporter] = useState(false);
  const [activeTab, setActiveTab] = useState<'initiative' | 'players'>('initiative');
  const activeEntry = initiativeOrder[currentTurn];

  const handleImportPlayers = (newPlayers: PlayerEntry[]) => {
    onImportPlayers(newPlayers);
    setShowPlayerImporter(false);
  };

  return (
    <div className="encounter-manager-tablet">
      <div className="encounter-hero compact">
        <div className="hero-copy">
          <p className="eyebrow">DM Console</p>
          <h1>Encounter Manager</h1>
          <p className="hint-text">Tap, swipe, or type to keep the turn order moving.</p>
        </div>
        <div className="hero-status" aria-live="polite">
          <div className="status-pill round">R {round}</div>
          {initiativeOrder.length > 0 && (
            <div className="status-pill turn">
              T {currentTurn + 1}/{initiativeOrder.length}
            </div>
          )}
          {activeEntry && (
            <div className="status-pill active">
              {activeEntry.name}
            </div>
          )}
          <div className="hero-actions">
            <button
              onClick={onSaveCombat}
              className="save-combat-btn"
              title="Save current combat state"
            >
              💾 Save
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="back-btn subtle"
                title="Back to Monster Library"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'initiative' ? 'active' : ''}`}
          onClick={() => setActiveTab('initiative')}
        >
          Initiative
        </button>
        <button
          className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
          onClick={() => setActiveTab('players')}
        >
          Players ({players.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'initiative' && (
          <div className="initiative-tab">
            <InitiativeTracker
              initiativeOrder={initiativeOrder}
              currentTurn={currentTurn}
              onReorder={onReorderInitiative}
              onUpdateEntry={onUpdateInitiativeEntry}
            />
          </div>
        )}

        {activeTab === 'players' && (
          <div className="players-tab">
            <div className="players-header">
              <h3>Players</h3>
              <button
                onClick={() => setShowPlayerImporter(true)}
                className="import-players-btn"
              >
                Import Players
              </button>
            </div>

            <div className="players-grid">
              {players.length === 0 ? (
                <div className="empty-players">
                  <p>No players imported yet.</p>
                  <p>Click "Import Players" to add characters from your sheets.</p>
                </div>
              ) : (
                players.map(player => (
                  <div key={player.characterId} className="player-card-compact">
                    <div className="player-name">{player.name}</div>
                    <div className="player-stats">
                      <span className="stat">AC {player.ac}</span>
                      <span className="stat">
                        {player.currentHp}/{player.maxHp} HP
                      </span>
                    </div>
                    {player.conditions.length > 0 && (
                      <div className="player-conditions">
                        {player.conditions.map((condition, idx) => (
                          <span key={idx} className="condition-badge" title={condition.description}>
                            {condition.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shortcut-hint" aria-live="polite">
        Swipe left/right: Turn • Space/Enter: Next • ⇧+␣: Previous • R: New Round • S: Save
      </div>

      {/* Combat Controls - Always visible */}
      <div className="combat-controls-bar">
        <button
          onClick={onPreviousTurn}
          disabled={!isCombatActive}
          className="combat-btn prev-turn"
        >
          ⬅️ Prev
        </button>
        <button
          onClick={onNextTurn}
          disabled={!isCombatActive}
          className="combat-btn next-turn"
        >
          Next ➡️
        </button>
        <button
          onClick={onNewRound}
          disabled={!isCombatActive}
          className="combat-btn new-round"
        >
          New Round
        </button>
      </div>

      {/* Player Importer Modal */}
      {showPlayerImporter && (
        <div className="modal-overlay">
          <div className="modal-content player-importer-modal">
            <div className="modal-header">
              <h2>Import Players</h2>
              <button
                onClick={() => setShowPlayerImporter(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>
            <PlayerImporter
              onImportPlayers={handleImportPlayers}
              existingPlayers={players}
            />
          </div>
        </div>
      )}
    </div>
  );
}

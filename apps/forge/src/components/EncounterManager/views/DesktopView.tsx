import React, { useState } from 'react';
import { InitiativeTracker } from '../InitiativeTracker';
import { PlayerImporter } from '../PlayerImporter';
import { PlayerEntry, InitiativeEntry } from '../../../types/encounterCombat';

interface DesktopViewProps {
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

export function DesktopView({
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
}: DesktopViewProps) {
  const [showPlayerImporter, setShowPlayerImporter] = useState(false);
  const activeEntry = initiativeOrder[currentTurn];

  const handleImportPlayers = (newPlayers: PlayerEntry[]) => {
    onImportPlayers(newPlayers);
    setShowPlayerImporter(false);
  };

  return (
    <div className="encounter-manager-desktop">
      <div className="encounter-hero">
        <div className="hero-copy">
          <p className="eyebrow">Dungeon Master Console</p>
          <h1>Encounter Manager</h1>
          <p className="hint-text">Run rounds, track HP, and keep the table flowing with keyboard and touch controls.</p>
          {onBack && (
            <button
              onClick={onBack}
              className="back-btn subtle"
              title="Back to Monster Library"
            >
              ← Back to Library
            </button>
          )}
        </div>
        <div className="hero-status" aria-live="polite">
          <div className="status-pill round">Round {round}</div>
          {initiativeOrder.length > 0 && (
            <div className="status-pill turn">
              Turn {currentTurn + 1} / {initiativeOrder.length}
            </div>
          )}
          {activeEntry && (
            <div className="status-pill active">
              Active: <span className="status-strong">{activeEntry.name}</span>
            </div>
          )}
          <div className="hero-actions">
            <button
              onClick={onSaveCombat}
              className="save-combat-btn"
              title="Save current combat state"
            >
              💾 Save Combat
            </button>
            <button
              onClick={onNewRound}
              disabled={!isCombatActive}
              className="pill-btn"
              title="Start a fresh round"
            >
              New Round
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="encounter-content">
        {/* Left Panel - Initiative Tracker */}
        <div className="initiative-panel">
          <InitiativeTracker
            initiativeOrder={initiativeOrder}
            currentTurn={currentTurn}
            onReorder={onReorderInitiative}
            onUpdateEntry={onUpdateInitiativeEntry}
          />
        </div>

        {/* Right Panel - Combat Details */}
        <div className="combat-details-panel">
          {/* Players Section */}
          <div className="players-section">
            <div className="section-header">
              <h3>Players ({players.length})</h3>
              <button
                onClick={() => setShowPlayerImporter(true)}
                className="import-players-btn"
              >
                Import Players
              </button>
            </div>

            <div className="players-list">
              {players.length === 0 ? (
                <div className="empty-players">
                  <p>No players imported yet.</p>
                  <p>Click "Import Players" to add characters from your sheets.</p>
                </div>
              ) : (
                players.map(player => (
                  <div key={player.characterId} className="player-card">
                    <div className="player-header">
                      <div className="player-name">{player.name}</div>
                      <div className="player-ac">AC {player.ac}</div>
                    </div>
                    <div className="player-hp">
                      <span className="hp-current">{player.currentHp}</span>
                      <span className="hp-separator">/</span>
                      <span className="hp-max">{player.maxHp}</span>
                      <span className="hp-label">HP</span>
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

          {/* Combat Controls */}
          <div className="combat-controls-section">
            <h3>Combat Controls</h3>
            <div className="combat-buttons">
              <button
                onClick={onPreviousTurn}
                disabled={!isCombatActive}
                className="combat-btn prev-turn"
              >
                ⬅️ Previous Turn
              </button>
              <button
                onClick={onNextTurn}
                disabled={!isCombatActive}
                className="combat-btn next-turn"
              >
                Next Turn ➡️
              </button>
              <button
                onClick={onNewRound}
                disabled={!isCombatActive}
                className="combat-btn new-round"
              >
                New Round 🔄
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="shortcut-hint" aria-live="polite">
        ␣/Enter: Next • ⇧+␣: Previous • R: New Round • S: Save • {onBack ? 'Esc: Back to Library' : 'Esc: Close'}
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

import React, { useState } from 'react';
import { InitiativeTracker } from '../InitiativeTracker';
import { PlayerImporter } from '../PlayerImporter';
import { PlayerEntry, InitiativeEntry } from '../../../types/encounterCombat';

interface MobileViewProps {
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

export function MobileView({
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
}: MobileViewProps) {
  const [showPlayerImporter, setShowPlayerImporter] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && isCombatActive) {
      onNextTurn();
    }
    if (isRightSwipe && isCombatActive) {
      onPreviousTurn();
    }
  };

  const handleImportPlayers = (newPlayers: PlayerEntry[]) => {
    onImportPlayers(newPlayers);
    setShowPlayerImporter(false);
  };

  const currentEntry = initiativeOrder[currentTurn];

  return (
    <div className="encounter-manager-mobile">
      {/* Header */}
      <div className="encounter-header">
        <h1>Encounter Manager</h1>
        <div className="combat-summary" aria-live="polite">
          <div className="round-turn">
            Round {round}
            {currentEntry && <span>, Turn {currentTurn + 1}</span>}
          </div>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="menu-btn"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Menu Overlay */}
      {showMenu && (
        <div className="menu-overlay">
          <div className="menu-content">
            {onBack && (
              <button
                onClick={() => {
                  onBack();
                  setShowMenu(false);
                }}
                className="menu-item back"
              >
                ← Back to Library
              </button>
            )}
            <button
              onClick={() => setShowPlayerImporter(true)}
              className="menu-item"
            >
              Import Players
            </button>
            <button
              onClick={onSaveCombat}
              className="menu-item"
            >
              💾 Save Combat
            </button>
            <button
              onClick={() => setShowMenu(false)}
              className="menu-item close"
            >
              Close Menu
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Initiative Tracker */}
      <div
        className="mobile-content"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="swipe-hint">
          {isCombatActive && (
            <small className="text-theme-muted">
              Swipe left/right to change turns
            </small>
          )}
        </div>
        <InitiativeTracker
          initiativeOrder={initiativeOrder}
          currentTurn={currentTurn}
          onReorder={onReorderInitiative}
          onUpdateEntry={onUpdateInitiativeEntry}
        />
      </div>

      {/* Combat Controls - Fixed at bottom */}
      <div className="mobile-controls">
        <button
          onClick={onPreviousTurn}
          disabled={!isCombatActive}
          className="control-btn prev"
        >
          ⬅️
        </button>
        <div className="current-turn-display">
          {currentEntry ? (
            <div className="current-combatant">
              <div className="combatant-name">{currentEntry.name}</div>
              <div className="combatant-hp">
                {currentEntry.currentHp}/{currentEntry.maxHp} HP
              </div>
            </div>
          ) : (
            <div className="no-combatant">No active combatant</div>
          )}
        </div>
        <button
          onClick={onNextTurn}
          disabled={!isCombatActive}
          className="control-btn next"
        >
          ➡️
        </button>
      </div>

      {/* Quick Actions Bar */}
      <div className="quick-actions">
        <button
          onClick={onNewRound}
          disabled={!isCombatActive}
          className="quick-btn"
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

import React, { useState, useMemo } from 'react';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import type { Character } from '@/types/character';
import { CharacterSheetPopup } from './CharacterSheetPopup';
import { useCharacterCreationLauncher } from '@/hooks';
import './CharacterSelectionModal.css';

interface CharacterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (character: Character | null, joinAsSpectator: boolean) => void;
  campaignId?: string;
  campaignName?: string;
}

export const CharacterSelectionModal: React.FC<CharacterSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  campaignId,
  campaignName,
}) => {
  const { user } = useGameStore();
  const { characters } = useCharacterStore();
  const { startCharacterCreation, LauncherComponent } = useCharacterCreationLauncher();

  // Filter characters for current user
  const userCharacters = useMemo(() => {
    return characters.filter((c) => c.playerId === user.id);
  }, [characters, user.id]);

  // Get last-used character for this campaign from localStorage
  const getLastUsedCharacter = (): string | null => {
    try {
      const key = `nexus-campaign-${campaignId}-last-character`;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    () => {
      // Try to restore last-used character
      const lastUsed = getLastUsedCharacter();
      if (lastUsed && userCharacters.some((c) => c.id === lastUsed)) {
        return lastUsed;
      }
      // Default to first character if available
      return userCharacters.length > 0 ? userCharacters[0].id : null;
    }
  );
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  const [viewingCharacter, setViewingCharacter] = useState<Character | null>(null);
  const [creatingCharacter, setCreatingCharacter] = useState(false);

  const selectedCharacter = userCharacters.find((c) => c.id === selectedCharacterId);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 Character selection state:', {
      selectedCharacterId,
      selectedCharacterName: selectedCharacter?.name,
      joinAsSpectator,
      totalCharacters: userCharacters.length,
    });
  }, [selectedCharacterId, selectedCharacter, joinAsSpectator, userCharacters.length]);

  const handleContinue = () => {
    console.log('🎯 Continue clicked:', {
      selectedCharacterId,
      selectedCharacter: selectedCharacter?.name,
      joinAsSpectator,
    });

    // Save selected character to localStorage for next time
    if (selectedCharacterId && campaignId) {
      try {
        const key = `nexus-campaign-${campaignId}-last-character`;
        localStorage.setItem(key, selectedCharacterId);
      } catch (error) {
        console.warn('Failed to save character preference:', error);
      }
    }

    onSelect(
      joinAsSpectator ? null : selectedCharacter || null,
      joinAsSpectator
    );
  };

  const handleCreateCharacter = () => {
    setCreatingCharacter(true);
    startCharacterCreation(
      user.id,
      'modal',
      (characterId: string) => {
        setCreatingCharacter(false);
        setSelectedCharacterId(characterId);
        setJoinAsSpectator(false);
      },
      () => {
        setCreatingCharacter(false);
      }
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="character-selection-modal-overlay" onClick={onClose}>
        <div
          className="character-selection-modal glass-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2>🎭 Select Character</h2>
            {campaignName && (
              <p className="campaign-name">Joining: {campaignName}</p>
            )}
            {/* Debug: Show current selection */}
            <p className="campaign-name" style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
              Selected: {joinAsSpectator ? 'Spectator' : selectedCharacter?.name || 'None'}
            </p>
            <button
              className="modal-close"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="modal-content">
            {userCharacters.length === 0 ? (
              <div className="no-characters">
                <p>📝 You don't have any characters yet.</p>
                <p className="hint">Create a character to join this campaign, or join as a spectator.</p>
              </div>
            ) : (
              <div className="characters-list">
                {userCharacters.map((character) => {
                  const primaryClass = character.classes[0];
                  const isSelected = selectedCharacterId === character.id && !joinAsSpectator;

                  return (
                    <div
                      key={character.id}
                      className={`character-option ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        console.log('🎭 Character selected:', character.name, character.id);
                        setSelectedCharacterId(character.id);
                        setJoinAsSpectator(false);
                      }}
                    >
                      <div className="character-radio">
                        <input
                          type="radio"
                          name="character"
                          value={character.id}
                          checked={isSelected}
                          readOnly
                        />
                      </div>

                      <div className="character-portrait">
                        {primaryClass?.name.charAt(0) || '?'}
                      </div>

                      <div className="character-info">
                        <div className="character-name">{character.name}</div>
                        <div className="character-details">
                          Level {character.level} {character.race.name}
                          {character.race.subrace && ` (${character.race.subrace})`}{' '}
                          {primaryClass?.name || 'Adventurer'}
                        </div>
                        <div className="character-stats">
                          <span title="Hit Points">❤️ {character.hitPoints.current}/{character.hitPoints.maximum}</span>
                          <span title="Armor Class">🛡️ {character.armorClass}</span>
                        </div>
                      </div>

                      <button
                        className="view-sheet-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingCharacter(character);
                        }}
                        title="View character sheet"
                      >
                        📋
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="glass-button secondary"
                onClick={handleCreateCharacter}
              >
                ➕ Create New Character
              </button>

              <div
                className={`spectator-option ${joinAsSpectator ? 'selected' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  console.log('👁️ Spectator mode selected');
                  setJoinAsSpectator(true);
                  setSelectedCharacterId(null);
                }}
              >
                <input
                  type="radio"
                  name="character"
                  value="spectator"
                  checked={joinAsSpectator}
                  readOnly
                />
                <div className="spectator-info">
                  <span className="spectator-label">👁️ Join as Spectator</span>
                  <span className="spectator-hint">Watch without a character</span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              className="glass-button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="glass-button primary"
              onClick={handleContinue}
              disabled={!joinAsSpectator && !selectedCharacter}
            >
              {joinAsSpectator
                ? 'Continue as Spectator'
                : selectedCharacter
                ? `Continue with ${selectedCharacter.name}`
                : 'Select a Character'}
            </button>
          </div>
        </div>
      </div>

      {/* Character sheet popup */}
      {viewingCharacter && (
        <CharacterSheetPopup
          character={viewingCharacter}
          isOpen={true}
          onClose={() => setViewingCharacter(null)}
        />
      )}

      {/* Character creation launcher */}
      {creatingCharacter && LauncherComponent}
    </>
  );
};

import React, { useState } from 'react';
import { useCharacterContext } from '../../hooks/useCharacterContext';
import { Character } from '../../types/dnd';
import { PlayerEntry } from '../../types/encounterCombat';

interface PlayerImporterProps {
  onImportPlayers: (players: PlayerEntry[]) => void;
  existingPlayers: PlayerEntry[];
}

export function PlayerImporter({ onImportPlayers, existingPlayers }: PlayerImporterProps) {
  const { characters, loading, error, loadCharacters } = useCharacterContext();
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleCharacterToggle = (characterId: string) => {
    const newSelected = new Set(selectedCharacters);
    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else {
      newSelected.add(characterId);
    }
    setSelectedCharacters(newSelected);
  };

  const handleImport = () => {
    const playersToImport: PlayerEntry[] = [];
    selectedCharacters.forEach(characterId => {
      const character = characters.find(c => c.id === characterId);
      if (character) {
        // Check if already imported
        const alreadyImported = existingPlayers.some(p => p.characterId === characterId);
        if (!alreadyImported) {
          playersToImport.push({
            characterId: character.id,
            name: character.name,
            initiative: character.initiative,
            ac: character.armorClass,
            currentHp: character.hitPoints,
            maxHp: character.maxHitPoints,
            conditions: [],
          });
        }
      }
    });

    if (playersToImport.length > 0) {
      onImportPlayers(playersToImport);
      setSelectedCharacters(new Set());
    }
  };

  const isCharacterAlreadyImported = (characterId: string) => {
    return existingPlayers.some(p => p.characterId === characterId);
  };

  if (loading) {
    return <div className="player-importer-loading">Loading characters...</div>;
  }

  if (error) {
    return <div className="player-importer-error">Error loading characters: {error}</div>;
  }

  return (
    <div className="player-importer">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Character Vault</p>
          <h3>Import Players</h3>
        </div>
        <p className="hint-text">Tap cards to select; we only pull name, AC, HP, and initiative.</p>
      </div>

      <div className="character-grid">
        {characters.map((character: Character) => {
          const alreadyImported = isCharacterAlreadyImported(character.id);
          const isSelected = selectedCharacters.has(character.id);

          return (
            <button
              key={character.id}
              type="button"
              className={`character-card ${isSelected ? 'selected' : ''} ${alreadyImported ? 'disabled' : ''}`}
              onClick={() => !alreadyImported && handleCharacterToggle(character.id)}
              disabled={alreadyImported}
            >
              <div className="card-top">
                <div className="character-name">{character.name}</div>
                <span className="level-chip">Lv {character.level} {character.class}</span>
              </div>
              <div className="character-meta">
                <span className="meta-chip">AC {character.armorClass}</span>
                <span className="meta-chip">HP {character.hitPoints}/{character.maxHitPoints}</span>
                <span className="meta-chip">Init {character.initiative ?? '—'}</span>
              </div>
              {alreadyImported && <div className="already-imported">Already in combat</div>}
              {isSelected && <div className="selected-indicator">Selected</div>}
            </button>
          );
        })}
      </div>

      <div className="import-actions">
        <button
          onClick={handleImport}
          disabled={selectedCharacters.size === 0}
          className="cta-button"
        >
          Import Selected Players ({selectedCharacters.size})
        </button>
      </div>
    </div>
  );
}

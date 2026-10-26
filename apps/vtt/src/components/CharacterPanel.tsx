import React, { useState, useMemo, useContext } from 'react';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { CharacterCard } from './CharacterCard';
import { CharacterImportModal } from './CharacterImportModal';
import { CharacterClaimModal } from './simple-player/CharacterClaimModal';
import { CharacterCreationContext } from './CharacterCreationContext';
import { sendPlayerIntent } from '@/services/playerIntentClient';
import './CharacterPanel.css';

type FilterType = 'all' | 'in-combat' | 'not-in-combat' | 'has-token';

export const CharacterPanel: React.FC = () => {
  const characters = useCharacterStore((s) => s.characters);
  const session = useGameStore((s) => s.session);
  const scenes = useGameStore((s) => s.sceneState.scenes);
  const initiativeEntries = useInitiativeStore((s) => s.entries);
  const isHost = useGameStore((s) => s.user.type === 'host');
  const user = useGameStore((s) => s.user);
  const [importOpen, setImportOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const creationContext = useContext(CharacterCreationContext);
  const startCharacterCreation = creationContext?.startCharacterCreation;
  const LauncherComponent = creationContext?.LauncherComponent;

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Current user's characters and unclaimed characters in the room
  const myCharacters = useMemo(
    () => characters.filter((c) => c.playerId === user.id),
    [characters, user.id],
  );
  const unclaimedCharacters = useMemo(
    () => characters.filter((c) => !c.playerId),
    [characters],
  );

  const handleStartCreate = () => {
    if (!startCharacterCreation) return;
    startCharacterCreation(user.id, 'modal', (characterId) => {
      useCharacterStore.getState().setActiveCharacter(characterId);
    });
  };

  // Session players' characters, plus (for the DM) unclaimed party
  // characters waiting for a player to pick them.
  const sessionCharacters = useMemo(() => {
    if (!session) return [];
    const playerIds = session.players.map((p) => p.id);
    return characters.filter((c) =>
      c.playerId ? playerIds.includes(c.playerId) : isHost,
    );
  }, [characters, session, isHost]);

  // Enrich with token/initiative data
  const enrichedCharacters = useMemo(() => {
    const allTokens = scenes.flatMap((s) => s.placedTokens || []);
    return sessionCharacters.map((char) => ({
      character: char,
      token: allTokens.find((t) => t.characterId === char.id),
      initiativeEntry: initiativeEntries.find((e) => e.characterId === char.id),
    }));
  }, [sessionCharacters, scenes, initiativeEntries]);

  // Apply filters
  const filteredCharacters = useMemo(() => {
    let result = enrichedCharacters;

    // Apply type filter
    switch (filter) {
      case 'in-combat':
        result = result.filter((ec) => ec.initiativeEntry);
        break;
      case 'not-in-combat':
        result = result.filter((ec) => !ec.initiativeEntry);
        break;
      case 'has-token':
        result = result.filter((ec) => ec.token);
        break;
      default:
        // 'all' - no filtering
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((ec) =>
        ec.character.name.toLowerCase().includes(lowerQuery),
      );
    }

    return result;
  }, [enrichedCharacters, filter, searchQuery]);

  if (!session) {
    return (
      <div className="character-panel">
        <div className="character-panel-empty">
          <p>Not in a session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="character-panel">
      {/* Header */}
      <div className="character-panel-header">
        <h2>Characters</h2>
        <span className="character-count">{filteredCharacters.length}</span>
        {isHost ? (
          <button
            type="button"
            className="filter-btn"
            onClick={() => setImportOpen(true)}
            title="Import party characters players can claim"
          >
            📥 Import
          </button>
        ) : (
          <button
            type="button"
            className="filter-btn create-btn"
            onClick={handleStartCreate}
            title="Create a new character"
          >
            ➕ Create
          </button>
        )}
      </div>
      {isHost && (
        <CharacterImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          unassigned
        />
      )}

      {/* Search */}
      <div className="character-search">
        <input
          type="text"
          placeholder="Search characters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Filters */}
      <div className="character-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${filter === 'in-combat' ? 'active' : ''}`}
          onClick={() => setFilter('in-combat')}
        >
          In Combat
        </button>
        <button
          className={`filter-btn ${filter === 'not-in-combat' ? 'active' : ''}`}
          onClick={() => setFilter('not-in-combat')}
        >
          Not in Combat
        </button>
        <button
          className={`filter-btn ${filter === 'has-token' ? 'active' : ''}`}
          onClick={() => setFilter('has-token')}
        >
          Has Token
        </button>
      </div>

      {/* Character List */}
      <div className="character-list">
        {filteredCharacters.length === 0 ? (
          <div className="character-panel-empty">
            {searchQuery ? (
              <>
                <p>No characters found</p>
                <p className="hint">Try adjusting your search</p>
              </>
            ) : !isHost && myCharacters.length === 0 ? (
              <div className="character-panel-onboarding">
                <p className="onboarding-title">No Character Assigned</p>
                <p className="hint">
                  You don't have an active character in this game yet.
                </p>
                <div className="onboarding-actions">
                  <button
                    type="button"
                    className="action-button primary-action"
                    onClick={handleStartCreate}
                  >
                    ➕ Create a Character
                  </button>
                  {unclaimedCharacters.length > 0 && (
                    <button
                      type="button"
                      className="action-button secondary-action"
                      onClick={() => setClaimOpen(true)}
                    >
                      Select Existing Character
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p>No characters found</p>
            )}
          </div>
        ) : (
          filteredCharacters.map((ec) => (
            <CharacterCard
              key={ec.character.id}
              character={ec.character}
              token={ec.token}
              initiativeEntry={ec.initiativeEntry}
            />
          ))
        )}
      </div>
      {claimOpen && (
        <CharacterClaimModal
          characters={characters}
          userId={user.id}
          onClaim={async (characterId) => {
            const result = await sendPlayerIntent({
              kind: 'claim-character',
              characterId,
            });
            if (result.status === 'applied') {
              useCharacterStore.getState().setActiveCharacter(characterId);
            }
            return result;
          }}
          onCreateNew={() => {
            setClaimOpen(false);
            handleStartCreate();
          }}
          onClose={() => setClaimOpen(false)}
        />
      )}
      {LauncherComponent}
    </div>
  );
};

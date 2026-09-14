import React, { useState, useMemo } from 'react';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { CharacterCard } from './CharacterCard';
import './CharacterPanel.css';

type FilterType = 'all' | 'in-combat' | 'not-in-combat' | 'has-token';

export const CharacterPanel: React.FC = () => {
  const characters = useCharacterStore((s) => s.characters);
  const session = useGameStore((s) => s.session);
  const scenes = useGameStore((s) => s.sceneState.scenes);
  const initiativeEntries = useInitiativeStore((s) => s.entries);

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter to session players ONLY
  const sessionCharacters = useMemo(() => {
    if (!session) return [];
    const playerIds = session.players.map((p) => p.id);
    return characters.filter(
      (c) => c.playerId && playerIds.includes(c.playerId),
    );
  }, [characters, session]);

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
      </div>

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
            <p>No characters found</p>
            {searchQuery && <p className="hint">Try adjusting your search</p>}
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
    </div>
  );
};

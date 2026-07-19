import React, { useState } from 'react';
import './CharacterManager.css';

interface CharacterData {
  race?: string;
  class?: string;
  level?: number;
  portrait?: string;
  [key: string]: unknown;
}

interface Character {
  id: string;
  name: string;
  ownerId: string;
  data: CharacterData;
  createdAt: string;
  updatedAt: string;
}

interface CharacterManagerProps {
  character?: Character;
  onClose: () => void;
  onSave: (character: Character) => void;
}

/**
 * CharacterManager modal for creating and editing characters
 * @component
 * @param {CharacterManagerProps} props - Component props
 * @returns {JSX.Element} Character manager modal
 */
export const CharacterManager: React.FC<CharacterManagerProps> = ({
  character,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(character?.name || '');
  const [race, setRace] = useState(character?.data.race || '');
  const [characterClass, setCharacterClass] = useState(
    character?.data.class || '',
  );
  const [level, setLevel] = useState(character?.data.level || 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!character;

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Character name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const characterData = {
        name: name.trim(),
        data: {
          race: race.trim() || undefined,
          class: characterClass.trim() || undefined,
          level: level || 1,
        },
      };

      const url = isEditing
        ? `/api/characters/${character.id}`
        : '/api/characters';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(characterData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save character');
      }

      const savedCharacter = isEditing
        ? { ...character, ...characterData }
        : await response.json();

      onSave(savedCharacter);
      onClose();
    } catch (err) {
      console.error('Error saving character:', err);
      setError(err instanceof Error ? err.message : 'Failed to save character');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Character' : 'Create New Character'}</h2>
          <button className="modal-close" onClick={onClose} disabled={saving}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <div className="input-group">
              <label htmlFor="characterName">Character Name *</label>
              <div className="glass-input-wrapper">
                <input
                  id="characterName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter character name"
                  className="glass-input"
                  disabled={saving}
                  maxLength={255}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="characterRace">Race</label>
              <div className="glass-input-wrapper">
                <input
                  id="characterRace"
                  type="text"
                  value={race}
                  onChange={(e) => setRace(e.target.value)}
                  placeholder="e.g., Human, Elf, Dwarf"
                  className="glass-input"
                  disabled={saving}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="characterClass">Class</label>
              <div className="glass-input-wrapper">
                <input
                  id="characterClass"
                  type="text"
                  value={characterClass}
                  onChange={(e) => setCharacterClass(e.target.value)}
                  placeholder="e.g., Fighter, Wizard, Rogue"
                  className="glass-input"
                  disabled={saving}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="characterLevel">Level</label>
              <div className="glass-input-wrapper">
                <input
                  id="characterLevel"
                  type="number"
                  value={level}
                  onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
                  placeholder="1"
                  className="glass-input"
                  disabled={saving}
                  min={1}
                  max={20}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="action-btn glass-button secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-btn glass-button primary"
              disabled={!name.trim() || saving}
            >
              {saving ? (
                <>
                  <span className="loading-spinner"></span>
                  Saving...
                </>
              ) : (
                <>
                  <span>✨</span>
                  {isEditing ? 'Save Changes' : 'Create Character'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

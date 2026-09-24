import React from 'react';
import type { PanelComponentProps } from '@/services/panelRegistry';
import { useCharacterStore } from '@/stores/characterStore';
import { CharacterSheet } from '@/components/CharacterSheet';

export const CharacterPanel: React.FC<PanelComponentProps> = ({ link }) => {
  const characters = useCharacterStore((state) => state.characters);
  const character = characters.find((c) => c.id === link.id);

  if (!character) {
    return (
      <div
        data-testid="character-panel-missing"
        style={{
          padding: '20px',
          color: 'var(--text-secondary, #94a3b8)',
          textAlign: 'center',
        }}
      >
        Character not found.
      </div>
    );
  }

  return (
    <div
      data-testid="character-panel-content"
      style={{
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <CharacterSheet character={character} />
    </div>
  );
};

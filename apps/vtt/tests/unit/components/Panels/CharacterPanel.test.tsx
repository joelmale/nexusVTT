import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CharacterPanel } from '../../../../src/components/Panels/CharacterPanel';
import { registerDefaultPanels } from '../../../../src/components/Panels/registerPanels';
import { panelRegistry, ObjectLink } from '../../../../src/services/panelRegistry';
import { useCharacterStore } from '../../../../src/stores/characterStore';
import type { Character } from '@nexus/character-contracts';

// Mock CharacterSheet to keep test focused and fast
vi.mock('../../../../src/components/CharacterSheet', () => ({
  CharacterSheet: ({ character }: { character: Character }) => (
    <div data-testid="mock-character-sheet">{character.name} Sheet</div>
  ),
}));

describe('CharacterPanel & registerPanels', () => {
  const mockCharacter: Character = {
    id: 'char-42',
    name: 'Elminster',
    level: 10,
    class: 'Wizard',
    race: 'Human',
    hitPoints: 50,
    maxHitPoints: 50,
    armorClass: 14,
    speed: 30,
    abilities: {
      STR: { score: 10, modifier: 0 },
      DEX: { score: 14, modifier: 2 },
      CON: { score: 14, modifier: 2 },
      INT: { score: 20, modifier: 5 },
      WIS: { score: 16, modifier: 3 },
      CHA: { score: 12, modifier: 1 },
    },
    inventory: [],
    skills: {},
  };

  beforeEach(() => {
    useCharacterStore.setState({
      characters: [mockCharacter],
    });
  });

  it('renders character sheet when character is present in character store', () => {
    const link: ObjectLink = {
      kind: 'character',
      id: 'char-42',
      title: 'Elminster',
    };

    render(
      <CharacterPanel
        link={link}
        onClose={vi.fn()}
        isPopout={false}
      />
    );

    expect(screen.getByTestId('character-panel-content')).toBeInTheDocument();
    expect(screen.getByTestId('mock-character-sheet')).toHaveTextContent('Elminster Sheet');
  });

  it('renders not found placeholder when character is not in store', () => {
    const link: ObjectLink = {
      kind: 'character',
      id: 'char-unknown',
      title: 'Ghost',
    };

    render(
      <CharacterPanel
        link={link}
        onClose={vi.fn()}
        isPopout={false}
      />
    );

    expect(screen.getByTestId('character-panel-missing')).toBeInTheDocument();
    expect(screen.getByText('Character not found.')).toBeInTheDocument();
  });

  it('registerDefaultPanels registers character, monster, and encounter panels with panelRegistry', () => {
    registerDefaultPanels();

    const charDef = panelRegistry.getDefinition('character');
    expect(charDef).toBeDefined();
    expect(charDef?.kind).toBe('character');
    expect(charDef?.title({ kind: 'character', id: '1', title: 'Astarion' })).toBe('Astarion');
    expect(charDef?.title({ kind: 'character', id: '2' })).toBe('Character Sheet');

    const monsterDef = panelRegistry.getDefinition('monster');
    expect(monsterDef).toBeDefined();
    expect(monsterDef?.kind).toBe('monster');
    expect(monsterDef?.title({ kind: 'monster', id: 'm1', title: 'Goblin Boss' })).toBe('Goblin Boss');

    const encounterDef = panelRegistry.getDefinition('encounter');
    expect(encounterDef).toBeDefined();
    expect(encounterDef?.kind).toBe('encounter');
    expect(encounterDef?.title({ kind: 'encounter', id: 'e1', title: 'Forest Ambush' })).toBe('Forest Ambush');

    // Calling again is idempotent
    registerDefaultPanels();
    expect(panelRegistry.getDefinition('character')).toBeDefined();
  });
});

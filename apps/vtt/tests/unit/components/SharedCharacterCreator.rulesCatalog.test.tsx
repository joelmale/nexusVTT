/**
 * SharedCharacterCreator records the rules catalog version that was live at
 * creation time (apps/docs/codex/rules-registry.md, "Runtime consumption").
 * This is the VTT host's responsibility, not the character-creator
 * package's -- see CLAUDE.md "Shared character creation" -- so it is
 * exercised here rather than in the package's own test suite.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';

const mocks = vi.hoisted(() => ({
  onComplete: vi.fn(),
  saveCreatedCharacter: vi.fn(),
  createdCharacterToNexus: vi.fn(),
  getRulesCatalogVersion: vi.fn(),
}));

vi.mock('@nexus/character-creator', () => ({
  CharacterCreator: ({ onComplete }: { onComplete: (result: unknown) => void }) => {
    // Fire immediately, like a player finishing the real wizard's last step.
    React.useEffect(() => {
      onComplete({ character: { name: 'Test Hero' } });
    }, [onComplete]);
    return null;
  },
  createdCharacterToNexus: mocks.createdCharacterToNexus,
}));
vi.mock('@nexus/character-creator/styles.css', () => ({}));

vi.mock('@/stores/characterStore', () => ({
  useCharacterCreation: () => ({ saveCreatedCharacter: mocks.saveCreatedCharacter }),
}));

vi.mock('@/stores/gameStore', () => ({
  useTheme: () => 'dark',
}));

vi.mock('@/services/rulesCatalogClient', () => ({
  getRulesCatalogVersion: mocks.getRulesCatalogVersion,
}));

import { SharedCharacterCreator } from '@/components/SharedCharacterCreator';

describe('SharedCharacterCreator rules catalog recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createdCharacterToNexus.mockReturnValue({ name: 'Test Hero' } as Character);
    mocks.saveCreatedCharacter.mockResolvedValue('char-1');
  });

  it('records the resolved catalog version on the saved character', async () => {
    mocks.getRulesCatalogVersion.mockResolvedValue(7);

    render(
      <SharedCharacterCreator playerId="player-1" onComplete={mocks.onComplete} onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.saveCreatedCharacter).toHaveBeenCalled());

    expect(mocks.saveCreatedCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Hero', rulesCatalogVersion: 7 }),
    );
    expect(mocks.onComplete).toHaveBeenCalledWith('char-1', expect.objectContaining({ rulesCatalogVersion: 7 }));
  });

  it('records null (bundled SRD only) when the catalog is unreachable, without blocking the save', async () => {
    mocks.getRulesCatalogVersion.mockResolvedValue(null);

    render(
      <SharedCharacterCreator playerId="player-1" onComplete={mocks.onComplete} onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.saveCreatedCharacter).toHaveBeenCalled());

    expect(mocks.saveCreatedCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ rulesCatalogVersion: null }),
    );
  });
});

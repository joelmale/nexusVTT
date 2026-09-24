import React, { useCallback } from 'react';
import {
  CharacterCreator,
  createdCharacterToNexus,
  type CharacterCreationResult,
  type CreationMode,
} from '@nexus/character-creator';
import '@nexus/character-creator/styles.css';
import type { Character } from '@nexus/character-contracts';
import { useCharacterCreation } from '@/stores/characterStore';
import { useTheme } from '@/stores/gameStore';
import { getRulesCatalogVersion } from '@/services/rulesCatalogClient';

/**
 * Explicit theme boundary between the VTT's theme setting and the creator's
 * own palette. The creator never reads VTT tokens and the VTT never inherits
 * the creator's; the only thing that crosses is this resolved name.
 */
const resolveCreatorTheme = (theme: 'auto' | 'dark' | 'light'): string => {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark-colorful';
  const prefersLight =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'dark-colorful';
};

interface SharedCharacterCreatorProps {
  playerId: string;
  onComplete: (characterId: string, character?: Character) => void;
  onCancel: () => void;
  /** Kept for launch-context parity; the shared creator is always modal. */
  isModal?: boolean;
  /**
   * Which door opens first. Defaults to the guided flow — a player arriving at
   * "I need to build a character" should not have to meet point-buy first.
   */
  initialMode?: CreationMode;
}

/**
 * Nexus VTT's host binding for the shared character creator.
 *
 * The creator owns the rules and the UI; this component owns everything the
 * creator deliberately does not: ownership, account persistence, local cache
 * and the VTT's completion/cancellation contract.
 *
 * Errors thrown here propagate back into the wizard, which shows them inline
 * and stays open with the player's answers intact.
 */
export const SharedCharacterCreator: React.FC<SharedCharacterCreatorProps> = ({
  playerId,
  onComplete,
  onCancel,
  initialMode = 'guided',
}) => {
  const { saveCreatedCharacter } = useCharacterCreation();
  const theme = useTheme();

  const handleComplete = useCallback(
    async (result: CharacterCreationResult) => {
      // One conversion implementation, shared with the Forge JSON import path.
      const character = createdCharacterToNexus(result.character, {
        playerId,
      });

      // Record which published rules catalog was live at creation time (host
      // responsibility -- the creator package owns no persistence). Never
      // blocks on Codex: bundled SRD content is always sufficient to create
      // a character, so a slow/offline catalog degrades to `null` here.
      character.rulesCatalogVersion = await getRulesCatalogVersion();

      const characterId = await saveCreatedCharacter(character);
      onComplete(characterId, character);
    },
    [playerId, saveCreatedCharacter, onComplete],
  );

  return (
    // `edition` is intentionally omitted: the creator falls back to its own
    // configured default (2024, the current ruleset), matching Forge. The VTT
    // has no ruleset picker yet, so hard-coding one here would silently force
    // players onto a ruleset they did not choose.
    <CharacterCreator
      isOpen
      initialMode={initialMode}
      allowModeSwitch
      theme={resolveCreatorTheme(theme)}
      onCancel={onCancel}
      onComplete={handleComplete}
    />
  );
};

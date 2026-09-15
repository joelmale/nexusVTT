import React, { useEffect, useState } from 'react';
import type {
  CharacterCreationCompleteHandler,
  Edition,
} from '../api/types';
import { CharacterCreationWizard } from './CharacterCreationWizard';
import { GuidedCharacterCreator } from './guided/GuidedCharacterCreator';

/**
 * The two doors into character creation.
 *
 * - `guided` asks about temperament and playstyle and derives the rules.
 * - `full` is the fourteen-step wizard with every choice exposed.
 *
 * Both produce the same `CharacterCreationResult`, so switching between them is
 * a presentation choice, not a data one.
 */
export type CreationMode = 'guided' | 'full';

export interface CharacterCreatorProps {
  isOpen: boolean;
  edition?: Edition;
  /** Written to `data-theme` on the creator root — the explicit theme boundary. */
  theme?: string;
  /**
   * Which door opens first. Defaults to `guided`: a new player should not have
   * to predict which flow they want before seeing either of them.
   */
  initialMode?: CreationMode;
  /**
   * Whether the player can switch doors mid-flow. Hosts that present their own
   * chooser up front (Nexus Forge) pass `false` and drive the mode themselves.
   */
  allowModeSwitch?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onComplete: CharacterCreationCompleteHandler;
}

/**
 * Host-facing entry point for character creation.
 *
 * This is the component applications should render. It owns which door is open
 * and lets the player move between them without losing the session, so the
 * guided flow is an on-ramp rather than a dead end.
 */
export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  isOpen,
  edition,
  theme,
  initialMode = 'guided',
  allowModeSwitch = true,
  submitLabel,
  onCancel,
  onComplete,
}) => {
  const [mode, setMode] = useState<CreationMode>(initialMode);

  // Reopening returns to the host's preferred door rather than wherever the
  // player happened to leave off last time.
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  if (mode === 'guided') {
    return (
      <GuidedCharacterCreator
        isOpen
        edition={edition}
        theme={theme}
        onCancel={onCancel}
        onComplete={onComplete}
        onSwitchToFullWizard={
          allowModeSwitch ? () => setMode('full') : undefined
        }
      />
    );
  }

  return (
    <CharacterCreationWizard
      isOpen
      edition={edition}
      theme={theme}
      submitLabel={submitLabel}
      onCancel={onCancel}
      onComplete={onComplete}
    />
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CharacterCreationCompleteHandler, Edition } from '../api/types';
import { resolveCreatorTheme } from '../api/theme';
import { CharacterCreationWizard } from './CharacterCreationWizard';
import { GuidedCharacterCreator } from './guided/GuidedCharacterCreator';
import {
  CreationSessionContext,
  useCreationSession,
} from '../hooks/useCreationSession';

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

import type { CreationDraft, CreatorPresentation } from '../types/draft';

export interface CharacterCreatorProps {
  isOpen: boolean;
  edition?: Edition;
  /**
   * Host theme name. Resolved to `parchment` (default) or `dark` and written
   * to `data-theme` on the creator root — the explicit theme boundary.
   */
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
  /** Initial draft to resume from (CC-501). */
  initialDraft?: CreationDraft;
  initialPresentation?: CreatorPresentation;
  onPresentationChange?: (presentation: CreatorPresentation) => void;
  /** Callback fired whenever the draft updates (CC-501). */
  onDraftChange?: (draft: CreationDraft) => void;
  /** Callback fired when the player discards the draft (CC-501). */
  onDraftDiscard?: () => void;
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
  initialDraft,
  initialPresentation,
  onPresentationChange,
  onDraftChange,
  onDraftDiscard,
  submitLabel,
  onCancel,
  onComplete,
}) => {
  const session = useCreationSession({ initialDraft, edition, onDraftChange });
  // Hosts pass their own theme names; the creator only knows two.
  const creatorTheme = resolveCreatorTheme(theme);
  const [mode, setMode] = useState<CreationMode>(
    initialPresentation?.mode || initialMode,
  );
  const [presentation, setPresentation] = useState<CreatorPresentation>(
    initialPresentation ?? { mode: initialMode },
  );
  const latestPresentation = useRef(presentation);
  const reportPresentation = useCallback(
    (next: CreatorPresentation) => {
      const previous = latestPresentation.current;
      const flow = next.guidedFlow ?? previous.guidedFlow ?? 'four-screen';
      const key =
        next.mode === 'full' ? 'full' : flow === 'quiz' ? 'quiz' : 'fourScreen';
      const step = next.step ?? previous.positions?.[key] ?? 0;
      const merged = {
        ...previous,
        ...next,
        guidedFlow: flow,
        step,
        positions: { ...previous.positions, [key]: step },
      };
      latestPresentation.current = merged;
      setPresentation(merged);
      setMode(next.mode);
      onPresentationChange?.(merged);
    },
    [onPresentationChange],
  );

  // Reopening returns to the host's preferred door rather than wherever the
  // player happened to leave off last time.
  useEffect(() => {
    if (isOpen) setMode(initialPresentation?.mode || initialMode);
  }, [isOpen, initialMode, initialPresentation?.mode]);

  if (!isOpen) return null;

  if (mode === 'guided') {
    return (
      <CreationSessionContext.Provider value={session}>
        <GuidedCharacterCreator
          isOpen
          edition={edition}
          theme={creatorTheme}
          initialDraft={initialDraft}
          initialPresentation={{
            ...presentation,
            mode: 'guided',
            step:
              presentation.positions?.[
                presentation.guidedFlow === 'quiz' ? 'quiz' : 'fourScreen'
              ] ?? presentation.step,
          }}
          onPresentationChange={reportPresentation}
          onDraftChange={onDraftChange}
          onDraftDiscard={onDraftDiscard}
          onCancel={onCancel}
          onComplete={onComplete}
          onSwitchToFullWizard={
            allowModeSwitch
              ? () => {
                  reportPresentation({ mode: 'full' });
                }
              : undefined
          }
        />
      </CreationSessionContext.Provider>
    );
  }

  return (
    <CreationSessionContext.Provider value={session}>
      <CharacterCreationWizard
        isOpen
        edition={edition}
        theme={creatorTheme}
        initialDraft={initialDraft}
        initialPresentation={{
          ...presentation,
          mode: 'full',
          step:
            presentation.positions?.full ??
            (presentation.mode === 'full' ? presentation.step : 0),
        }}
        onPresentationChange={reportPresentation}
        onDraftChange={onDraftChange}
        onDraftDiscard={onDraftDiscard}
        submitLabel={submitLabel}
        onCancel={onCancel}
        onSwitchToGuided={
          allowModeSwitch
            ? () => reportPresentation({ mode: 'guided' })
            : undefined
        }
        onComplete={onComplete}
      />
    </CreationSessionContext.Provider>
  );
};

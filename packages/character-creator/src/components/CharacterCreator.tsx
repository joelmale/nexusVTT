import React, { useCallback, useRef, useState } from 'react';
import type { CharacterCreationCompleteHandler, Edition } from '../api/types';
import { resolveCreatorTheme } from '../api/theme';
import { CharacterCreationWizard } from './CharacterCreationWizard';
import {
  CreationSessionContext,
  useCreationSession,
} from '../hooks/useCreationSession';

/**
 * There is one creator. `full` is that creator; `guided` is kept so hosts and
 * saved drafts that still say it keep working, and opens the same creator. The
 * "recommended picks" lane lives on its first step.
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
   * @deprecated There is one creator now; `guided` and `full` open the same
   * flow. Kept so existing hosts and saved drafts keep working.
   */
  initialMode?: CreationMode;
  /** @deprecated There is one creator now; this has no effect. */
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
  /** Show the live character sheet beside the full wizard. Off by default. */
  showLiveSheet?: boolean;
  onCancel: () => void;
  onComplete: CharacterCreationCompleteHandler;
}

/**
 * Host-facing entry point for character creation.
 *
 * This is the component applications should render. Hosts own persistence; the
 * creator owns the single flow, including the recommended-picks lane.
 */
export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  isOpen,
  edition,
  theme,
  initialMode = 'guided',
  initialDraft,
  initialPresentation,
  onPresentationChange,
  onDraftChange,
  onDraftDiscard,
  submitLabel,
  showLiveSheet,
  onCancel,
  onComplete,
}) => {
  const session = useCreationSession({ initialDraft, edition, onDraftChange });
  // Hosts pass their own theme names; the creator only knows two.
  const creatorTheme = resolveCreatorTheme(theme);
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
      onPresentationChange?.(merged);
    },
    [onPresentationChange],
  );

  if (!isOpen) return null;

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
        showLiveSheet={showLiveSheet}
        onCancel={onCancel}
        onComplete={onComplete}
      />
    </CreationSessionContext.Provider>
  );
};

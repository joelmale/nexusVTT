import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  creationDataToDraft,
  draftToCreationData,
} from '../adapters/draftAdapter';
import { initialCreationData } from '../components/CharacterCreationWizard/constants/wizard.constants';
import type { CharacterCreationData } from '../types/dnd';
import type { CreationDraft, DraftProvenance } from '../types/draft';

export interface CreationSession {
  draft: CreationDraft;
  data: CharacterCreationData;
  updateData: (
    updates: Partial<CharacterCreationData>,
    provenance?: DraftProvenance,
  ) => void;
  replaceRecommended: (draft: CreationDraft) => void;
}

export const CreationSessionContext = createContext<CreationSession | null>(
  null,
);

export function updateCreationDraft(
  draft: CreationDraft,
  updates: Partial<CharacterCreationData>,
  provenance: DraftProvenance = 'player',
): CreationDraft {
  const current = draftToCreationData(draft);
  // Mechanical changes resolve from authored selections; narrative edits retain the exact loadout.
  const mechanical = [
    'classSlug',
    'background',
    'edition',
    'equipmentChoices',
    'equipmentChoice',
    'equipmentGold',
  ].some((key) => key in updates);
  const data = { ...current, ...updates };
  if (mechanical && !('startingInventory' in updates)) {
    data.loadoutResolved = false;
    data.startingInventory = undefined;
    data.currency = undefined;
    data.equipmentChoices =
      updates.equipmentChoices || draft.creationData?.equipmentChoices || [];
  }
  const next = creationDataToDraft(data, {
    draftId: draft.draftId,
    characterId: draft.characterId,
    attemptId: draft.attemptId,
    revision: (draft.revision || 0) + 1,
    provenance,
  });
  if (
    !mechanical &&
    !('startingInventory' in updates) &&
    !('currency' in updates)
  ) {
    next.loadout = draft.loadout;
    next.creationData = { ...(draft.creationData ?? current), ...updates };
  }
  next.provenance = {
    ...draft.provenance,
    ...Object.fromEntries(Object.keys(updates).map((key) => [key, provenance])),
  };
  next.allowedSources = draft.allowedSources;
  return next;
}

export function useCreationSession(options: {
  initialDraft?: CreationDraft;
  edition?: '2014' | '2024';
  onDraftChange?: (draft: CreationDraft) => void;
}): CreationSession {
  const inherited = useContext(CreationSessionContext);
  const [draft, setDraft] = useState(
    () =>
      options.initialDraft ||
      creationDataToDraft(
        {
          ...initialCreationData,
          edition: options.edition || initialCreationData.edition,
        },
        { provenance: 'recommended' },
      ),
  );
  useEffect(() => {
    if (!inherited) options.onDraftChange?.(draft);
  }, [draft, inherited, options.onDraftChange]);
  const updateData = useCallback(
    (
      updates: Partial<CharacterCreationData>,
      provenance: DraftProvenance = 'player',
    ) =>
      setDraft((current) => updateCreationDraft(current, updates, provenance)),
    [],
  );
  const replaceRecommended = useCallback(
    (recommended: CreationDraft) =>
      setDraft((current) => {
        const data = draftToCreationData(recommended);
        const previous = draftToCreationData(current);
        const explicit = Object.entries(current.provenance)
          .filter(([, provenance]) => provenance === 'player')
          .map(([key]) => key);
        for (const key of explicit)
          if (key in previous)
            Object.assign(data, {
              [key]: previous[key as keyof CharacterCreationData],
            });
        const next = creationDataToDraft(data, {
          draftId: current.draftId,
          characterId: current.characterId,
          attemptId: current.attemptId,
          revision: (current.revision || 0) + 1,
          provenance: 'recommended',
        });
        next.provenance = {
          ...recommended.provenance,
          ...Object.fromEntries(
            explicit.map((key) => [key, 'player' as const]),
          ),
        };
        next.allowedSources = current.allowedSources;
        return next;
      }),
    [],
  );
  const local = useMemo(
    () => ({
      draft,
      data: draftToCreationData(draft),
      updateData,
      replaceRecommended,
    }),
    [draft, updateData, replaceRecommended],
  );
  return inherited || local;
}

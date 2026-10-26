import { useCallback, useEffect, useRef, useState } from 'react';
import {
  decodeDraftRecord,
  encodeDraftRecord,
  type CreationDraft,
  type CharacterCreationResult,
  type CreatorPresentation,
} from '@nexus/character-creator';

interface StoredDraft {
  id: string;
  value: string;
  revision: number;
  clientTabId: string;
}
export interface CreatorDraftRepository {
  getCreatorDraft(id: string): Promise<StoredDraft | undefined>;
  saveCreatorDraft(
    record: StoredDraft,
    expectedRevision: number,
  ): Promise<void>;
  deleteCreatorDraft(id: string, expectedRevision: number): Promise<void>;
}

/** Host-owned recovery: serialized writes use transaction-level revision checks. */
export function useCreatorRecovery(
  repository: CreatorDraftRepository,
  key: string,
) {
  const [phase, setPhase] = useState<'loading' | 'recover' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string>();
  const [initialDraft, setInitialDraft] = useState<CreationDraft>();
  const [initialPresentation, setInitialPresentation] =
    useState<CreatorPresentation>();
  const [recovery, setRecovery] =
    useState<ReturnType<typeof decodeDraftRecord>>();
  const current = useRef<StoredDraft | undefined>(undefined);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const latestDraft = useRef<CreationDraft | undefined>(undefined);
  const latestPresentation = useRef<CreatorPresentation | undefined>(undefined);
  const blocked = useRef(false);
  const frozenCompletion = useRef<CharacterCreationResult | undefined>(
    undefined,
  );
  const loadGeneration = useRef(0);
  const clientId = useRef(crypto.randomUUID());

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      await pending.current;
      const record = await repository.getCreatorDraft(key);
      if (generation !== loadGeneration.current) return;
      current.current = record;
      blocked.current = false;
      setError(undefined);
      if (record) {
        const decoded = decodeDraftRecord(record.value);
        frozenCompletion.current =
          decoded.status === 'ok'
            ? decoded.record.pendingCompletion
            : undefined;
        setRecovery(decoded);
        setPhase('recover');
      } else {
        latestDraft.current = undefined;
        frozenCompletion.current = undefined;
        setRecovery(undefined);
        setInitialDraft(undefined);
        setInitialPresentation(undefined);
        setPhase('ready');
      }
    } catch (caught) {
      if (generation !== loadGeneration.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not read creation recovery data.',
      );
      setPhase('error');
    }
  }, [repository, key]);

  useEffect(() => {
    // IndexedDB is the external source; setters run after the storage request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [load]);

  const reload = useCallback(() => {
    setPhase('loading');
    return load();
  }, [load]);

  const resume = useCallback(() => {
    if (recovery?.status !== 'ok') return;
    latestDraft.current = recovery.record.draft;
    latestPresentation.current = recovery.record.presentation;
    setInitialDraft(recovery.record.draft);
    setInitialPresentation(recovery.record.presentation);
    setPhase('ready');
  }, [recovery]);

  const persist = useCallback(() => {
    if (!latestDraft.current || blocked.current) return;
    const value = encodeDraftRecord({
      draft: latestDraft.current,
      pendingCompletion: frozenCompletion.current,
      presentation: latestPresentation.current,
      clientTabId: clientId.current,
    });
    pending.current = pending.current
      .then(async () => {
        if (blocked.current) return;
        const revision = current.current?.revision ?? 0;
        const record = {
          id: key,
          value,
          revision: revision + 1,
          clientTabId: clientId.current,
        };
        await repository.saveCreatorDraft(record, revision);
        current.current = record;
      })
      .catch((caught: unknown) => {
        blocked.current = true;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Draft could not be saved.',
        );
      });
  }, [repository, key]);

  const onDraftChange = useCallback(
    (draft: CreationDraft) => {
      latestDraft.current = draft;
      persist();
    },
    [persist],
  );

  const onPresentationChange = useCallback(
    (presentation: CreatorPresentation) => {
      latestPresentation.current = presentation;
      persist();
    },
    [persist],
  );

  const flush = useCallback(async () => {
    await pending.current;
    if (blocked.current)
      throw new Error(
        'Draft could not be saved. Export your work or reload the stored draft before leaving.',
      );
  }, []);

  const freezeCompletion = useCallback(
    async (result: CharacterCreationResult) => {
      await pending.current;
      if (blocked.current)
        throw new Error(
          'Save recovery is blocked. Export your work and review the stored draft.',
        );
      if (frozenCompletion.current) return frozenCompletion.current;
      if (!latestDraft.current)
        throw new Error('The creation draft is not ready to save.');
      frozenCompletion.current = structuredClone(result);
      persist();
      await pending.current;
      if (blocked.current)
        throw new Error(
          'The pending save could not be stored. Your character has not been submitted.',
        );
      return frozenCompletion.current;
    },
    [persist],
  );

  const discard = useCallback(async () => {
    try {
      await pending.current;
      await repository.deleteCreatorDraft(key, current.current?.revision ?? 0);
      current.current = undefined;
      latestDraft.current = undefined;
      frozenCompletion.current = undefined;
      latestPresentation.current = undefined;
      blocked.current = false;
      setInitialDraft(undefined);
      setInitialPresentation(undefined);
      setRecovery(undefined);
      setError(undefined);
      setPhase('ready');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not discard this draft.',
      );
    }
  }, [repository, key]);

  const exportDraft = useCallback(() => {
    const value = latestDraft.current
      ? encodeDraftRecord({
          draft: latestDraft.current,
          pendingCompletion: frozenCompletion.current,
          presentation: latestPresentation.current,
        })
      : current.current?.value;
    if (!value) return;
    const url = URL.createObjectURL(
      new Blob([value], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nexus-character-draft.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    phase,
    error,
    recovery,
    initialDraft,
    initialPresentation,
    resume,
    discard,
    exportDraft,
    reload,
    onDraftChange,
    onPresentationChange,
    flush,
    freezeCompletion,
  };
}

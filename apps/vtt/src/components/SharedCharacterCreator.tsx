import React, { useEffect, useRef, useState } from 'react';
import {
  CharacterCreator,
  createdCharacterToNexus,
  type CharacterCreationResult,
  type CreationMode,
  resolveRequestedEdition,
  useCreatorRecovery,
} from '@nexus/character-creator';
import '@nexus/character-creator/styles.css';
import type { Character } from '@nexus/character-contracts';
import { handoffSavedCharacter } from '@/services/characterHandoff';
import { creatorDefaultMode } from '@/services/creatorCapabilities';
import { getRulesCatalogVersion } from '@/services/rulesCatalogClient';
import { storageWorkerClient } from '@/services/storageWorkerClient';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore, useTheme } from '@/stores/gameStore';
import { toast } from '@/utils/notifications';
import styles from './SharedCharacterCreator.module.css';

interface SharedCharacterCreatorProps {
  playerId: string;
  onComplete: (
    characterId: string,
    character?: Character,
  ) => void | Promise<void>;
  onCancel: () => void;
  isModal?: boolean;
  initialMode?: CreationMode;
}

const repository = {
  getCreatorDraft: async (key: string) => {
    const stored = await storageWorkerClient.getCreatorDraft(key);
    if (stored) return stored;
    // Import the previous browser-local envelope without deleting its original.
    try {
      const legacyPlayer = decodeURIComponent(key.split(':')[1] || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      const value = localStorage.getItem(`nexus_draft_vtt_${legacyPlayer}`);
      return value
        ? { id: key, value, revision: 0, clientTabId: 'legacy-import' }
        : undefined;
    } catch {
      return undefined;
    }
  },
  saveCreatorDraft:
    storageWorkerClient.saveCreatorDraft.bind(storageWorkerClient),
  deleteCreatorDraft: async (key: string, revision: number) => {
    await storageWorkerClient.deleteCreatorDraft(key, revision);
    try {
      const legacyPlayer = decodeURIComponent(key.split(':')[1] || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      localStorage.removeItem(`nexus_draft_vtt_${legacyPlayer}`);
    } catch {
      /* Worker-backed removal is authoritative. */
    }
  },
};

export const SharedCharacterCreator: React.FC<SharedCharacterCreatorProps> = (
  props,
) => {
  const room = useGameStore((state) => state.session?.roomCode ?? 'standalone');
  return (
    <PlayerCharacterCreator
      key={`${props.playerId}:${room}`}
      {...props}
      recoveryKey={`vtt:${encodeURIComponent(props.playerId)}:${encodeURIComponent(room)}:creation`}
    />
  );
};

const PlayerCharacterCreator: React.FC<
  SharedCharacterCreatorProps & { recoveryKey: string }
> = ({
  playerId,
  onComplete,
  onCancel,
  initialMode = creatorDefaultMode(),
  recoveryKey,
}) => {
  const theme = useTheme();
  const recovery = useCreatorRecovery(repository, recoveryKey);
  // 2024 only; `?edition=2014` keeps the older rules reachable for testing.
  const [edition] = useState(() =>
    resolveRequestedEdition(window.location.search),
  );
  const [actionError, setActionError] = useState<string>();
  const completionInFlight = useRef<Promise<void> | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null);
  const submission = useRef<
    { attemptId: string; character: Character; savedId?: string } | undefined
  >(undefined);
  const showGate = recovery.phase !== 'ready';

  useEffect(() => {
    if (showGate && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [showGate]);

  const complete = (input: CharacterCreationResult) => {
    if (completionInFlight.current) return completionInFlight.current;
    const operation = (async () => {
      await recovery.flush();
      const result = await recovery.freezeCompletion(input);
      const attemptId = result.creationAttemptId || result.character.id;
      if (!submission.current || submission.current.attemptId !== attemptId) {
        const character = createdCharacterToNexus(result.character, {
          playerId,
        });
        character.rulesCatalogVersion = await getRulesCatalogVersion();
        submission.current = { attemptId, character };
      }
      const attempt = submission.current;
      if (!attempt.savedId) {
        attempt.savedId = await useCharacterStore
          .getState()
          .saveCreatedCharacter(attempt.character, {
            creationAttemptId: attemptId,
            draftRevision: result.draftRevision || 1,
          });
        attempt.character =
          useCharacterStore.getState().getCharacter(attempt.savedId) ||
          attempt.character;
      }
      const outcome = await handoffSavedCharacter(attempt.character);
      await recovery.discard();
      toast.success(outcome.message, { duration: 12000 });
      await onComplete(attempt.savedId, attempt.character);
    })().finally(() => {
      completionInFlight.current = undefined;
    });
    completionInFlight.current = operation;
    return operation;
  };

  if (showGate)
    return (
      <dialog
        ref={dialog}
        className={styles.recovery}
        onCancel={onCancel}
        aria-labelledby="creator-recovery-title"
      >
        <h2 id="creator-recovery-title">Create your character</h2>
        {recovery.phase === 'loading' ? (
          <p role="status">Loading saved work…</p>
        ) : recovery.phase !== 'ready' ? (
          <>
            <p>
              {actionError ||
                recovery.error ||
                (recovery.recovery?.status === 'ok'
                  ? 'A draft is saved for this player in this browser. Resume it, or export a copy before starting again.'
                  : 'This build cannot open the saved draft. Its original data is retained; export a recovery copy before discarding.')}
            </p>
            <div className={styles.actions}>
              {recovery.recovery?.status === 'ok' &&
                recovery.recovery.record.pendingCompletion && (
                  <button
                    onClick={() => {
                      const record = recovery.recovery;
                      if (
                        record?.status === 'ok' &&
                        record.record.pendingCompletion
                      )
                        void complete(record.record.pendingCompletion).catch(
                          (error: unknown) =>
                            setActionError(
                              error instanceof Error
                                ? error.message
                                : 'Could not confirm the prior save.',
                            ),
                        );
                    }}
                  >
                    Retry previous save
                  </button>
                )}
              {recovery.recovery?.status === 'ok' &&
                !recovery.recovery.record.pendingCompletion && (
                  <button onClick={recovery.resume}>Resume creation</button>
                )}
              <button onClick={recovery.exportDraft}>
                Export recovery copy
              </button>
              <button onClick={() => void recovery.discard()}>
                Discard draft and start new
              </button>
              <button onClick={() => void recovery.reload()}>
                Retry loading
              </button>
            </div>
          </>
        ) : null}
        <button onClick={onCancel}>Close</button>
      </dialog>
    );

  const creatorTheme =
    theme === 'light'
      ? 'light'
      : theme === 'dark'
        ? 'dark-colorful'
        : typeof matchMedia === 'function' &&
            matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark-colorful';
  return (
    <>
      {(recovery.error || actionError) && (
        <div className={styles.alert} role="alert">
          {recovery.error || actionError}
          <button onClick={recovery.exportDraft}>Export current work</button>
          <button onClick={() => void recovery.reload()}>
            Review stored draft
          </button>
        </div>
      )}
      <CharacterCreator
        isOpen
        edition={recovery.initialDraft?.edition || edition}
        theme={creatorTheme}
        initialMode={recovery.initialPresentation?.mode || initialMode}
        initialDraft={recovery.initialDraft}
        initialPresentation={recovery.initialPresentation}
        onDraftChange={recovery.onDraftChange}
        onPresentationChange={recovery.onPresentationChange}
        onDraftDiscard={() => void recovery.discard()}
        allowModeSwitch
        onCancel={() => {
          void recovery
            .flush()
            .then(onCancel)
            .catch((caught: unknown) =>
              setActionError(
                caught instanceof Error ? caught.message : 'Draft save failed.',
              ),
            );
        }}
        onComplete={complete}
      />
    </>
  );
};

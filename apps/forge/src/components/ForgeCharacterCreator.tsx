import React, { useRef, useEffect, useState } from 'react';
import {
  CharacterCreator,
  type CharacterCreationCompleteHandler,
  type CharacterCreationResult,
  type CreationMode,
  type Edition,
} from '@nexus/character-creator';
import { useCreatorRecovery } from '../hooks/useCreatorRecovery';
import * as database from '../services/dbService';
import { creatorDefaultMode } from '../services/creatorCapabilities';

const repository = {
  getCreatorDraft: database.getCreatorDraft,
  saveCreatorDraft: database.saveCreatorDraft,
  deleteCreatorDraft: database.deleteCreatorDraft,
};

interface Props {
  isOpen: boolean;
  edition?: Edition;
  initialMode?: CreationMode;
  submitLabel?: string;
  onCancel: () => void;
  onComplete: CharacterCreationCompleteHandler;
}

export function ForgeCharacterCreator({
  isOpen,
  edition,
  initialMode = creatorDefaultMode(),
  submitLabel,
  onCancel,
  onComplete,
}: Props) {
  if (!isOpen) return null;
  return (
    <OpenCreator
      edition={edition}
      initialMode={initialMode}
      submitLabel={submitLabel}
      onCancel={onCancel}
      onComplete={onComplete}
    />
  );
}

function OpenCreator({
  edition,
  initialMode,
  submitLabel,
  onCancel,
  onComplete,
}: Omit<Props, 'isOpen'>) {
  const recovery = useCreatorRecovery(repository, 'forge:local:creation');
  const dialog = useRef<HTMLDialogElement>(null);
  const [actionError, setActionError] = useState<string>();
  const completionInFlight = useRef<Promise<void> | undefined>(undefined);
  useEffect(() => {
    if (recovery.phase !== 'ready' && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [recovery.phase]);

  const complete = (result: CharacterCreationResult) => {
    if (completionInFlight.current) return completionInFlight.current;
    const operation = (async () => {
      await recovery.flush();
      const frozen = await recovery.freezeCompletion(result);
      await onComplete(frozen);
      await recovery.discard();
    })().finally(() => {
      completionInFlight.current = undefined;
    });
    completionInFlight.current = operation;
    return operation;
  };

  if (recovery.phase !== 'ready')
    return (
      <dialog
        ref={dialog}
        onCancel={onCancel}
        className="bg-theme-secondary text-theme-primary rounded-xl p-6 max-w-lg"
      >
        <h2>Character creation recovery</h2>
        {recovery.phase === 'loading' ? (
          <p role="status">Loading saved work…</p>
        ) : (
          <>
            <p>
              {actionError ||
                recovery.error ||
                (recovery.recovery?.status === 'ok'
                  ? 'A character draft is saved in this browser. Resume it or export a copy before starting again.'
                  : 'This draft cannot be opened by this build. Export it before discarding; it has not been changed.')}
            </p>
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
            <button onClick={recovery.exportDraft}>Export recovery copy</button>
            <button onClick={() => void recovery.discard()}>
              Discard draft and start new
            </button>
            <button onClick={() => void recovery.reload()}>
              Retry loading
            </button>
          </>
        )}
        <button onClick={onCancel}>Close</button>
      </dialog>
    );

  return (
    <>
      {(recovery.error || actionError) && (
        <div
          role="alert"
          className="fixed top-0 inset-x-0 z-[100] bg-theme-secondary text-theme-primary p-4"
        >
          {recovery.error || actionError}
          <button onClick={recovery.exportDraft}>Export current work</button>
          <button onClick={() => void recovery.reload()}>
            Review stored draft
          </button>
        </div>
      )}
      <CharacterCreator
        isOpen
        edition={recovery.initialDraft?.edition ?? edition}
        initialMode={recovery.initialPresentation?.mode ?? initialMode}
        initialDraft={recovery.initialDraft}
        initialPresentation={recovery.initialPresentation}
        onDraftChange={recovery.onDraftChange}
        onPresentationChange={recovery.onPresentationChange}
        onDraftDiscard={() => void recovery.discard()}
        submitLabel={submitLabel}
        onCancel={() => {
          void recovery
            .flush()
            .then(onCancel)
            .catch((error: unknown) =>
              setActionError(
                error instanceof Error
                  ? error.message
                  : 'Could not save draft.',
              ),
            );
        }}
        onComplete={complete}
      />
    </>
  );
}

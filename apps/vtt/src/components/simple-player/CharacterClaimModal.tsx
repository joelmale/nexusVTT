import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import type { Character } from '@nexus/character-contracts';
import type { PlayerIntentResult } from '../../../shared/events/playerIntent';
import styles from './CharacterClaimModal.module.css';

export interface CharacterClaimModalProps {
  /** All session characters, as synced from the DM. */
  characters: Character[];
  userId: string;
  onClaim: (characterId: string) => Promise<PlayerIntentResult>;
  onCreateNew: () => void;
  onClose: () => void;
}

const REJECT_MESSAGES: Record<string, string> = {
  'not-owner': 'Someone else is already playing that character.',
  'host-offline': "The DM is away — try again when they're back.",
};

/**
 * Lets a Simple Mode player pick an unassigned party character (or one they
 * already own) or start the shared creator. Claims go to the DM's client as
 * an intent; the modal waits for the DM's answer.
 */
export const CharacterClaimModal: React.FC<CharacterClaimModalProps> = ({
  characters,
  userId,
  onClaim,
  onCreateNew,
  onClose,
}) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const available = characters.filter(
    (c) => !c.playerId || c.playerId === userId,
  );

  const claim = async (characterId: string) => {
    setPendingId(characterId);
    setError('');
    try {
      const result = await onClaim(characterId);
      if (result.status === 'applied') onClose();
      else
        setError(
          REJECT_MESSAGES[result.reason ?? ''] ??
            'That character is not available.',
        );
    } catch {
      setError(
        'The claim could not be confirmed. Check the connection and try again.',
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-title"
      >
        <header className={styles.header}>
          <h2 id="claim-title">Choose your character</h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {available.length === 0 ? (
          <p className={styles.muted}>
            No party characters are free right now. You can make a new one.
          </p>
        ) : (
          <ul className={styles.list}>
            {available.map((character) => (
              <li key={character.id}>
                <button
                  type="button"
                  className={styles.option}
                  disabled={pendingId !== null}
                  onClick={() => void claim(character.id)}
                >
                  <span>
                    {pendingId === character.id
                      ? 'Asking the DM…'
                      : `Play as ${character.name}`}
                  </span>
                  <span className={styles.meta}>
                    {[
                      character.class,
                      character.level && `Level ${character.level}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className={styles.create}
          disabled={pendingId !== null}
          onClick={onCreateNew}
        >
          Create New Character
        </button>
      </div>
    </div>
  );
};

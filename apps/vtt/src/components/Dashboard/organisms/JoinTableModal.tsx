import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import type { CharacterRecord } from '../types';
import { ModalShell } from './ModalShell';

interface JoinTableModalProps {
  /** Heroes the player can bring to the table. */
  characters: CharacterRecord[];
  /** Hero chosen via "Play as {name}"; skips the hero-picking step. */
  preselectedCharacter?: CharacterRecord | null;
  /**
   * Room code to start with (the table card or the band's code slots). With a
   * full code and heroes to choose from, the modal opens at the hero step.
   */
  initialRoomCode?: string;
  /** Join the room. Resolves on success; rejects with the failure reason. */
  onJoin: (
    roomCode: string,
    character: CharacterRecord | null,
  ) => Promise<void>;
  onClose: () => void;
}

const ROOM_CODE_LENGTH = 4;

const sanitizeCode = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);

const heroSummary = (c: CharacterRecord): string =>
  [`Lvl ${c.level}`, c.race, c.klass].filter(Boolean).join(' ');

/**
 * Two-step join flow: room code, then hero. Both "Join Game" and
 * "Play as {name}" open this modal; the latter has the hero preselected so the
 * second step is skipped.
 */
export const JoinTableModal: React.FC<JoinTableModalProps> = ({
  characters,
  preselectedCharacter = null,
  initialRoomCode = '',
  onJoin,
  onClose,
}) => {
  const startsWithHeroPicker =
    sanitizeCode(initialRoomCode).length === ROOM_CODE_LENGTH &&
    !preselectedCharacter &&
    characters.length > 0;
  const [step, setStep] = useState<1 | 2>(startsWithHeroPicker ? 2 : 1);
  const [roomCode, setRoomCode] = useState(() => sanitizeCode(initialRoomCode));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeReady = roomCode.length === ROOM_CODE_LENGTH;
  const skipsHeroStep =
    Boolean(preselectedCharacter) || characters.length === 0;

  const join = async (character: CharacterRecord | null) => {
    setJoining(true);
    setError(null);
    try {
      await onJoin(roomCode, character);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  const handleCodeContinue = () => {
    if (!codeReady || joining) return;
    if (skipsHeroStep) {
      void join(preselectedCharacter);
    } else {
      setError(null);
      setStep(2);
    }
  };

  const selected = characters.find((c) => c.id === selectedId) ?? null;

  return (
    <ModalShell
      title={
        preselectedCharacter
          ? `Play as ${preselectedCharacter.name}`
          : 'Join a Table'
      }
      onClose={onClose}
    >
      {step === 1 ? (
        <>
          <p className="text-xs text-[#cbd5e1]/80 mb-4 font-serif italic">
            {preselectedCharacter
              ? `Enter the room code from your Game Master to bring ${preselectedCharacter.name} to the table.`
              : "Enter the Game Master's 4-character room code."}
          </p>
          <label
            htmlFor="join-room-code"
            className="block text-[11px] uppercase font-bold tracking-widest text-amber-500 mb-1"
          >
            Room code
          </label>
          <input
            id="join-room-code"
            type="text"
            placeholder="ABCD"
            value={roomCode}
            maxLength={ROOM_CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) =>
              setRoomCode(sanitizeCode(e.target.value))
            }
            onKeyDown={(e) => e.key === 'Enter' && handleCodeContinue()}
            className="
              w-full px-3 py-2 rounded-sm text-[#f1e6d3] placeholder:text-[#cbd5e1]/50
              bg-[#1c1e22] border border-[#8c6b4a]/40 outline-none
              focus:border-[#d97706] focus:shadow-vtt-amber-glow
              transition-all duration-200 text-lg font-mono uppercase tracking-[0.5em] text-center mb-4
            "
            autoFocus
          />
        </>
      ) : (
        <>
          <p className="text-xs text-[#cbd5e1]/80 mb-3 font-serif italic">
            Who is joining table {roomCode}?
          </p>
          <ul
            aria-label="Choose a hero"
            className="flex flex-col gap-1.5 mb-4 max-h-60 overflow-y-auto"
          >
            {characters.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`unstyled 
                    w-full text-left px-3 py-2 rounded-sm border cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                    ${
                      selectedId === c.id
                        ? 'bg-[#8c6b4a]/30 border-[#d97706]'
                        : 'bg-[#1c1e22] border-[#8c6b4a]/40 hover:border-[#d97706]/70'
                    }
                  `}
                >
                  <span className="block font-serif font-bold text-sm text-[#f1e6d3] truncate">
                    {c.name}
                  </span>
                  <span className="block text-[11px] uppercase tracking-wider text-[#cbd5e1]/75 truncate">
                    {heroSummary(c)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <p role="alert" className="text-red-400 text-xs mb-4 font-medium">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-[#8c6b4a]/20 pt-3 mt-2">
        {step === 1 ? (
          <>
            <Button
              variant="ghost"
              onClick={onClose}
              className="!text-[#cbd5e1]/75 hover:!text-[#f1e6d3]"
            >
              Cancel
            </Button>
            <Button
              variant="bronze"
              onClick={handleCodeContinue}
              disabled={joining || !codeReady}
            >
              {joining ? 'Joining…' : skipsHeroStep ? 'Enter Lobby' : 'Next'}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setError(null);
                setStep(1);
              }}
              disabled={joining}
              className="!text-[#cbd5e1]/75 hover:!text-[#f1e6d3]"
            >
              Back
            </Button>
            <Button
              variant="ghost"
              onClick={() => void join(null)}
              disabled={joining}
              className="!text-[#cbd5e1]/75 hover:!text-[#f1e6d3]"
            >
              Join without a hero
            </Button>
            <Button
              variant="bronze"
              onClick={() => void join(selected)}
              disabled={joining || !selected}
            >
              {joining
                ? 'Joining…'
                : selected
                  ? `Join as ${selected.name}`
                  : 'Choose a hero'}
            </Button>
          </>
        )}
      </div>
    </ModalShell>
  );
};

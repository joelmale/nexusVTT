import React, { useRef } from 'react';

export const ROOM_CODE_LENGTH = 4;

interface RoomCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when Enter is pressed in a slot with a complete code. */
  onSubmit?: () => void;
  className?: string;
}

const clean = (raw: string): string =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Four single-character slots for a room code. Typing advances, Backspace
 * retreats and pasting a whole code fills every slot.
 */
export const RoomCodeInput: React.FC<RoomCodeInputProps> = ({
  value,
  onChange,
  onSubmit,
  className = '',
}) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focusSlot = (index: number) =>
    refs.current[Math.min(Math.max(index, 0), ROOM_CODE_LENGTH - 1)]?.focus();

  const setFrom = (index: number, raw: string) => {
    const chars = clean(raw);
    const next = value.padEnd(ROOM_CODE_LENGTH, ' ').split('');
    if (chars.length === 0) {
      next[index] = ' ';
    } else {
      chars
        .slice(0, ROOM_CODE_LENGTH - index)
        .split('')
        .forEach((ch, i) => {
          next[index + i] = ch;
        });
    }
    onChange(next.join('').trimEnd().slice(0, ROOM_CODE_LENGTH));
    if (chars.length > 0) {
      focusSlot(index + Math.min(chars.length, ROOM_CODE_LENGTH - index));
    }
  };

  return (
    <div
      role="group"
      aria-label="Room code"
      className={`flex items-center gap-2 ${className}`}
    >
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label={`Room code character ${i + 1} of ${ROOM_CODE_LENGTH}`}
          value={value[i]?.trim() ?? ''}
          onChange={(e) => setFrom(i, e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            setFrom(i, e.clipboardData.getData('text'));
          }}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i]?.trim()) {
              focusSlot(i - 1);
            } else if (e.key === 'ArrowLeft') {
              focusSlot(i - 1);
            } else if (e.key === 'ArrowRight') {
              focusSlot(i + 1);
            } else if (e.key === 'Enter') {
              onSubmit?.();
            }
          }}
          className="
            w-10 h-12 rounded-sm text-center text-xl font-mono uppercase
            bg-[#f6efdf] text-[#362b21] border-2 border-[#8c6b4a]/60
            outline-none focus:border-[#d97706] focus:shadow-vtt-amber-glow
          "
        />
      ))}
    </div>
  );
};

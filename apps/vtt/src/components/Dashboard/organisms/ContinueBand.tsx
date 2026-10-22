import React, { useEffect, useState } from 'react';
import type { TableRecord } from '../types';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import { ParchmentTexture } from '../atoms/ParchmentTexture';
import { RoleRibbon } from '../atoms/RoleRibbon';
import { WaxSeal } from '../atoms/WaxSeal';
import { RoomCodeInput, ROOM_CODE_LENGTH } from '../molecules/RoomCodeInput';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { getTableAction } from '../tableAction';
import { formatRelative } from '@/utils/formatRelative';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Check from 'lucide-react/dist/esm/icons/check';
import Map from 'lucide-react/dist/esm/icons/map';
import Play from 'lucide-react/dist/esm/icons/play';
import Users from 'lucide-react/dist/esm/icons/users';

interface ContinueBandProps {
  /** The table the user was last at, when it still exists. */
  table?: TableRecord;
  /** Resume (DM) or Rejoin (player); same handler the table cards use. */
  onAction?: (table: TableRecord) => void;
  /** Opens the join modal at the hero step with this code prefilled. */
  onJoinWithCode?: (code: string) => void;
  className?: string;
}

/**
 * Torn bottom edge: a zig-zag of pixel offsets, so it holds its shape at any
 * band height. Applied with clip-path; no image assets.
 */
const TORN_EDGE = (() => {
  const steps = 28;
  const offsets = [6, 2, 8, 3, 7, 1, 5];
  const points = ['0% 0%', '100% 0%'];
  for (let i = steps; i >= 0; i -= 1) {
    const x = ((i / steps) * 100).toFixed(2);
    points.push(`${x}% calc(100% - ${offsets[i % offsets.length]}px)`);
  }
  return `polygon(${points.join(', ')})`;
})();

const isCompleteCode = (code: string): boolean =>
  code.length === ROOM_CODE_LENGTH && !code.includes(' ');

export const ContinueBand: React.FC<ContinueBandProps> = ({
  table,
  onAction,
  onJoinWithCode,
  className = '',
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Generated once so the render loop stays pure.
  const [embers] = useState(() =>
    Array.from({ length: 15 }).map((_, idx) => ({
      id: idx,
      left: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 5 + 4,
      delay: Math.random() * 5,
    })),
  );

  useEffect(() => {
    if (!copied) return undefined;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const handleCopy = async (roomCode: string) => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable or denied; the code stays visible to copy by hand.
    }
  };

  const submitCode = () => {
    if (isCompleteCode(code)) onJoinWithCode?.(code);
  };

  const action = table ? getTableAction(table, 'band') : null;
  const playedLabel = table ? formatRelative(table.lastPlayedAt) : '';
  const online = table ? table.roster.filter((r) => r.online).length : 0;

  return (
    <section
      aria-label="Continue"
      className={`
        relative overflow-hidden rounded-md p-4 md:p-6 bg-[#1a1d23]
        border border-[#8c6b4a]/30 shadow-2xl
        ${className}
      `}
    >
      {/* Embers live here only. Omitted entirely (no nodes, no keyframes) when
          the user prefers reduced motion. */}
      {!reducedMotion && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-full pointer-events-none overflow-hidden select-none z-0">
            <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-orange-600/10 to-transparent blur-md" />
            {embers.map((ember) => (
              <div
                key={ember.id}
                data-testid="ember"
                className="absolute bottom-0 rounded-full bg-orange-500 blur-[0.5px] opacity-0"
                style={{
                  left: `${ember.left}%`,
                  width: `${ember.size}px`,
                  height: `${ember.size}px`,
                  animation: `floatUp ${ember.duration}s ease-in-out infinite`,
                  animationDelay: `${ember.delay}s`,
                  boxShadow: '0 0 8px #d97706, 0 0 12px #ea580c',
                }}
              />
            ))}
          </div>
          <style>{`
            @keyframes floatUp {
              0% { transform: translateY(10px) translateX(0) scale(1); opacity: 0; }
              10% { opacity: 0.8; }
              50% { opacity: 0.6; transform: translateY(-100px) translateX(15px) scale(0.8); }
              90% { opacity: 0.2; }
              100% { transform: translateY(-220px) translateX(-10px) scale(0.4); opacity: 0; }
            }
          `}</style>
        </>
      )}

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-stretch">
        {/* Pinned, torn-edge notice */}
        <div className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.55)] min-w-0">
          <div
            className="relative h-full bg-[#EFE8D8] text-[#362b21] px-5 pt-7 pb-8 min-w-0"
            style={{ clipPath: TORN_EDGE }}
          >
            <ParchmentTexture />
            <span
              aria-hidden="true"
              className="absolute top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-b from-red-500 to-red-800 shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
            />

            {table && action ? (
              <div className="relative flex flex-col gap-2 min-w-0">
                <RoleRibbon
                  role={table.role}
                  className="absolute -top-7 right-0 z-10"
                />
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#705234] pr-28">
                  Continue where you left off
                </p>
                <GothicHeader
                  level={2}
                  variant="cinzel"
                  className="!text-[#362b21] !text-xl sm:!text-2xl leading-tight !drop-shadow-none break-words sm:pr-28"
                >
                  {table.name}
                </GothicHeader>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <WaxSeal status={table.status} />
                  <span className="text-xs font-serif italic text-[#362b21]/75">
                    {playedLabel ? `Played ${playedLabel}` : 'Never played'}
                  </span>
                  {table.status === 'open' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#362b21]/85">
                      <Users size={13} aria-hidden="true" />
                      {online > 0
                        ? `${online} at the table`
                        : 'No one at the table yet'}
                    </span>
                  )}
                </div>

                {table.roomCode && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#705234]">
                      Room
                    </span>
                    <span
                      data-testid="band-room-code"
                      className="font-mono text-xl font-bold tracking-[0.3em] text-[#362b21]"
                    >
                      {table.roomCode.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy(table.roomCode as string)}
                      aria-label={`Copy room code ${table.roomCode.toUpperCase()}`}
                      className="unstyled 
                        flex items-center justify-center w-8 h-8 rounded-sm cursor-pointer
                        text-[#362b21]/80 hover:text-[#362b21] hover:bg-[#8c6b4a]/15
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                      "
                    >
                      {copied ? (
                        <Check size={16} aria-hidden="true" />
                      ) : (
                        <Copy size={16} aria-hidden="true" />
                      )}
                    </button>
                    <span
                      role="status"
                      aria-live="polite"
                      className="text-[11px] font-bold text-emerald-800 min-w-[3.5rem]"
                    >
                      {copied ? 'Copied' : ''}
                    </span>
                  </div>
                )}

                {onAction && (
                  <div className="mt-1">
                    <Button
                      variant="bronze"
                      onClick={() => onAction(table)}
                      disabled={action.disabled}
                      title={action.hint}
                      icon={
                        action.disabled ? undefined : (
                          <Play size={12} className="fill-current" />
                        )
                      }
                      className="text-xs"
                    >
                      {action.label}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative flex flex-col gap-2">
                <GothicHeader
                  level={2}
                  variant="cinzel"
                  className="!text-[#362b21] !text-2xl leading-tight !drop-shadow-none"
                >
                  Welcome, traveler
                </GothicHeader>
                <p className="text-sm font-serif italic text-[#362b21]/85">
                  Got a room code from your Game Master? Enter it to take a
                  seat at their table.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Inline join */}
        <div className="relative flex flex-col justify-center gap-3 rounded-sm p-4 bg-[#252a31] border border-[#8c6b4a]/40 min-w-0">
          <GothicHeader
            level={3}
            variant="medieval"
            className="flex items-center gap-2 !text-lg"
          >
            <Map size={16} className="text-amber-500" aria-hidden="true" />
            Join a table
          </GothicHeader>
          <RoomCodeInput
            value={code}
            onChange={setCode}
            onSubmit={submitCode}
          />
          <div>
            <Button
              variant="bronze"
              onClick={submitCode}
              disabled={!isCompleteCode(code)}
              className="text-xs"
            >
              Find table
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

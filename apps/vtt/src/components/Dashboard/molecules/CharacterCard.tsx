import React from 'react';
import { CharacterRecord } from '../types';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import { ProgressBar } from '../atoms/ProgressBar';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Play from 'lucide-react/dist/esm/icons/play';

interface CharacterCardProps {
  character: CharacterRecord;
  onStartSession?: (char: CharacterRecord) => void;
  onEdit?: (char: CharacterRecord) => void;
  onDelete?: (char: CharacterRecord) => void;
  className?: string;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onStartSession,
  onEdit,
  onDelete,
  className = '',
}) => {
  // Calculate D&D modifier
  const getModifier = (val: number) => {
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const formattedDate = new Date(character.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Level progression calculations
  const DND5E_XP_THRESHOLDS = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
    120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
  ];

  const getProgress = () => {
    const lvl = Math.min(Math.max(character.level, 1), 20);
    const xp = character.xp ?? null;
    if (xp !== null && lvl < 20) {
      const cur = DND5E_XP_THRESHOLDS[lvl - 1];
      const next = DND5E_XP_THRESHOLDS[lvl];
      return {
        value: xp - cur,
        max: next - cur,
        label: `${xp.toLocaleString()} / ${next.toLocaleString()} XP`,
      };
    }
    return {
      value: lvl,
      max: 20,
      label: `Lvl ${lvl} / 20`,
    };
  };

  const progress = getProgress();

  return (
    <article
      className={`
        relative flex flex-col p-3.5 rounded-sm bg-[#EFE8D8] text-[#362b21]
        border-4 border-double border-[#8c6b4a]/60 shadow-[0_4px_8px_rgba(0,0,0,0.3)]
        hover:border-[#d97706]/70 hover:shadow-vtt-amber-glow hover:scale-[1.01]
        transition-all duration-300 min-w-0 flex-1 justify-between
        ${className}
      `}
    >
      {/* Noise background texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div>
        {/* Top Info row */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="min-w-0">
            <GothicHeader level={3} variant="cinzel" className="!text-[#362b21] leading-tight truncate">
              {character.name}
            </GothicHeader>
            <p className="text-[11px] uppercase font-['Oswald',sans-serif] tracking-wider text-[#705234] font-bold">
              Lvl {character.level} {character.race} {character.klass}
            </p>
          </div>
          <span className="text-[9px] text-[#362b21]/50 font-serif italic whitespace-nowrap">
            {formattedDate}
          </span>
        </div>

        {/* 6 stats block: 2 rows of 3 columns */}
        <div className="grid grid-cols-3 gap-1.5 my-2.5 text-center">
          {Object.entries(character.stats).map(([statName, val]) => {
            const shortName = statName.slice(0, 3).toUpperCase();
            return (
              <div
                key={statName}
                className="bg-[#8c6b4a]/10 border border-[#8c6b4a]/30 rounded-sm p-0.5 py-1 flex flex-col justify-center shadow-inner"
              >
                <span className="font-['Oswald',sans-serif] text-[9px] font-bold opacity-60">
                  {shortName}
                </span>
                <span className="font-['Oswald',sans-serif] text-sm font-black text-[#362b21]">
                  {val}
                </span>
                <span className="text-[9px] font-bold text-amber-800">
                  {getModifier(val)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Level / XP Progress Bar */}
        <div className="my-3">
          <ProgressBar
            value={progress.value}
            max={progress.max}
            label={progress.label}
            variant="parchment"
            showPercentage={true}
          />
        </div>
      </div>

      {/* Actions toolbar */}
      <div className="flex items-center justify-between mt-4 border-t border-[#8c6b4a]/20 pt-3">
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              variant="ghost"
              onClick={() => onEdit(character)}
              icon={<Pencil size={12} />}
              className="!px-2 !py-1 text-xs !text-[#362b21] hover:!text-amber-700"
              title="Edit Character"
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => onDelete(character)}
              icon={<Trash2 size={12} />}
              className="!px-2 !py-1 text-xs !text-[#7f1d1d] hover:!text-red-600"
              title="Delete Character"
            >
              Delete
            </Button>
          )}
        </div>
        {onStartSession && (
          <Button
            variant="bronze"
            onClick={() => onStartSession(character)}
            icon={<Play size={12} className="fill-current" />}
            className="!px-3 !py-1.5 text-xs"
          >
            Start Session
          </Button>
        )}
      </div>
    </article>
  );
};

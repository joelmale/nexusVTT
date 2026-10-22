import React, { useId, useState } from 'react';
import type { CharacterRecord } from '../types';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import { ClassCrest } from '../atoms/ClassCrest';
import { OverflowMenu, type OverflowMenuItem } from '../atoms/OverflowMenu';
import { ParchmentTexture } from '../atoms/ParchmentTexture';
import Play from 'lucide-react/dist/esm/icons/play';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';

interface HeroCardProps {
  hero: CharacterRecord;
  /** Name of the table the hero is bound to, if any. */
  tableName?: string;
  /** Opens the join flow with this hero preselected ("Play as {name}"). */
  onPlayAs?: (hero: CharacterRecord) => void;
  onDelete?: (hero: CharacterRecord) => void;
  className?: string;
}

const getModifier = (val: number): string => {
  const mod = Math.floor((val - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const chipClass =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-[#8c6b4a]/40 bg-[#8c6b4a]/10 text-xs font-bold text-[#362b21]';

export const HeroCard: React.FC<HeroCardProps> = ({
  hero,
  tableName,
  onPlayAs,
  onDelete,
  className = '',
}) => {
  const [showAbilities, setShowAbilities] = useState(false);
  const abilitiesId = useId();

  // Missing race/class are left out rather than defaulted.
  const summary = [`Lvl ${hero.level}`, hero.race, hero.klass]
    .filter(Boolean)
    .join(' ');

  const hasVitals =
    Boolean(hero.hp) ||
    hero.ac !== undefined ||
    hero.passivePerception !== undefined;

  const menuItems: OverflowMenuItem[] = onDelete
    ? [{ label: 'Delete', danger: true, onSelect: () => onDelete(hero) }]
    : [];

  return (
    <article
      data-testid="hero-card"
      className={`
        relative flex flex-col gap-3 p-3.5 rounded-sm bg-[#EFE8D8] text-[#362b21]
        border-4 border-double border-[#8c6b4a]/60 shadow-[0_4px_8px_rgba(0,0,0,0.3)]
        hover:border-[#d97706]/70 hover:shadow-vtt-amber-glow motion-safe:hover:scale-[1.01]
        transition-all duration-300 min-w-0
        ${className}
      `}
    >
      <ParchmentTexture />

      <div className="relative flex items-start gap-3 min-w-0">
        <ClassCrest klass={hero.klass} />
        <div className="min-w-0">
          <GothicHeader
            level={3}
            variant="cinzel"
            className="!text-[#362b21] !text-lg leading-tight !drop-shadow-none break-words"
          >
            {hero.name}
          </GothicHeader>
          <p className="text-[11px] uppercase font-['Oswald',sans-serif] tracking-wider text-[#705234] font-bold">
            {summary}
          </p>
        </div>
      </div>

      {hasVitals && (
        <ul className="relative flex flex-wrap gap-1.5" aria-label="Vitals">
          {hero.hp && (
            <li className={chipClass}>
              HP {hero.hp.current}/{hero.hp.max}
            </li>
          )}
          {hero.ac !== undefined && <li className={chipClass}>AC {hero.ac}</li>}
          {hero.passivePerception !== undefined && (
            <li className={chipClass} title="Passive Perception">
              PP {hero.passivePerception}
            </li>
          )}
        </ul>
      )}

      <p className="relative text-xs font-serif text-[#362b21]/85">
        {tableName ? (
          <>
            At <span className="font-bold">{tableName}</span>
          </>
        ) : (
          <span className="italic">Not at a table</span>
        )}
      </p>

      {hero.stats && (
        <div className="relative">
          <button
            type="button"
            aria-expanded={showAbilities}
            aria-controls={abilitiesId}
            onClick={() => setShowAbilities((v) => !v)}
            className="unstyled 
              inline-flex items-center gap-1 text-xs font-bold text-[#705234] cursor-pointer
              hover:text-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            "
          >
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`transition-transform ${showAbilities ? 'rotate-180' : ''}`}
            />
            {showAbilities ? 'Hide abilities' : 'Show abilities'}
          </button>
          {showAbilities && (
            <div
              id={abilitiesId}
              className="grid grid-cols-3 gap-1.5 mt-2 text-center"
            >
              {Object.entries(hero.stats).map(([statName, val]) => (
                <div
                  key={statName}
                  className="bg-[#8c6b4a]/10 border border-[#8c6b4a]/30 rounded-sm p-0.5 py-1 flex flex-col justify-center"
                >
                  <span className="font-['Oswald',sans-serif] text-[11px] font-bold text-[#362b21]/75">
                    {statName.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="font-['Oswald',sans-serif] text-sm font-black text-[#362b21]">
                    {val}
                  </span>
                  <span className="text-[11px] font-bold text-amber-800">
                    {getModifier(val)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative flex items-center justify-between mt-auto border-t border-[#8c6b4a]/20 pt-3 gap-2">
        <OverflowMenu
          items={menuItems}
          label={`More actions for ${hero.name}`}
        />
        {onPlayAs && (
          <Button
            variant="bronze"
            onClick={() => onPlayAs(hero)}
            icon={<Play size={12} className="fill-current" />}
            className="!px-3 !py-1.5 text-xs ml-auto"
          >
            Play as {hero.name}
          </Button>
        )}
      </div>
    </article>
  );
};

import React from 'react';
import Hammer from 'lucide-react/dist/esm/icons/hammer';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Shield from 'lucide-react/dist/esm/icons/shield';
import type { CharacterRecord } from '../types';
import { HeroCard } from '../molecules/HeroCard';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';

interface HeroSectionProps {
  heroes: CharacterRecord[];
  /** Name of the table a hero is bound to, when it has one. */
  tableNameFor?: (hero: CharacterRecord) => string | undefined;
  onPlayAs?: (hero: CharacterRecord) => void;
  onDelete?: (hero: CharacterRecord) => void;
  onCreateCharacter?: () => void;
  onOpenCharacterForge?: () => void;
  className?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  heroes,
  tableNameFor,
  onPlayAs,
  onDelete,
  onCreateCharacter,
  onOpenCharacterForge,
  className = '',
}) => (
  <section
    aria-label="Your Heroes"
    className={`flex flex-col gap-4 ${className}`}
  >
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#8c6b4a]/30 pb-3">
      <GothicHeader
        level={2}
        variant="medieval"
        className="flex items-center gap-2"
      >
        <Shield size={20} className="text-amber-500" aria-hidden="true" />
        Your Heroes
      </GothicHeader>
      {onOpenCharacterForge && (
        <Button
          variant="ghost"
          onClick={onOpenCharacterForge}
          icon={<Hammer size={14} />}
          className="text-xs"
        >
          Character Forge
        </Button>
      )}
    </div>

    {heroes.length === 0 ? (
      <div className="flex flex-col items-center justify-center p-8 rounded-sm bg-[#252a31]/50 border border-[#8c6b4a]/25 text-center select-none">
        <Shield size={32} className="text-[#8c6b4a]/50 mb-2" />
        <p className="text-sm font-serif italic text-[#cbd5e1]/75 mb-3">
          No heroes yet. Forge a new hero!
        </p>
        {onCreateCharacter && (
          <Button
            variant="bronze"
            onClick={onCreateCharacter}
            icon={<Plus size={14} />}
            className="text-xs"
          >
            New Character
          </Button>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {heroes.map((hero) => (
          <HeroCard
            key={hero.id}
            hero={hero}
            tableName={tableNameFor?.(hero)}
            onPlayAs={onPlayAs}
            onDelete={onDelete}
          />
        ))}
      </div>
    )}
  </section>
);

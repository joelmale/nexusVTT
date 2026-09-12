import React from 'react';
import { CharacterRecord } from '../types';
import { CharacterCard } from '../molecules/CharacterCard';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Plus from 'lucide-react/dist/esm/icons/plus';

interface CharacterGridProps {
  characters: CharacterRecord[];
  onStartSession?: (char: CharacterRecord) => void;
  onEdit?: (char: CharacterRecord) => void;
  onDelete?: (char: CharacterRecord) => void;
  onCreateCharacter?: () => void;
  loading?: boolean;
  className?: string;
}

export const CharacterGrid: React.FC<CharacterGridProps> = ({
  characters,
  onStartSession,
  onEdit,
  onDelete,
  onCreateCharacter,
  loading = false,
  className = '',
}) => {
  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      {/* Grid Header */}
      <div className="flex items-center justify-between border-b border-[#8c6b4a]/30 pb-3">
        <GothicHeader level={2} variant="medieval" className="flex items-center gap-2">
          <Shield size={20} className="text-amber-500" />
          Recent Characters
        </GothicHeader>
        {onCreateCharacter && (
          <Button
            variant="ghost"
            onClick={onCreateCharacter}
            icon={<Plus size={14} />}
            className="text-xs"
          >
            New Character
          </Button>
        )}
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-sm bg-[#252a31]/60 border border-[#8c6b4a]/20 animate-pulse"
            />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-sm bg-[#252a31]/50 border border-[#8c6b4a]/25 text-center select-none">
          <Shield size={32} className="text-[#8c6b4a]/50 mb-2" />
          <p className="text-sm font-serif italic text-[#cbd5e1]/60">
            No characters found. Forge a new hero!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              onStartSession={onStartSession}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
};

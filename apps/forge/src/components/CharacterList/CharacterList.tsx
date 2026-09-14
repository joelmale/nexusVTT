import React from 'react';
import { Shield } from 'lucide-react';
import { CharacterListProps } from '../../types/components';
import { CharacterCard } from './CharacterCard';

const EmptyState: React.FC = () => (
  <div className="text-center p-12 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-secondary">
    <Shield className="w-12 h-12 text-red-500 mx-auto mb-3" />
    <p className="text-xl font-semibold text-theme-muted">Ready your destiny!</p>
    <p className="text-theme-disabled">Use the "New Character Wizard" button to start forging your hero.</p>
  </div>
);

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  selectedCharacterIds,
  onCharacterSelect,
  onCharacterView,
  onCharacterDelete,
}) => {
  return (
    <section>
      <h2 className="text-2xl font-bold text-theme-secondary mb-4">Your Heroes ({characters.length})</h2>

      {characters.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              isSelected={selectedCharacterIds.has(char.id)}
              onSelect={() => onCharacterSelect(char.id)}
              onView={() => onCharacterView(char.id)}
              onDelete={() => onCharacterDelete(char.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
};
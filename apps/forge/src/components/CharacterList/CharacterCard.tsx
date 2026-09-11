import React from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import { Character } from '../../types/dnd';
import { formatModifier } from '../../utils/formatters';

interface CharacterCardProps {
  character: Character;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onDelete: () => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  isSelected,
  onSelect,
  onView,
  onDelete,
}) => (
  <div className="bg-theme-secondary rounded-xl shadow-xl hover:shadow-red-700/30 transition-shadow duration-300 overflow-hidden">
    <div className="p-5">
      {/* Checkbox for selection */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-grow">
          <h3 className="text-2xl font-bold text-accent-red-light truncate">{character.name}</h3>
          <p className="text-sm text-theme-muted mb-3">{character.species} | {character.class} (Level {character.level})</p>
        </div>
        <label className="flex items-center cursor-pointer ml-2" title="Select for export">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-5 h-5 text-accent-red bg-theme-tertiary border-theme-primary rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
          />
        </label>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium bg-theme-tertiary/50 p-3 rounded-lg">
        <div>AC: <span className="text-accent-yellow-light block text-lg font-bold">{character.armorClass}</span></div>
        <div>HP: <span className="text-accent-green-light block text-lg font-bold">{character.hitPoints}</span></div>
        <div>Prof: <span className="text-accent-yellow-light block text-lg font-bold">{formatModifier(character.proficiencyBonus)}</span></div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-4 space-x-3">
        <button
          onClick={onView}
          className="flex-grow py-2 bg-accent-red hover:bg-accent-red-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
        >
          <BookOpen className="w-4 h-4 mr-2" /> View Sheet
        </button>
        <button
          onClick={onDelete}
          className="p-2 bg-theme-quaternary hover:bg-accent-red-dark rounded-lg transition-colors"
          title="Delete Character"
        >
          <Trash2 className="w-5 h-5 text-theme-primary" />
        </button>
      </div>
    </div>
  </div>
);
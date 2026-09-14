import React from 'react';
import { X } from 'lucide-react';
import { Character } from '../types/dnd';
import { CharacterEditForm } from './CharacterEditForm';

interface CharacterEditModalProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Character) => void;
}

export const CharacterEditModal: React.FC<CharacterEditModalProps> = ({
  character,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-primary rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-theme-secondary">
          <h2 className="text-xl font-bold text-accent-yellow-light">
            Edit Character: {character.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-theme-muted hover:text-white" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="max-h-[calc(90vh-80px)] overflow-y-auto">
          <CharacterEditForm
            character={character}
            onSave={(updatedCharacter) => {
              onSave(updatedCharacter);
              onClose();
            }}
            onCancel={onClose}
            isCreating={false}
          />
        </div>
      </div>
    </div>
  );
};
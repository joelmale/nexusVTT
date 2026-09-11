import React from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';
import { Character } from '../types/dnd';
import { CharacterEditForm } from './CharacterEditForm';
import { useCharacterManagement } from '../hooks/useCharacterManagement';

interface ManualEntryScreenProps {
  isOpen: boolean;
  edition: '2014' | '2024';
  onClose: () => void;
  onCharacterCreated?: (character: Character) => void;
}

const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ isOpen, edition, onClose, onCharacterCreated }) => {
  const { createCharacter } = useCharacterManagement();

  const handleCreateCharacter = async (character: Character) => {
    const success = await createCharacter(character);
    if (success) {
      onCharacterCreated?.(character);
      onClose(); // Close the modal
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-theme-secondary rounded-2xl shadow-2xl w-full max-w-6xl transition-all transform duration-300 scale-100 my-8 flex flex-col max-h-[calc(100vh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-accent-blue-light" />
            <h2 className="text-2xl font-bold text-accent-yellow-light">Manual Character Creation</h2>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {/* Description */}
            <div className="text-center mb-8">
              <p className="text-theme-tertiary text-lg leading-relaxed">
                Fill out a complete character sheet with full control over all stats and features.
                Perfect for transferring pen & paper characters or building custom characters.
              </p>
            </div>

            {/* Character Edit Form */}
            <CharacterEditForm
              onSave={handleCreateCharacter}
              onCancel={onClose}
              isCreating={true}
              edition={edition}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ManualEntryScreen;
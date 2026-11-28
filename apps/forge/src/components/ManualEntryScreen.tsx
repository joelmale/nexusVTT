import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';
import { Character } from '../types/dnd';
import { CharacterEditForm } from './CharacterEditForm';
import { addCharacter } from '../services/dbService';

interface ManualEntryScreenProps {
  isOpen: boolean;
  edition: '2014' | '2024';
  onClose: () => void;
  onCharacterCreated?: (character: Character) => void;
}

const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({
  isOpen,
  edition,
  onClose,
  onCharacterCreated,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const saveInProgress = useRef(false);

  const handleClose = () => {
    if (saveInProgress.current) return;
    setError(undefined);
    onClose();
  };

  const handleCreateCharacter = async (character: Character): Promise<void> => {
    if (saveInProgress.current) return;
    saveInProgress.current = true;
    setIsSaving(true);
    setError(undefined);
    try {
      await addCharacter(character);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Character could not be saved.',
      );
      return;
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
    onCharacterCreated?.(character);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-theme-secondary rounded-2xl shadow-2xl w-full max-w-6xl transition-all transform duration-300 scale-100 my-8 flex flex-col max-h-[calc(100vh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-accent-blue-light" />
            <h2 className="text-2xl font-bold text-accent-yellow-light">
              Manual Character Creation
            </h2>
          </div>
          <button
            aria-label="Close manual character entry"
            disabled={isSaving}
            onClick={handleClose}
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
                Enter your character’s details, abilities, HP, skill
                proficiencies, languages, and coins. Class determines
                saving-throw proficiencies. Starting AC is 10 plus Dexterity
                modifier. Add equipment on the saved sheet or use Character
                Wizard to choose starting gear and spells.
              </p>
            </div>

            {/* Character Edit Form */}
            {error && <p role="alert">{error}</p>}
            <CharacterEditForm
              onSave={handleCreateCharacter}
              onCancel={handleClose}
              isSaving={isSaving}
              isCreating={true}
              edition={edition}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ManualEntryScreen;

import React, { useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import { SpellbookEntry } from '../../services/storage/IStorageService';

interface CreateSpellbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (spellbook: SpellbookEntry) => void;
  characterId?: string;
}

export const CreateSpellbookModal: React.FC<CreateSpellbookModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  characterId,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const now = Date.now();
    const newBook: SpellbookEntry = {
      id: now.toString(),
      name: name.trim(),
      description: description.trim() || undefined,
      characterId,
      spells: [],
      preparedSpells: [],
      createdAt: now,
      updatedAt: now,
    };

    onCreate(newBook);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary border border-theme-tertiary/40 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-theme-tertiary/40">
          <div className="flex items-center gap-2 text-accent-blue-light font-bold text-lg">
            <BookOpen className="w-5 h-5" />
            <span>Create New Spellbook</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-theme-tertiary rounded transition-colors text-theme-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1">
              Spellbook Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Evocation Grimoire, Prepared Daily"
              required
              className="w-full px-3 py-2 bg-theme-primary/60 border border-theme-tertiary/40 rounded-lg text-sm text-theme-primary focus:outline-none focus:border-accent-blue-light"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-muted mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Level 5 Wizard prepared spells & utility rituals"
              rows={3}
              className="w-full px-3 py-2 bg-theme-primary/60 border border-theme-tertiary/40 rounded-lg text-sm text-theme-primary focus:outline-none focus:border-accent-blue-light resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-theme-tertiary/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-accent-blue-dark hover:bg-accent-blue-dark/80 text-white rounded-lg transition-colors shadow"
            >
              Create Spellbook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

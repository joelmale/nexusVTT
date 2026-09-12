import React, { useState, useMemo } from 'react';
import { XCircle } from 'lucide-react';
import { getCantripsByClass } from '../utils/srdLoader';

interface ChooseCantripModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterClass: string;
  knownCantrips: string[];
  onCantripSelected: (cantripSlug: string) => void;
}

export const ChooseCantripModal: React.FC<ChooseCantripModalProps> = ({
  isOpen,
  onClose,
  characterClass,
  knownCantrips,
  onCantripSelected,
}) => {
  const [selectedCantrip, setSelectedCantrip] = useState<string | null>(null);

  const availableCantrips = useMemo(() => {
    const allCantrips = getCantripsByClass(characterClass);
    return allCantrips.filter(cantrip => !knownCantrips.includes(cantrip.slug));
  }, [characterClass, knownCantrips]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (selectedCantrip) {
      onCantripSelected(selectedCantrip);
      setSelectedCantrip(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-theme-primary bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary rounded-2xl shadow-2xl w-full max-w-md transition-all transform duration-300 scale-100 flex flex-col max-h-[calc(100vh-4rem)]">
        <div className="flex-shrink-0 p-6 border-b border-accent-red-dark">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-red-500">Choose a New Cantrip</h2>
            <button onClick={onClose} className="text-theme-muted hover:text-white">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {availableCantrips.map(cantrip => (
              <button
                key={cantrip.slug}
                onClick={() => setSelectedCantrip(cantrip.slug)}
                className={`w-full p-4 rounded-lg text-left border-2 transition-all ${
                  selectedCantrip === cantrip.slug
                    ? 'bg-accent-blue-darker border-blue-500'
                    : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
                }`}
              >
                <h3 className="font-bold text-accent-yellow-light">{cantrip.name}</h3>
                <p className="text-sm text-theme-tertiary mt-1 line-clamp-2">{cantrip.description}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 p-6 border-t border-accent-red-dark">
          <button
            onClick={handleConfirm}
            disabled={!selectedCantrip}
            className="w-full py-3 bg-accent-green hover:bg-accent-green rounded-xl text-white font-bold transition-colors disabled:bg-theme-quaternary"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
};

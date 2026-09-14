import React from 'react';
import { X } from 'lucide-react';

interface DiceTrayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiceTrayModal: React.FC<DiceTrayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-theme-secondary rounded-xl shadow-2xl w-full max-w-2xl border border-accent-red-dark"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '800px', height: '800px' }}
      >
        <div className="p-6 border-b border-red-800 flex justify-between items-center">
          <h3 className="text-2xl font-bold text-accent-red-light">Dice Rolling Tray</h3>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <h4 className="text-xl font-semibold text-theme-tertiary mb-4">Future Dice Tray Implementation</h4>
            <p className="text-theme-muted">
              This modal will contain advanced dice rolling tools, custom dice sets,
              roll macros, and enhanced dice visualization features.
            </p>
            {/* TODO: Implement full dice tray functionality with:
              - Custom dice rolling interface
              - Dice set management
              - Roll history and statistics
              - Advanced dice notation support
              - 3D dice preview and customization
              - Integration with character sheet rolls
            */}
          </div>
        </div>
      </div>
    </div>
  );
};

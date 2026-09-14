import React from 'react';
import { X } from 'lucide-react';

interface SkillModalProps {
  skill: { name: string; description: string } | null;
  onClose: () => void;
}

export const SkillModal: React.FC<SkillModalProps> = ({ skill, onClose }) => {
  if (!skill) return null;

  return (
    <div className="fixed inset-0 bg-theme-primary bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-accent-yellow-light">{skill.name} Skill</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-theme-muted" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-theme-tertiary mb-2">Description</h3>
              <p className="text-theme-secondary leading-relaxed">{skill.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
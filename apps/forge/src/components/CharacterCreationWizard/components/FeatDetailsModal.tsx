import React from 'react';
import { X, Star, Sword, Zap, Heart, Eye, Users, Mountain } from 'lucide-react';
import { Feat } from '../../../types/dnd';

interface FeatDetailsModalProps {
  feat: Feat | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FeatDetailsModal: React.FC<FeatDetailsModalProps> = ({
  feat,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !feat) return null;

  const getFeatIcon = (feat: Feat) => {
    // Simple icon mapping based on feat name or properties
    if (feat.name.toLowerCase().includes('warrior') || feat.name.toLowerCase().includes('fighter')) {
      return <Sword className="w-6 h-6" />;
    }
    if (feat.name.toLowerCase().includes('spell') || feat.name.toLowerCase().includes('magic')) {
      return <Zap className="w-6 h-6" />;
    }
    if (feat.name.toLowerCase().includes('tough') || feat.name.toLowerCase().includes('durable')) {
      return <Heart className="w-6 h-6" />;
    }
    if (feat.name.toLowerCase().includes('perception') || feat.name.toLowerCase().includes('alert')) {
      return <Eye className="w-6 h-6" />;
    }
    if (feat.name.toLowerCase().includes('social') || feat.name.toLowerCase().includes('persuasion')) {
      return <Users className="w-6 h-6" />;
    }
    if (feat.name.toLowerCase().includes('athletics') || feat.name.toLowerCase().includes('climb')) {
      return <Mountain className="w-6 h-6" />;
    }
    return <Star className="w-6 h-6" />;
  };

  const getFeatTypeColor = (feat: Feat) => {
    if (feat.category === 'origin') return 'text-purple-400';
    if (feat.category === 'fighting_style') return 'text-red-400';
    if (feat.name.toLowerCase().includes('spell')) return 'text-blue-400';
    return 'text-green-400';
  };

  const formatPrerequisites = (feat: Feat) => {
    if (feat.prerequisites) {
      const prereqs = [];
      if (feat.prerequisites.level) prereqs.push(`Level ${feat.prerequisites.level}`);
      if (feat.prerequisites.stats) {
        const stats = Object.entries(feat.prerequisites.stats)
          .map(([ability, score]) => `${ability} ${score}`)
          .join(', ');
        prereqs.push(stats);
      }
      if (feat.prerequisites.features && feat.prerequisites.features.length > 0) {
        prereqs.push(feat.prerequisites.features.join(', '));
      }
      if (feat.prerequisites.spellcasting) prereqs.push('Spellcasting');
      return prereqs.join(', ');
    }
    return feat.prerequisite || 'None';
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <div className="flex items-center gap-3">
            <div className={getFeatTypeColor(feat)}>
              {getFeatIcon(feat)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-theme-primary">{feat.name}</h2>
              <p className="text-sm text-theme-muted capitalize">{feat.category.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Prerequisites */}
          <div className="bg-theme-tertiary/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Prerequisites</h3>
            <p className="text-sm text-theme-primary">{formatPrerequisites(feat)}</p>
          </div>

          {/* Description */}
          <div className="bg-theme-tertiary/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Description</h3>
            <p className="text-sm text-theme-primary leading-relaxed">{feat.description}</p>
          </div>

          {/* Benefits */}
          {feat.benefits && feat.benefits.length > 0 && (
            <div className="bg-theme-tertiary/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Benefits</h3>
              <ul className="text-sm text-theme-primary space-y-1">
                {feat.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-accent-yellow-light mr-2">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ability Score Increase */}
          {feat.abilityScoreIncrease && (
            <div className="bg-theme-tertiary/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Ability Score Increase</h3>
              <p className="text-sm text-theme-primary">
                Choose {feat.abilityScoreIncrease.choices} from: {feat.abilityScoreIncrease.options.join(', ')} (+{feat.abilityScoreIncrease.amount} each)
              </p>
            </div>
          )}

          {/* Source */}
          <div className="bg-theme-tertiary/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Source</h3>
            <p className="text-sm text-theme-primary">{feat.source} ({feat.year})</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end p-6 border-t border-theme-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
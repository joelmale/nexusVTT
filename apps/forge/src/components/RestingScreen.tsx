import React from 'react';
import { Moon, Heart, Zap, BookOpen, Swords } from 'lucide-react';

interface RestingScreenProps {
  type: 'short' | 'long';
  changes?: {
    hpRestored: number;
    hitDiceRestored: number;
    spellSlotsRestored: number;
    resourcesReset: string[];
  };
  onComplete?: () => void;
}

export const RestingScreen: React.FC<RestingScreenProps> = ({ type, changes, onComplete }) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const duration = type === 'long' ? 3000 : 1500; // 3 seconds for long rest, 1.5 for short
    const interval = 50;
    const steps = duration / interval;

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + (100 / steps);
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => onComplete?.(), 500); // Small delay before completion
          return 100;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [type, onComplete]);

  const getRestBenefits = () => {
    if (!changes) {
      // Fallback to generic benefits if no changes provided
      return type === 'long' ? [
        { icon: Heart, text: 'Restore all Hit Points', color: 'text-red-400' },
        { icon: Zap, text: 'Restore all Hit Dice', color: 'text-yellow-400' },
        { icon: BookOpen, text: 'Restore all Spell Slots', color: 'text-blue-400' },
        { icon: Swords, text: 'Reset Limited Abilities', color: 'text-green-400' }
      ] : [
        { icon: Heart, text: 'Restore HP with Hit Dice', color: 'text-red-400' },
        { icon: Swords, text: 'Reset some abilities', color: 'text-green-400' }
      ];
    }

    // Character-specific benefits
    const benefits = [];

    if (changes.hpRestored > 0) {
      benefits.push({
        icon: Heart,
        text: `Restored ${changes.hpRestored} Hit Points`,
        color: 'text-red-400'
      });
    }

    if (changes.hitDiceRestored > 0) {
      benefits.push({
        icon: Zap,
        text: `Restored ${changes.hitDiceRestored} Hit Dice`,
        color: 'text-yellow-400'
      });
    }

    if (changes.spellSlotsRestored > 0) {
      benefits.push({
        icon: BookOpen,
        text: `Restored ${changes.spellSlotsRestored} Spell Slots`,
        color: 'text-blue-400'
      });
    }

    if (changes.resourcesReset.length > 0) {
      benefits.push({
        icon: Swords,
        text: `Reset ${changes.resourcesReset.length} Abilities`,
        color: 'text-green-400',
        details: changes.resourcesReset
      });
    }

    // If no changes occurred, show a message
    if (benefits.length === 0) {
      benefits.push({
        icon: Heart,
        text: 'Already fully rested',
        color: 'text-green-400'
      });
    }

    return benefits;
  };

  const restBenefits = getRestBenefits();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg p-8 max-w-md w-full mx-4 text-center">
        {/* Resting Icon */}
        <div className="mb-6">
          <Moon className="w-16 h-16 text-theme-primary mx-auto animate-pulse" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-theme-primary mb-2">
          Taking a {type === 'long' ? 'Long' : 'Short'} Rest
        </h2>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-theme-tertiary rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-theme-primary to-accent-green transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm text-theme-muted mt-2">
            {Math.round(progress)}% complete
          </div>
        </div>

        {/* Benefits List */}
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold text-theme-primary mb-3">
            Restoring...
          </h3>
           {restBenefits.map((benefit, index) => (
             <div
               key={index}
               className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-500 ${
                 progress > (index * 25) ? 'bg-theme-tertiary opacity-100 fade-in' : 'opacity-50'
               }`}
               style={{
                 animationDelay: `${index * 200}ms`
               }}
             >
               <benefit.icon className={`w-5 h-5 ${benefit.color}`} />
               <div className="flex-1">
                 <span className="text-sm text-theme-primary">{benefit.text}</span>
                 {benefit.details && benefit.details.length > 0 && (
                   <div className="text-xs text-theme-muted mt-1 ml-2">
                     {benefit.details.join(', ')}
                   </div>
                 )}
               </div>
             </div>
           ))}
        </div>

        {/* Resting Message */}
        <div className="text-sm text-theme-muted italic">
          {type === 'long'
            ? "A good night's sleep restores the body and refreshes the mind..."
            : "A moment of respite helps recover from recent exertions..."
          }
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
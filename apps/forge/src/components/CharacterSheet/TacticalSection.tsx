import React, { useMemo, useState } from 'react';
import { TacticalCard } from './TacticalCard';

interface TacticalAction {
  id: string;
  name: string;
  type: 'weapon-attack' | 'spell-attack' | 'unarmed-attack' | 'special-attack' | 'defensive' | 'movement' | 'support' | 'stealth' | 'healing' | 'action-surge' | 'reaction-setup';
  description: string;
  actionCost: 'Action' | 'Bonus Action' | 'Free' | 'Reaction';
  hasButton: boolean;
  buttonText?: string;
  category: 'offense' | 'defense' | 'mobility' | 'burst';
  isLimited?: boolean;
  usesRemaining?: number;
  maxUses?: number;
  specialUI?: 'bubble-display';
}

interface TacticalSectionProps {
  icon: string;
  title: string;
  theme: 'red' | 'blue' | 'green' | 'orange' | 'purple';
  actions: TacticalAction[];
  onAction?: (actionId: string) => void;
  layoutMode?: 'paper-sheet' | 'classic-dnd' | 'modern';
}

export const TacticalSection: React.FC<TacticalSectionProps> = ({
  icon, title, theme, actions, onAction, layoutMode
}) => {
  const isPaperSheet = layoutMode === 'paper-sheet';
  const isClassic = layoutMode === 'classic-dnd';
  const [expanded, setExpanded] = useState(true);

  // Precompute a reasonable max height for transition to avoid layout jank
  const maxHeight = useMemo(() => {
    // Roughly 120px per row of cards (2 per row on md+)
    const rows = Math.ceil(actions.length / 2);
    return rows * 140 + 60; // include header padding
  }, [actions.length]);

  if (actions.length === 0) return null;

  // Get theme classes based on layout mode
  const getThemeClasses = (themeColor: 'red' | 'blue' | 'green' | 'orange' | 'purple') => {
    if (isPaperSheet) {
      const paperThemes = {
        red: 'border-l-4 border-red-900/60 bg-[#f5ebd2]',
        blue: 'border-l-4 border-blue-900/60 bg-[#f5ebd2]',
        green: 'border-l-4 border-green-900/60 bg-[#f5ebd2]',
        orange: 'border-l-4 border-orange-900/60 bg-[#f5ebd2]',
        purple: 'border-l-4 border-purple-900/60 bg-[#f5ebd2]',
      };
      return paperThemes[themeColor];
    }

    if (isClassic) {
      const classicThemes = {
        red: 'border-l-4 border-accent-red bg-gradient-to-br from-theme-secondary/70 via-theme-tertiary/50 to-theme-secondary/70 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-xl',
        blue: 'border-l-4 border-accent-blue bg-gradient-to-br from-theme-secondary/70 via-theme-tertiary/50 to-theme-secondary/70 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-xl',
        green: 'border-l-4 border-accent-green bg-gradient-to-br from-theme-secondary/70 via-theme-tertiary/50 to-theme-secondary/70 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-xl',
        orange: 'border-l-4 border-accent-yellow bg-gradient-to-br from-theme-secondary/70 via-theme-tertiary/50 to-theme-secondary/70 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-xl',
        purple: 'border-l-4 border-accent-purple bg-gradient-to-br from-theme-secondary/70 via-theme-tertiary/50 to-theme-secondary/70 shadow-[0_8px_24px_rgba(0,0,0,0.35)] rounded-xl',
      };
      return classicThemes[themeColor];
    }

    const darkThemes = {
      red: 'border-l-4 border-red-500 bg-gradient-to-br from-theme-secondary/60 via-theme-tertiary/40 to-theme-secondary/60 rounded-xl',
      blue: 'border-l-4 border-blue-500 bg-gradient-to-br from-theme-secondary/60 via-theme-tertiary/40 to-theme-secondary/60 rounded-xl',
      green: 'border-l-4 border-green-500 bg-gradient-to-br from-theme-secondary/60 via-theme-tertiary/40 to-theme-secondary/60 rounded-xl',
      orange: 'border-l-4 border-orange-500 bg-gradient-to-br from-theme-secondary/60 via-theme-tertiary/40 to-theme-secondary/60 rounded-xl',
      purple: 'border-l-4 border-purple-500 bg-gradient-to-br from-theme-secondary/60 via-theme-tertiary/40 to-theme-secondary/60 rounded-xl',
    };
    return darkThemes[themeColor];
  };

  const headerTextClass = isPaperSheet ? 'text-[#1e140a]' : 'text-theme-primary';
  const headerSubtleClass = isPaperSheet ? 'text-[#3d2817]' : 'text-theme-muted';

  return (
    <section className={`p-4 pl-5 transition-all duration-200 ${getThemeClasses(theme)}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold rounded"
        aria-expanded={expanded}
        onClick={() => setExpanded(prev => !prev)}
      >
        <h3 className={`text-lg font-bold flex items-center gap-2 ${headerTextClass}`}>
          <span className="text-xl">{icon}</span>
          {title}
        </h3>
        <div className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${headerSubtleClass}`}>
          <span className="mr-2">Core Actions</span>
          <span className="inline-block transform transition-transform duration-200" style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            ▼
          </span>
        </div>
      </button>

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-3 transition-all duration-300 ease-out overflow-hidden"
        style={{
          maxHeight: expanded ? `${maxHeight}px` : '0px',
          opacity: expanded ? 1 : 0,
          paddingTop: expanded ? '0.25rem' : 0,
          paddingBottom: expanded ? '0.25rem' : 0
        }}
      >
        {actions.map(action => (
          <TacticalCard
            key={action.id}
            action={action}
            onAction={onAction}
            theme={action.isLimited ? 'accent' : 'standard'}
            layoutMode={layoutMode}
          />
        ))}
      </div>
    </section>
  );
};

import React from 'react';

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

interface TacticalCardProps {
  action: TacticalAction;
  onAction?: (actionId: string) => void;
  theme?: 'standard' | 'accent';
  layoutMode?: 'paper-sheet' | 'classic-dnd' | 'modern';
}

export const TacticalCard: React.FC<TacticalCardProps> = ({ action, onAction, theme = 'standard', layoutMode }) => {
  const isAccent = theme === 'accent' || action.isLimited;
  const isPaperSheet = layoutMode === 'paper-sheet';
  const isClassic = layoutMode === 'classic-dnd';

  // Card background colors
  const standardBgClass = isPaperSheet
    ? 'bg-[#fcf6e3] hover:bg-[#ebe1c8] border-[#1e140a]/20'
    : isClassic
      ? 'bg-gradient-to-br from-theme-secondary/80 to-theme-tertiary/70 hover:from-theme-secondary hover:to-theme-tertiary border-theme-border shadow-[0_6px_18px_rgba(0,0,0,0.25)]'
      : 'bg-theme-tertiary hover:bg-theme-quaternary border-theme-primary/20';

  const accentBgClass = isPaperSheet
    ? 'bg-[#8b4513] hover:bg-[#a0522d] border-[#1e140a] text-[#fcf6e3]'
    : isClassic
      ? 'bg-gradient-to-br from-accent-red to-accent-red-dark border-accent-red-dark text-white shadow-[0_8px_20px_rgba(185,28,28,0.45)]'
      : 'bg-orange-700 hover:bg-orange-600 border-orange-500 text-white';

  // Text colors
  const textPrimaryClass = isPaperSheet ? 'text-[#1e140a]' : 'text-theme-primary';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _textMutedClass = isPaperSheet ? 'text-[#3d2817]' : 'text-theme-muted';

  // Button colors
  const buttonClass = isPaperSheet
    ? 'bg-[#8b4513] hover:bg-[#a0522d] text-[#fcf6e3]'
    : isClassic
      ? 'bg-accent-red hover:bg-accent-red-dark text-white shadow-[0_4px_12px_rgba(185,28,28,0.35)]'
      : 'bg-theme-primary hover:bg-theme-primary/80 text-theme-secondary';

  // Action badge colors
  const getActionBadgeClass = (cost: string) => {
    if (isPaperSheet) {
      const paperBadges: Record<string, string> = {
        'Action': 'bg-red-900/80 text-[#fcf6e3] border border-red-800',
        'Bonus Action': 'bg-blue-900/80 text-[#fcf6e3] border border-blue-800',
        'Free': 'bg-green-900/80 text-[#fcf6e3] border border-green-800',
        'Reaction': 'bg-gray-700/80 text-[#fcf6e3] border border-gray-600',
      };
      return paperBadges[cost] || paperBadges['Action'];
    }

    const darkBadges: Record<string, string> = {
      'Action': 'bg-red-500 text-white',
      'Bonus Action': 'bg-blue-500 text-white',
      'Free': 'bg-green-500 text-white',
      'Reaction': 'bg-gray-500 text-white',
    };
    return darkBadges[cost] || darkBadges['Action'];
  };

  // Bubble colors
  const activeBubbleClass = isPaperSheet
    ? 'bg-[#8b4513] border-[#1e140a]'
    : isClassic
      ? 'bg-accent-red border-red-500'
      : 'bg-accent-red-light border-red-400';

  const inactiveBubbleClass = isPaperSheet
    ? 'bg-[#d4c4a8] border-[#8b7355]'
    : isClassic
      ? 'bg-theme-tertiary border-theme-border'
      : 'bg-gray-600 border-gray-500';

  const cardClasses = isAccent ? accentBgClass : standardBgClass;
  const cardTextClass = isAccent && !isPaperSheet ? 'text-white' : textPrimaryClass;

  const typeBadge = (() => {
    const palette = (() => {
      if (isPaperSheet) {
        return {
          attack: 'bg-[#8b4513]/15 text-[#3d2817] border-[#8b4513]/40',
          defense: 'bg-[#1e3a8a]/15 text-[#1e140a] border-[#1e3a8a]/30',
          move: 'bg-[#166534]/15 text-[#1e140a] border-[#166534]/30',
          support: 'bg-[#b45309]/15 text-[#1e140a] border-[#b45309]/30',
          reaction: 'bg-[#6b21a8]/15 text-[#1e140a] border-[#6b21a8]/30',
        };
      }
      if (isClassic) {
        return {
          attack: 'bg-red-500/15 text-red-100 border-red-500/40',
          defense: 'bg-blue-500/15 text-blue-100 border-blue-500/40',
          move: 'bg-green-500/15 text-green-100 border-green-500/40',
          support: 'bg-yellow-500/15 text-yellow-100 border-yellow-500/40',
          reaction: 'bg-purple-500/15 text-purple-100 border-purple-500/40',
        };
      }
      return {
        attack: 'bg-red-500/20 text-red-200 border-red-500/50',
        defense: 'bg-blue-500/20 text-blue-200 border-blue-500/50',
        move: 'bg-green-500/20 text-green-200 border-green-500/50',
        support: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50',
        reaction: 'bg-purple-500/20 text-purple-200 border-purple-500/50',
      };
    })();

    if (action.type === 'weapon-attack' || action.type === 'unarmed-attack' || action.type === 'spell-attack') return { label: 'Attack', color: palette.attack };
    if (action.type === 'defensive') return { label: 'Defense', color: palette.defense };
    if (action.type === 'movement' || action.type === 'stealth') return { label: 'Move', color: palette.move };
    if (action.type === 'support' || action.type === 'healing') return { label: 'Support', color: palette.support };
    if (action.type === 'action-surge' || action.type === 'reaction-setup') return { label: 'Reaction', color: palette.reaction };
    return null;
  })();

  return (
    <div className={`rounded-xl border-2 p-3 transition-all duration-200 ${cardClasses}`}>
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-sm ${cardTextClass}`}>{action.name}</h4>
          {typeBadge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeBadge.color}`}>
              {typeBadge.label}
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${getActionBadgeClass(action.actionCost)}`}>
          {action.actionCost}
        </span>
      </div>

      {/* Body Row */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-xs opacity-80 leading-tight ${cardTextClass}`}>{action.description}</p>
          {action.isLimited && (
            <p className={`text-xs opacity-60 mt-1 ${cardTextClass}`}>
              {action.usesRemaining}/{action.maxUses} uses
            </p>
          )}
        </div>

        {action.hasButton && (
          <button
            onClick={() => onAction?.(action.id)}
            className={`ml-3 px-3 py-1 rounded text-xs font-medium transition-colors ${buttonClass}`}
          >
            {action.buttonText}
          </button>
        )}
      </div>

      {/* Special UI for Action Surge */}
      {action.specialUI === 'bubble-display' && action.isLimited && action.maxUses && (
        <div className="mt-2 flex gap-1 justify-center">
          {Array.from({ length: action.maxUses }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border ${
                i < (action.usesRemaining || 0)
                  ? activeBubbleClass
                  : inactiveBubbleClass
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

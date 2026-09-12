import React, { useState } from 'react';
import { Dice6, Sparkles, Info } from 'lucide-react';
import { rollRandomTrinket } from '../../../utils/trinketUtils';
import { TrinketData } from '../../../types/dnd';

interface TrinketRollerProps {
  onTrinketSelected: (trinket: TrinketData) => void;
  initialTrinket?: TrinketData | null;
}

export const TrinketRoller: React.FC<TrinketRollerProps> = ({
  onTrinketSelected,
  initialTrinket = null
}) => {
  const [useExtended, setUseExtended] = useState(false);
  const [rolledTrinket, setRolledTrinket] = useState<TrinketData | null>(initialTrinket);
  const [isRolling, setIsRolling] = useState(false);

  const rollTrinket = async () => {
    setIsRolling(true);

    // Add a small delay for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 500));

    const trinket = rollRandomTrinket(useExtended);
    setRolledTrinket(trinket);
    onTrinketSelected(trinket);

    setIsRolling(false);
  };

  return (
    <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-purple-light" />
          <h4 className="font-semibold text-accent-purple-light">Roll for Trinket</h4>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center space-x-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={useExtended}
              onChange={(e) => setUseExtended(e.target.checked)}
              className="w-4 h-4 text-accent-purple bg-theme-tertiary border-theme-primary rounded focus:ring-accent-purple focus:ring-2"
            />
            <span className="text-theme-tertiary">Extended Trinkets</span>
            <div
              className="w-4 h-4 text-theme-muted cursor-help"
              title="Includes additional trinkets from The Wild Beyond the Witchlight"
            >
              <Info className="w-4 h-4" />
            </div>
          </label>
        </div>
      </div>

      <p className="text-xs text-theme-muted">
        Optionally roll for a trinket from the Player's Handbook.
        {useExtended && " Extended trinkets include additional items from adventure modules."}
      </p>

      {/* Roll Button */}
      <button
        onClick={rollTrinket}
        disabled={isRolling}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-accent-purple hover:bg-accent-purple-light disabled:bg-theme-quaternary disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
      >
        <Dice6 className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
        <span>
          {isRolling ? 'Rolling...' : `Roll d${useExtended ? '200' : '100'}`}
        </span>
      </button>

      {/* Rolled Trinket Display */}
      {rolledTrinket && (
        <div className="bg-theme-secondary/50 border border-theme-primary rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h5 className="font-semibold text-accent-yellow-light text-lg mb-1">
                {rolledTrinket.short_name}
              </h5>
              <div className="flex items-center gap-2 text-xs text-theme-muted mb-2">
                <span>Roll: {rolledTrinket.roll}</span>
                <span>•</span>
                <span>{rolledTrinket.source}</span>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-accent-purple-light flex-shrink-0" />
          </div>

          <p className="text-sm text-theme-tertiary leading-relaxed">
            {rolledTrinket.description}
          </p>

          {rolledTrinket.roleplay_prompt && (
            <div className="border-t border-theme-primary pt-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-accent-blue-light flex-shrink-0 mt-0.5" />
                <p className="text-xs text-accent-blue-light italic leading-relaxed">
                  {rolledTrinket.roleplay_prompt}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {!rolledTrinket && (
        <div className="text-center py-4">
          <Sparkles className="w-8 h-8 text-theme-muted mx-auto mb-2 opacity-50" />
          <p className="text-xs text-theme-disabled">
            No trinket rolled yet. Click the button above to roll for a random trinket!
          </p>
        </div>
      )}
    </div>
  );
};
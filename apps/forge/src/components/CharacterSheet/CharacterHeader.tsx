import React, { useState } from 'react';
import { Trash2, Tent, TrendingUp, TrendingDown, Dice6, Edit3 } from 'lucide-react';
import { Character } from '../../types/dnd';
import { LayoutSelector } from './LayoutSelector';

interface CharacterHeaderProps {
  character: Character;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit?: () => void;
  onShortRest: (id: string) => void;
  onLongRest: (id: string) => void;
  onLevelUp: (id: string) => void;
  onLevelDown: (id: string) => void;
  onOpenDiceTray?: () => void;
}

export const CharacterHeader: React.FC<CharacterHeaderProps> = ({
  character,
  onClose,
  onDelete,
  onEdit,
  onShortRest,
  onLongRest,
  onLevelUp,
  onLevelDown,
  onOpenDiceTray
}) => {
  const [rollOnSheet, setRollOnSheet] = useState(false);
  return (
    <>
      {/* Header and Controls */}
      <div className="flex justify-between items-center border-b border-accent-red-dark pb-3 gap-4">
        {/* Player Name and Details */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-serif font-bold text-accent-red-light font-handwriting">
            {character.name}
          </h1>
          <div className="text-sm text-theme-tertiary">
            {character.species} {character.class} • Level {character.level}
            {character.selectedSpeciesVariant && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-accent-blue-darker text-xs font-semibold text-blue-100 border border-accent-blue-dark">
                {character.selectedSpeciesVariant}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Dice Rolling Tray Section */}
           <div className="flex flex-col items-center gap-1" style={{ paddingRight: '160px' }}>
              <button
                onClick={() => {
                  if (onOpenDiceTray) {
                    onOpenDiceTray();
                  }
                }}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                title="Open Dice Rolling Tray"
              >
               <Dice6 className="w-4 h-4" />
               Dice Rolling Tray
             </button>
             <label className="flex items-center gap-1 text-xs text-theme-tertiary">
               <input
                 type="checkbox"
                 checked={rollOnSheet}
                 onChange={(e) => setRollOnSheet(e.target.checked)}
                 className="w-3 h-3 text-indigo-600 bg-theme-tertiary border-theme-primary rounded focus:ring-indigo-500"
               />
               Roll on sheet
               {/* TODO: Implement functionality to turn on/off character sheet rolls */}
             </label>
           </div>

           <LayoutSelector />

            <div className="grid grid-cols-2 gap-2">
             {onEdit && (
               <button
                 onClick={onEdit}
                 className="px-2 py-2 bg-accent-yellow hover:bg-accent-yellow-light rounded-lg transition-colors flex items-center justify-center"
                 title="Edit character details"
               >
                 <Edit3 className="w-5 h-5 text-white" />
               </button>
             )}
             <button
               onClick={() => onShortRest(character.id)}
               className="px-2 py-2 bg-accent-blue hover:bg-accent-blue-light rounded-lg transition-colors flex items-center justify-center"
               title="Take a Short Rest (recover HP with hit dice)"
             >
               <Tent className="w-5 h-5 text-white" />
             </button>
               <button
                 onClick={() => {
                   onLongRest(character.id);
                 }}
                 className="px-2 py-2 bg-accent-green hover:bg-accent-green rounded-lg transition-colors flex items-center justify-center"
                 title="Take a Long Rest (recover all HP and spell slots)"
               >
                <Tent className="w-5 h-5 text-white" />
              </button>
             <button
               onClick={() => onLevelUp(character.id)}
               className="px-2 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg transition-colors flex items-center justify-center"
               title="Level up your character"
             >
               <TrendingUp className="w-5 h-5 text-white" />
             </button>
            {onLevelDown && (
              <button
                onClick={() => onLevelDown(character.id)}
                className="px-2 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors flex items-center justify-center"
                title="Level down your character (debug)"
              >
                <TrendingDown className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
          <div className="flex space-x-3 ml-4">
            <button onClick={onClose} className="px-4 py-2 text-sm bg-theme-tertiary hover:bg-theme-quaternary rounded-lg transition-colors font-medium">Back to List</button>
            <button onClick={() => onDelete(character.id)} className="px-2 py-2 bg-accent-red-darker hover:bg-accent-red-dark rounded-lg transition-colors" title="Delete Character"><Trash2 className="w-5 h-5 text-white" /></button>
          </div>
        </div>
      </div>
    </>
  );
};

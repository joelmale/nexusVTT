import React from 'react';
import { NPC } from '../../types/dnd';

interface NPCListProps {
  npcs: NPC[];
  onSelectNPC?: (npc: NPC) => void;
  onEditNPC?: (npc: NPC) => void;
  onDeleteNPC?: (id: string) => void;
}

export const NPCList: React.FC<NPCListProps> = ({ npcs, onSelectNPC, onEditNPC, onDeleteNPC }) => {
  if (npcs.length === 0) {
    return (
      <div className="text-center p-12 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-secondary">
        <div className="text-6xl mb-4">🧙‍♂️</div>
        <p className="text-xl font-semibold text-theme-muted">No NPCs found</p>
        <p className="text-theme-disabled">Create your first NPC to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {npcs.map((npc) => (
        <div key={npc.id} className="bg-theme-secondary rounded-xl shadow-xl hover:shadow-purple-700/30 transition-shadow duration-300 overflow-hidden">
          <div className="p-5">
            <h3 className="text-2xl font-bold text-accent-purple-light truncate">{npc.name}</h3>
            <p className="text-sm text-theme-muted mb-3">{npc.species} | {npc.occupation}</p>

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-medium bg-theme-tertiary/50 p-3 rounded-lg mb-4">
              <div>Alignment: <span className="text-accent-yellow-light block text-sm font-bold">{npc.alignment}</span></div>
              <div>Traits: <span className="text-accent-green-light block text-sm font-bold">{npc.personalityTraits.length}</span></div>
            </div>

            <div className="flex justify-between items-center mt-4 space-x-3">
              {onSelectNPC && (
                <button
                  onClick={() => onSelectNPC(npc)}
                  className="flex-grow py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
                >
                  View Details
                </button>
              )}
              <div className="flex space-x-2">
                {onEditNPC && (
                  <button
                    onClick={() => onEditNPC(npc)}
                    className="p-2 bg-theme-quaternary hover:bg-accent-purple-dark rounded-lg transition-colors"
                    title="Edit NPC"
                  >
                    ✏️
                  </button>
                )}
                {onDeleteNPC && (
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${npc.name}?`)) {
                        onDeleteNPC(npc.id);
                      }
                    }}
                    className="p-2 bg-theme-quaternary hover:bg-accent-red-dark rounded-lg transition-colors"
                    title="Delete NPC"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
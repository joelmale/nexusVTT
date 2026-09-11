import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNPCContext } from '../../hooks/useNPCContext';
import { NPCList } from './NPCList';
import { NPCFilters } from './NPCFilters';
import { CreateNPCModal } from './CreateNPCModal';
import { NPCStatBlock } from './NPCStatBlock';
import { NPC } from '../../types/dnd';

interface NPCLibraryProps {
  onSelectNPC?: (npc: NPC) => void;
}

export const NPCLibrary: React.FC<NPCLibraryProps> = ({ onSelectNPC }) => {
  const {
    filteredNPCs,
    loading,
    error,
    filters,
    setFilters,
    clearFilters,
    deleteNPC: deleteNPCFromContext,
  } = useNPCContext();

  const [showCreateNPC, setShowCreateNPC] = useState(false);
  const [editingNPC, setEditingNPC] = useState<NPC | null>(null);
  const [viewingNPC, setViewingNPC] = useState<NPC | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🧙‍♂️</div>
          <div className="text-xl">Loading NPC Library...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold text-theme-primary">NPC Library</h1>
            <p className="text-gray-600 mt-2">
              {filteredNPCs.length} npc{filteredNPCs.length !== 1 ? 's' : ''} available
            </p>
          </div>

          <button
            onClick={() => setShowCreateNPC(true)}
            className="px-4 py-2 bg-accent-purple text-white rounded-lg hover:bg-accent-purple-dark transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Create NPC
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <NPCFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={clearFilters}
        />
      </div>

      {/* NPC List */}
      <NPCList
        npcs={filteredNPCs}
        onSelectNPC={(npc: NPC) => {
          if (onSelectNPC) {
            onSelectNPC(npc);
          } else {
            setViewingNPC(npc);
          }
        }}
        onEditNPC={(npc: NPC) => {
          setEditingNPC(npc);
          setShowCreateNPC(true);
        }}
        onDeleteNPC={deleteNPCFromContext}
      />

      {/* Create/Edit NPC Modal */}
      <CreateNPCModal
        isOpen={showCreateNPC || editingNPC !== null}
        onClose={() => {
          setShowCreateNPC(false);
          setEditingNPC(null);
        }}
        editingNPC={editingNPC}
      />

      {/* NPC Detail View Modal */}
      {viewingNPC && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <NPCStatBlock
            npc={viewingNPC}
            onClose={() => setViewingNPC(null)}
          />
        </div>
      )}
    </div>
  );
};
import React from 'react';
import { Trash2, Eye, Calendar, Share2 } from 'lucide-react';
import { useMonsterContext } from '../../hooks';

interface SavedEncountersListProps {
  onStartCombat?: (encounterId: string) => void;
}

export const SavedEncountersList: React.FC<SavedEncountersListProps> = ({ onStartCombat }) => {
  const { encounters, loadEncounter, deleteEncounterById, allMonsters } = useMonsterContext();

  const handleLoad = async (encounterId: string) => {
    if (onStartCombat) {
      onStartCombat(encounterId);
    } else {
      // Fallback to original behavior if no callback provided
      await loadEncounter(encounterId);
    }
  };

  const handleDelete = async (encounterId: string, encounterName: string) => {
    if (window.confirm(`Delete encounter "${encounterName}"? This action cannot be undone.`)) {
      await deleteEncounterById(encounterId);
    }
  };

  const handleShare = async (encounterId: string, encounterName: string) => {
    const shareUrl = `${window.location.origin}/encounter/${encounterId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(`Encounter "${encounterName}" link copied to clipboard!\n${shareUrl}`);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Encounter "${encounterName}" link copied to clipboard!\n${shareUrl}`);
    }
  };

  const getEncounterSummary = (monsterIds: string[]): string => {
    // Count unique monsters
    const monsterCounts = new Map<string, number>();
    monsterIds.forEach((id) => {
      monsterCounts.set(id, (monsterCounts.get(id) || 0) + 1);
    });

    // Get monster names
    const monsterNames: string[] = [];
    monsterCounts.forEach((count, monsterId) => {
      const monster = allMonsters.find((m) => m.index === monsterId);
      if (monster) {
        monsterNames.push(count > 1 ? `${monster.name} x${count}` : monster.name);
      }
    });

    if (monsterNames.length === 0) return 'No monsters';
    if (monsterNames.length <= 3) return monsterNames.join(', ');
    return `${monsterNames.slice(0, 3).join(', ')} +${monsterNames.length - 3} more`;
  };

  if (encounters.length === 0) {
    return (
      <div className="text-center p-8 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-secondary">
        <div className="text-4xl mb-3">📖</div>
        <p className="text-theme-muted">No saved encounters yet</p>
        <p className="text-sm text-theme-disabled mt-2">
          Create an encounter by selecting monsters and clicking "Save Encounter"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {encounters.map((encounter) => (
        <div
          key={encounter.id}
          className="bg-theme-secondary rounded-lg p-4 hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-grow">
              <h3 className="text-lg font-bold text-theme-primary mb-1">{encounter.name}</h3>
              <p className="text-sm text-theme-muted mb-2">{getEncounterSummary(encounter.monsterIds)}</p>
              <div className="flex items-center gap-2 text-xs text-theme-disabled">
                <Calendar className="w-3 h-3" />
                <span>Created {new Date(encounter.createdAt).toLocaleDateString()}</span>
                <span className="mx-2">•</span>
                <span>{encounter.monsterIds.length} monster{encounter.monsterIds.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleLoad(encounter.id)}
                className="p-2 bg-accent-purple hover:bg-purple-700 rounded-lg transition-colors"
                title="Load encounter"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleShare(encounter.id, encounter.name)}
                className="p-2 bg-accent-blue hover:bg-accent-blue-dark rounded-lg transition-colors"
                title="Share encounter link"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(encounter.id, encounter.name)}
                className="p-2 bg-accent-red hover:bg-accent-red-dark rounded-lg transition-colors"
                title="Delete encounter"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

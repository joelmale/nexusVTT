import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MonsterStatBlock } from './MonsterStatBlock';
import { Monster, UserMonster } from '../../types/dnd';
import { useMonsterManagement } from '../../hooks/useMonsterManagement';
import { generateMonsterSlug, isCustomMonsterId, getCustomMonsterDbId } from '../../utils/monsterUtils';

const EmbeddableMonsterPage: React.FC = () => {
  const { monsterId } = useParams<{ monsterId: string }>();
  const { srdMonsters, customMonsters } = useMonsterManagement();
  const [monster, setMonster] = useState<Monster | UserMonster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMonster = async () => {
      if (!monsterId) {
        setError('No monster ID provided');
        setLoading(false);
        return;
      }

      try {
        let foundMonster: Monster | UserMonster | undefined;

        if (isCustomMonsterId(monsterId)) {
          // Custom monster
          const dbId = getCustomMonsterDbId(monsterId);
          foundMonster = customMonsters.find((m: UserMonster) => m.id === dbId);
        } else {
          // SRD monster - try slug match first, then exact name match
          foundMonster = srdMonsters.find((m: Monster) => generateMonsterSlug(m.name) === monsterId);
          if (!foundMonster) {
            foundMonster = srdMonsters.find((m: Monster) => m.name.toLowerCase() === monsterId.replace(/-/g, ' '));
          }
        }

        if (foundMonster) {
          setMonster(foundMonster);
        } else {
          setError('Monster not found');
        }
      } catch {
        setError('Failed to load monster data');
      } finally {
        setLoading(false);
      }
    };

    loadMonster();
  }, [monsterId, srdMonsters, customMonsters]);

  if (loading) {
    return (
      <div className="iframe-embeddable min-h-screen bg-theme-primary text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-red-light mx-auto mb-4"></div>
          <p>Loading monster...</p>
        </div>
      </div>
    );
  }

  if (error || !monster) {
    return (
      <div className="iframe-embeddable min-h-screen bg-theme-primary text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-accent-red-light mb-4">Monster Not Found</h1>
          <p className="text-theme-muted">{error || 'The requested monster could not be found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="iframe-embeddable min-h-screen bg-theme-primary text-white">
      <MonsterStatBlock
        monster={monster}
        onClose={() => window.close()} // Close window if opened in popup, or go back in history
        onEdit={undefined} // No edit functionality in embeddable view
      />
    </div>
  );
};

export default EmbeddableMonsterPage;
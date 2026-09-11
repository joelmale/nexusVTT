import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMonsterManagement } from '../../hooks/useMonsterManagement';
import { Encounter } from '../../types/dnd';

const EmbeddableEncounterPage: React.FC = () => {
  const { encounterId } = useParams<{ encounterId: string }>();
  const { loadEncounter, encounters } = useMonsterManagement();
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEncounterData = async () => {
      if (!encounterId) {
        setError('No encounter ID provided');
        setLoading(false);
        return;
      }

      try {
        // Try to find in existing encounters first
        const existingEncounter = encounters.find(e => e.id === encounterId);
        if (existingEncounter) {
          setEncounter(existingEncounter);
        } else {
          // Try to load from database
          await loadEncounter(encounterId);
          const loadedEncounter = encounters.find(e => e.id === encounterId);
          if (loadedEncounter) {
            setEncounter(loadedEncounter);
          } else {
            setError('Encounter not found');
          }
        }
      } catch {
        setError('Failed to load encounter');
      } finally {
        setLoading(false);
      }
    };

    loadEncounterData();
  }, [encounterId, loadEncounter, encounters]);

  if (loading) {
    return (
      <div className="iframe-embeddable min-h-screen bg-theme-primary text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-red-light mx-auto mb-4"></div>
          <p>Loading encounter...</p>
        </div>
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div className="iframe-embeddable min-h-screen bg-theme-primary text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-accent-red-light mb-4">Encounter Not Found</h1>
          <p className="text-theme-muted">{error || 'The requested encounter could not be found.'}</p>
          <p className="text-sm text-theme-disabled mt-2">
            Try opening this link in the main application to create or load encounters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="iframe-embeddable min-h-screen bg-theme-primary text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-accent-red-light mb-6">{encounter.name}</h1>
        <div className="bg-theme-secondary rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Encounter Details</h2>
          <p className="text-theme-muted mb-4">
            Created: {new Date(encounter.createdAt).toLocaleDateString()}
          </p>
          <p className="text-theme-muted mb-4">
            Monsters: {encounter.monsterIds.length}
          </p>
          <div className="text-center text-theme-disabled">
            <p>This is a read-only encounter view.</p>
            <p>Open in the main application for full combat functionality.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddableEncounterPage;
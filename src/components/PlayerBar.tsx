import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import {
  applyCampaignBackupAssets,
  buildCampaignBackup,
  buildCampaignBackupFilename,
  downloadCampaignBackup,
  parseCampaignBackup,
} from '@/services/campaignBackup';
import { tokenAssetManager } from '@/services/tokenAssets';
import { propAssetManager } from '@/services/propAssets';

export const PlayerBar: React.FC = () => {
  const { session, user } = useGameStore();

  if (!session) return null;

  const currentPlayer = session.players?.find((player) => player.id === user.id);
  const otherPlayers = (session.players ?? []).filter(
    (player) => player.id !== user.id,
  );

  return (
    <div className="player-bar">
      <div className="connected-players">
        {currentPlayer && (
          <div key={currentPlayer.id} className="player-indicator current-user">
            <span className="player-avatar">
              {currentPlayer.name[0].toUpperCase()}
            </span>
            <span className="player-name">{currentPlayer.name}</span>
            {currentPlayer.type === 'host' && (
              <span className="host-badge">DM</span>
            )}
          </div>
        )}

        {otherPlayers.map((player) => (
          <div key={player.id} className="player-indicator">
            <span className="player-avatar">
              {player.name[0].toUpperCase()}
            </span>
            <span className="player-name">{player.name}</span>
            {player.type === 'host' && <span className="host-badge">DM</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export const PlayerActions: React.FC = () => {
  const { session, user, sceneState, gameConfig, replaceScenesFromBackup } =
    useGameStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!session || user.type !== 'host') return null;

  const persistCampaignScenes = async (scenes: unknown[]) => {
    if (!session.campaignId) return;
    const response = await fetch(`/api/campaigns/${session.campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scenes }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save campaign');
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const backup = buildCampaignBackup({
        scenes: sceneState.scenes,
        activeSceneId: sceneState.activeSceneId,
        campaign: {
          id: session.campaignId,
          name: gameConfig?.name,
          description: gameConfig?.description,
        },
      });

      downloadCampaignBackup(
        backup,
        buildCampaignBackupFilename(gameConfig?.name),
      );
      await persistCampaignScenes(backup.scenes);
      console.log('💾 Campaign backup exported');
    } catch (error) {
      console.error('Failed to export campaign backup:', error);
      alert('Failed to export campaign backup. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async () => {
    if (isLoading) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setIsLoading(true);
      try {
        const backup = await parseCampaignBackup(file);
        const confirmImport = confirm(
          'Importing a backup will replace the current campaign scenes. Continue?',
        );
        if (!confirmImport) {
          return;
        }

        applyCampaignBackupAssets(backup);
        await tokenAssetManager.initialize();
        await tokenAssetManager.refreshCustomizations();
        await propAssetManager.initialize();
        await propAssetManager.refreshCustomLibraries();
        await replaceScenesFromBackup(backup.scenes, backup.activeSceneId);
        await persistCampaignScenes(backup.scenes);
        console.log('📤 Campaign backup imported');
      } catch (error) {
        console.error('Failed to import campaign backup:', error);
        alert('Failed to import campaign backup. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    input.click();
  };

  return (
    <div className="header-player-actions">
      <button
        type="button"
        className="glass-button small"
        onClick={handleSave}
        disabled={isSaving}
        title="Save and download a campaign backup"
      >
        {isSaving ? 'Saving...' : '💾 Save'}
      </button>
      <button
        type="button"
        className="glass-button small secondary"
        onClick={handleLoad}
        disabled={isLoading}
        title="Load a campaign backup"
      >
        {isLoading ? 'Loading...' : '📂 Load'}
      </button>
    </div>
  );
};

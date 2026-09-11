import React, { useState } from 'react';
import {
  useGameStore,
  useScenes,
  useActiveScene,
  useIsHost,
  useUser,
} from '@/stores/gameStore';
import { SceneCanvas } from './SceneCanvas';
import { SceneList } from './SceneList';
import { SceneEditor } from './SceneEditor';
import { SceneErrorBoundary } from '../ErrorBoundary';
import { sceneUtils } from '@/utils/sceneUtils';
import type { Scene } from '@/types/game';

export const SceneManager: React.FC = () => {
  const { createScene, setActiveScene } = useGameStore();
  const scenes = useScenes();
  const activeScene = useActiveScene();
  const isHost = useIsHost();
  const user = useUser();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  const handleCreateScene = () => {
    const defaultScene = sceneUtils.createDefaultScene(
      `Scene ${scenes.length + 1}`,
      user.id,
    );
    const newScene = createScene(defaultScene);
    setActiveScene(newScene.id);
    setEditingScene(newScene);
    setIsEditorOpen(true);
  };

  const handleEditScene = (scene: Scene) => {
    setEditingScene(scene);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingScene(null);
  };

  const handleSceneSelect = (sceneId: string) => {
    setActiveScene(sceneId);
    // TODO: Send scene change event to other players when implementing websocket integration
  };

  if (scenes.length === 0 && isHost) {
    return (
      <div className="scene-manager-empty">
        <div className="empty-state">
          <h2>No Scenes Created</h2>
          <p>Create your first scene to begin your adventure!</p>
          <button className="btn btn-primary" onClick={handleCreateScene}>
            Create First Scene
          </button>
        </div>
      </div>
    );
  }

  if (scenes.length === 0 && !isHost) {
    return (
      <div className="scene-manager-empty">
        <div className="empty-state">
          <h2>No Scenes Available</h2>
          <p>Waiting for the DM to create scenes...</p>
        </div>
      </div>
    );
  }

  return (
    <SceneErrorBoundary>
      <div className="scene-manager">
        <div className="scene-sidebar">
          <div className="scene-controls">
            <h3>Scenes</h3>
            {isHost && (
              <button
                className="btn btn-small btn-primary"
                onClick={handleCreateScene}
              >
                + New Scene
              </button>
            )}
          </div>

          <SceneList
            scenes={scenes}
            activeSceneId={activeScene?.id || null}
            onSceneSelect={handleSceneSelect}
            onSceneEdit={isHost ? handleEditScene : undefined}
            isHost={isHost}
          />
        </div>

        <div className="scene-main">
          {activeScene ? (
            <SceneCanvas scene={activeScene} />
          ) : (
            <div className="no-scene-active">
              <p>Select a scene to view</p>
            </div>
          )}
        </div>

        {isEditorOpen && editingScene && (
          <SceneEditor scene={editingScene} onClose={handleCloseEditor} />
        )}
      </div>
    </SceneErrorBoundary>
  );
};

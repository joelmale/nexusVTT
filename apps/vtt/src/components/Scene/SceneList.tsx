import React, { Suspense } from 'react';
import { useGameStore } from '@/stores/gameStore';
import type { Scene } from '@/types/game';

interface SceneListProps {
  scenes: Scene[];
  activeSceneId: string | null;
  onSceneSelect: (sceneId: string) => void;
  onSceneEdit?: (scene: Scene) => void;
  isHost: boolean;
}

export const SceneList: React.FC<SceneListProps> = ({
  scenes,
  activeSceneId,
  onSceneSelect,
  onSceneEdit,
  isHost,
}) => {
  const { deleteScene } = useGameStore();

  const handleDeleteScene = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation(); // Prevent scene selection
    if (confirm('Are you sure you want to delete this scene?')) {
      deleteScene(sceneId);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="scene-list">
      {scenes.map((scene) => (
        <div
          key={scene.id}
          className={`scene-item ${scene.id === activeSceneId ? 'active' : ''}`}
          onClick={() => onSceneSelect(scene.id)}
        >
          <div className="scene-info">
            <h4 className="scene-name">{scene.name}</h4>
            {scene.description && (
              <p className="scene-description">{scene.description}</p>
            )}
            <span className="scene-date">
              Created: {formatDate(scene.createdAt)}
            </span>
            {scene.backgroundImage && (
              <div className="scene-preview">
                <Suspense
                  fallback={
                    <div className="scene-thumbnail-loading">Loading...</div>
                  }
                >
                  <img
                    src={scene.backgroundImage.url}
                    alt={scene.name}
                    className="scene-thumbnail"
                    loading="lazy"
                  />
                </Suspense>
              </div>
            )}
          </div>

          {isHost && (
            <div className="scene-actions">
              {onSceneEdit && (
                <button
                  className="btn btn-small btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSceneEdit(scene);
                  }}
                  title="Edit Scene"
                >
                  ✎
                </button>
              )}
              <button
                className="btn btn-small btn-danger"
                onClick={(e) => handleDeleteScene(e, scene.id)}
                title="Delete Scene"
                disabled={scenes.length === 1} // Don't allow deleting the last scene
              >
                🗑
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

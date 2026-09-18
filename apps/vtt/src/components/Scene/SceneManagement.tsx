import React, { useState } from 'react';
import { useScenes, useGameStore } from '@/stores/gameStore';
import type { Scene } from '@/types/game';

interface SceneManagementProps {
  onBackToSettings: () => void;
}

export const SceneManagement: React.FC<SceneManagementProps> = ({
  onBackToSettings,
}) => {
  const scenes = useScenes();
  // Narrow selectors: the old `useGameStore()` (no selector) subscribed to the
  // whole store.
  const deleteScenesById = useGameStore((state) => state.deleteScenesById);
  const updateScenesVisibility = useGameStore(
    (state) => state.updateScenesVisibility,
  );
  const duplicateScene = useGameStore((state) => state.duplicateScene);
  const setActiveScene = useGameStore((state) => state.setActiveScene);
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'updated'>(
    'updated',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sort scenes based on current sort settings
  const sortedScenes = [...scenes].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'created':
        aValue = a.createdAt;
        bValue = b.createdAt;
        break;
      case 'updated':
        aValue = a.updatedAt;
        bValue = b.updatedAt;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSelectAll = () => {
    if (selectedScenes.length === scenes.length) {
      setSelectedScenes([]);
    } else {
      setSelectedScenes(scenes.map((s) => s.id));
    }
  };

  const handleSelectScene = (sceneId: string) => {
    setSelectedScenes((prev) =>
      prev.includes(sceneId)
        ? prev.filter((id) => id !== sceneId)
        : [...prev, sceneId],
    );
  };

  const handleBulkDelete = () => {
    if (selectedScenes.length === 0) return;

    const sceneNames = selectedScenes
      .map((id) => scenes.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    if (
      window.confirm(
        `Delete ${selectedScenes.length} scene(s)?\n\n${sceneNames}\n\nThis cannot be undone.`,
      )
    ) {
      deleteScenesById(selectedScenes);
      setSelectedScenes([]);
    }
  };

  const handleBulkVisibilityChange = (visibility: Scene['visibility']) => {
    if (selectedScenes.length === 0) return;

    updateScenesVisibility(selectedScenes, visibility);
    setSelectedScenes([]);
  };

  const handleDuplicateScene = (sceneId: string) => {
    const duplicated = duplicateScene(sceneId);
    if (duplicated) {
      // Optionally switch to the duplicated scene
      setActiveScene(duplicated.id);
    }
  };

  const getVisibilityIcon = (visibility: Scene['visibility']) => {
    switch (visibility) {
      case 'private':
        return '🔒';
      case 'shared':
        return '👥';
      case 'public':
        return '🌐';
      default:
        return '❓';
    }
  };

  const getVisibilityText = (visibility: Scene['visibility']) => {
    switch (visibility) {
      case 'private':
        return 'Private';
      case 'shared':
        return 'Shared';
      case 'public':
        return 'Public';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="scene-management">
      <div className="scene-management-header">
        <div className="header-top">
          <button
            onClick={onBackToSettings}
            className="back-button"
            title="Back to Scene Settings"
          >
            ←
          </button>
          <h3>Manage All Scenes ({scenes.length})</h3>
        </div>

        <div className="management-controls">
          <div className="sort-controls">
            <label>
              Sort by:
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="updated">Last Updated</option>
                <option value="created">Created Date</option>
                <option value="name">Name</option>
              </select>
            </label>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="sort-order-btn"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <div className="selection-controls">
            <button onClick={handleSelectAll} className="select-all-btn">
              {selectedScenes.length === scenes.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
            <span className="selection-count">
              {selectedScenes.length} selected
            </span>
          </div>
        </div>

        {selectedScenes.length > 0 && (
          <div className="bulk-actions">
            <div className="bulk-actions-label">
              Bulk Actions ({selectedScenes.length} scenes):
            </div>
            <div className="bulk-action-buttons">
              <button
                onClick={() => handleBulkVisibilityChange('private')}
                className="bulk-btn visibility-btn"
                title="Set selected scenes to Private"
              >
                🔒 Private
              </button>
              <button
                onClick={() => handleBulkVisibilityChange('shared')}
                className="bulk-btn visibility-btn"
                title="Set selected scenes to Shared"
              >
                👥 Shared
              </button>
              <button
                onClick={() => handleBulkVisibilityChange('public')}
                className="bulk-btn visibility-btn"
                title="Set selected scenes to Public"
              >
                🌐 Public
              </button>
              <div className="bulk-separator" />
              <button
                onClick={handleBulkDelete}
                className="bulk-btn delete-btn"
                title="Delete selected scenes"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="scene-list">
        {sortedScenes.map((scene) => (
          <div
            key={scene.id}
            className={`scene-item ${selectedScenes.includes(scene.id) ? 'selected' : ''}`}
          >
            <div className="scene-item-checkbox">
              <input
                type="checkbox"
                checked={selectedScenes.includes(scene.id)}
                onChange={() => handleSelectScene(scene.id)}
              />
            </div>

            <div className="scene-item-header">
              <div className="scene-item-title-row">
                <h4 className="scene-name">{scene.name}</h4>
                <div className="scene-meta">
                  <span className="scene-visibility">
                    {getVisibilityIcon(scene.visibility)}{' '}
                    {getVisibilityText(scene.visibility)}
                  </span>
                </div>
              </div>
              <span className="scene-id">ID: {scene.id.slice(0, 8)}</span>
            </div>

            <div
              className="scene-item-content"
              onClick={() => setActiveScene(scene.id)}
            >
              {scene.description && (
                <p className="scene-description">{scene.description}</p>
              )}
            </div>

            <div className="scene-item-stats">
              <span className="scene-stat">
                🎭 {scene.placedTokens?.length || 0} tokens
              </span>
              <span className="scene-stat">
                ✏️ {scene.drawings?.length || 0} drawings
              </span>
              <span className="scene-stat">
                📅 Updated {new Date(scene.updatedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="scene-item-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveScene(scene.id);
                  onBackToSettings();
                }}
                className="scene-action-btn edit-btn"
                title="Edit Scene Settings"
              >
                ⚙️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateScene(scene.id);
                }}
                className="scene-action-btn duplicate-btn"
                title="Duplicate Scene"
              >
                📋
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      `Delete scene "${scene.name}"? This cannot be undone.`,
                    )
                  ) {
                    deleteScenesById([scene.id]);
                  }
                }}
                className="scene-action-btn delete-btn"
                title="Delete Scene"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}

        {scenes.length === 0 && (
          <div className="empty-scenes">
            <h4>No scenes yet</h4>
            <p>Create your first scene to get started!</p>
            <button onClick={onBackToSettings} className="create-scene-btn">
              Create Scene
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

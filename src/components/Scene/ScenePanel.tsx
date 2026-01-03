import React, { useState } from 'react';
import { useGameStore, useIsHost } from '@/stores/gameStore';
import type { Scene } from '@/types/game';
import { SceneManagement } from './SceneManagement';
import { BaseMapBrowser } from './BaseMapBrowser';
import { ErrorBoundary } from '../ErrorBoundary';
import type { BaseMap } from '@/services/baseMapAssets';
import { dungeonMapService } from '@/services/dungeonMapService';

interface ScenePanelProps {
  scene?: Scene;
}

export const ScenePanel: React.FC<ScenePanelProps> = ({ scene }) => {
  const { updateScene, createScene, deleteScene, clearDrawings, deleteToken } =
    useGameStore();
  const isHost = useIsHost();
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [managementMode, setManagementMode] = useState(false);
  const [showBaseMapBrowser, setShowBaseMapBrowser] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [loadingImageUrl, setLoadingImageUrl] = useState(false);
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);
  const [loadedImageFromUrl, setLoadedImageFromUrl] = useState<{
    dataUrl: string;
    originalSize: number;
    compressedSize: number;
    width: number;
    height: number;
    sourceUrl: string;
  } | null>(null);

  // Collapsible section state with localStorage persistence
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem('scenePanel.expandedSections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to defaults if parse fails
      }
    }
    return {
      basicInfo: true,
      backgroundImage: true,
      visibility: true,
      grid: true,
      lighting: false,
      dangerZone: false,
    };
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev: typeof expandedSections) => {
      const newState = {
        ...prev,
        [section]: !prev[section],
      };
      // Persist to localStorage
      localStorage.setItem(
        'scenePanel.expandedSections',
        JSON.stringify(newState),
      );
      return newState;
    });
  };

  // If not DM, don't render anything
  if (!isHost) {
    return null;
  }

  // If in management mode, show the Scene Management component
  if (managementMode) {
    return (
      <SceneManagement onBackToSettings={() => setManagementMode(false)} />
    );
  }

  // Provide default values for missing properties
  const safeScene = scene
    ? {
        ...scene,
        description: scene.description || '',
        visibility: scene.visibility || ('private' as const),
        isEditable: scene.isEditable ?? true,
        gridSettings: {
          ...{
            enabled: true,
            size: 50,
            color: '#ffffff',
            opacity: 0.3,
            snapToGrid: true,
            showToPlayers: true,
          },
          ...(scene.gridSettings || {}),
        },
        lightingSettings: {
          ...{
            enabled: false,
            globalIllumination: true,
            ambientLight: 0.5,
            darkness: 0,
          },
          ...(scene.lightingSettings || {}),
        },
      }
    : null;

  // If no scene selected, show creation prompt
  if (!safeScene) {
    return (
      <div className="scene-panel">
        <div className="scene-panel__header">
          <div className="scene-panel-header-top">
            <h3>Scene Management</h3>
            <button
              onClick={() => setManagementMode(true)}
              className="scene-management-toggle"
              title="Manage All Scenes"
            >
              📋 Manage All
            </button>
          </div>
        </div>
        <div className="scene-panel__content">
          <div className="scene-panel__empty-state">
            <p>
              No scene selected. Create or select a scene to manage its
              settings.
            </p>
            <button
              onClick={() => {
                const defaultScene = {
                  name: `Scene 1`,
                  description: `A new scene for the adventure`,
                  visibility: 'private' as const,
                  isEditable: true,
                  createdBy: 'host',
                  gridSettings: {
                    enabled: true,
                    size: 50,
                    color: '#ffffff',
                    opacity: 0.3,
                    snapToGrid: true,
                    showToPlayers: true,
                  },
                  lightingSettings: {
                    enabled: false,
                    globalIllumination: true,
                    ambientLight: 0.5,
                    darkness: 0,
                  },
                  drawings: [],
                  placedTokens: [],
                  placedProps: [],
                  isActive: false,
                  playerCount: 0,
                };
                createScene(defaultScene);
              }}
              className="create-scene-button"
            >
              Create New Scene
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleFieldUpdate = <K extends keyof Scene>(
    field: K,
    value: Scene[K],
  ) => {
    updateScene(safeScene.id, { [field]: value });
  };

  const handleNameSubmit = (name: string) => {
    if (name.trim()) {
      handleFieldUpdate('name', name.trim());
    }
    setEditingName(false);
  };

  const handleDescriptionSubmit = (description: string) => {
    handleFieldUpdate('description', description);
    setEditingDescription(false);
  };

  const handleVisibilityChange = (visibility: Scene['visibility']) => {
    handleFieldUpdate('visibility', visibility);
  };

  const handleGridSettingChange = <K extends keyof Scene['gridSettings']>(
    setting: K,
    value: Scene['gridSettings'][K],
  ) => {
    handleFieldUpdate('gridSettings', {
      ...safeScene.gridSettings,
      [setting]: value,
    });
  };

  const handleLightingSettingChange = <
    K extends keyof Scene['lightingSettings'],
  >(
    setting: K,
    value: Scene['lightingSettings'][K],
  ) => {
    handleFieldUpdate('lightingSettings', {
      ...safeScene.lightingSettings,
      [setting]: value,
    });
  };

  const handleLoadImageFromUrl = async () => {
    if (!imageUrlInput.trim()) {
      setImageUrlError('Please enter a URL');
      return;
    }

    setLoadingImageUrl(true);
    setImageUrlError(null);

    try {
      const { sceneUtils } = await import('@/utils/sceneUtils');
      const { dataUrl, width, height, originalSize, compressedSize } =
        await sceneUtils.loadImageFromUrl(imageUrlInput);

      handleFieldUpdate('backgroundImage', {
        url: dataUrl,
        width,
        height,
        offsetX: -width / 2,
        offsetY: -height / 2,
        scale: 1.0,
      });

      console.log(`✅ Background image loaded from URL: ${width}×${height}px`);
      setLoadedImageFromUrl({
        dataUrl,
        originalSize,
        compressedSize,
        width,
        height,
        sourceUrl: imageUrlInput,
      });
      setImageUrlInput(''); // Clear input on success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load image from URL';
      setImageUrlError(errorMessage);
      console.error('❌ Failed to load image from URL:', error);
    } finally {
      setLoadingImageUrl(false);
    }
  };

  const handleSaveLoadedImageToBaseMaps = async () => {
    if (!loadedImageFromUrl) return;
    try {
      const defaultName =
        loadedImageFromUrl.sourceUrl.split('/').pop() ||
        'Background from URL';
      const name = prompt(
        'Name this base map',
        defaultName.replace(/\.[^/.]+$/, ''),
      );
      if (!name) return;

      await dungeonMapService.saveGeneratedMap(
        loadedImageFromUrl.dataUrl,
        name,
        'webp',
        loadedImageFromUrl.originalSize,
      );
      console.log(`✅ Saved base map from URL: ${name}`);
      alert('Saved to Base Maps. Open the Base Map browser to use it.');
    } catch (error) {
      console.error('Failed to save base map from URL:', error);
      alert('Failed to save to Base Maps. Please try again.');
    }
  };

  const handleBaseMapSelect = (map: BaseMap) => {
    // Load the image to get dimensions and scale if needed
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Allow canvas manipulation
    img.onload = () => {
      // Scale down by 50% for generated dungeons
      const isGeneratedDungeon =
        map.isGenerated || map.tags?.includes('generated');
      const scaleFactor = isGeneratedDungeon ? 0.5 : 1.0;

      let finalUrl = map.path;
      let finalWidth = img.naturalWidth;
      let finalHeight = img.naturalHeight;

      if (isGeneratedDungeon && map.path.startsWith('data:')) {
        // Scale down the image using canvas
        const canvas = document.createElement('canvas');
        const scaledWidth = Math.floor(img.naturalWidth * scaleFactor);
        const scaledHeight = Math.floor(img.naturalHeight * scaleFactor);

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Use high-quality scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

          // Convert to WebP with compression
          finalUrl = canvas.toDataURL('image/webp', 0.85);
          finalWidth = scaledWidth;
          finalHeight = scaledHeight;

          console.log(
            `📐 Scaled generated dungeon from ${img.naturalWidth}×${img.naturalHeight} to ${scaledWidth}×${scaledHeight} (50%)`,
          );
        }
      }

      handleFieldUpdate('backgroundImage', {
        url: finalUrl,
        width: finalWidth,
        height: finalHeight,
        offsetX: -finalWidth / 2,
        offsetY: -finalHeight / 2,
        scale: 1.0,
      });

      // Auto-set grid size based on map dimensions if available
      if (map.gridSize && map.gridSize.width > 0 && map.gridSize.height > 0) {
        // Calculate grid cell size in pixels
        const gridCellSizeX = finalWidth / map.gridSize.width;
        const gridCellSizeY = finalHeight / map.gridSize.height;
        const calculatedGridSize = Math.round(Math.min(gridCellSizeX, gridCellSizeY));

        console.log(`📐 Auto-setting grid size based on map dimensions: ${map.gridSize.width}×${map.gridSize.height} → ${calculatedGridSize}px per cell`);

        handleFieldUpdate('gridSettings', {
          ...safeScene.gridSettings,
          size: calculatedGridSize,
          enabled: !isGeneratedDungeon, // Keep disabled for generated dungeons
        });
      }

      setShowBaseMapBrowser(false);
    };
    img.onerror = () => {
      alert('Failed to load base map');
      setShowBaseMapBrowser(false);
    };
    img.src = map.path;
  };

  return (
    <div className="scene-panel">
      <div className="scene-panel__header">
        <div className="scene-panel-header-top">
          <h3>Scene Settings</h3>
          <button
            onClick={() => setManagementMode(true)}
            className="scene-management-toggle"
            title="Manage All Scenes"
          >
            📋 Manage All
          </button>
        </div>
        <div className="scene-panel__meta">
          <span className="scene-id">ID: {safeScene.id.slice(0, 8)}</span>
          <span className="scene-updated">
            Updated: {new Date(safeScene.updatedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="scene-panel__content">
        {/* Basic Info Section */}
        <section className="scene-panel__section">
          <h4
            onClick={() => toggleSection('basicInfo')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: expandedSections.basicInfo
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
              }}
            >
              ▶
            </span>
            Basic Information
          </h4>

          {expandedSections.basicInfo && (
            <>
              {/* Scene Name */}
              <div className="scene-panel__field">
                <label>Scene Name</label>
                {editingName ? (
                  <input
                    type="text"
                    defaultValue={safeScene.name}
                    autoFocus
                    onBlur={(e) => handleNameSubmit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        handleNameSubmit(e.currentTarget.value);
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    className="scene-panel__field-input"
                  />
                ) : (
                  <div
                    className="scene-panel__field-display"
                    onClick={() => setEditingName(true)}
                    title="Click to edit"
                  >
                    {safeScene.name}
                  </div>
                )}
              </div>

              {/* Scene Description */}
              <div className="scene-panel__field">
                <label>Description</label>
                {editingDescription ? (
                  <textarea
                    defaultValue={safeScene.description}
                    autoFocus
                    onBlur={(e) => handleDescriptionSubmit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingDescription(false);
                    }}
                    className="scene-panel__field-input scene-panel__field-input--multiline"
                    rows={3}
                    placeholder="Describe this safeScene..."
                  />
                ) : (
                  <div
                    className="scene-panel__field-display scene-panel__field-display--multiline"
                    onClick={() => setEditingDescription(true)}
                    title="Click to edit"
                  >
                    {safeScene.description || 'No description'}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Background Image Section */}
        <section className="scene-panel__section">
          <h4
            onClick={() => toggleSection('backgroundImage')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: expandedSections.backgroundImage
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
              }}
            >
              ▶
            </span>
            Background Image
          </h4>

          {expandedSections.backgroundImage && (
            <>
              <div className="scene-panel__field">
                <label>Background Image URL</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: 'column' }}>
                    <div style={{ width: '100%' }}>
                      <input
                        type="text"
                        value={imageUrlInput}
                        onChange={(e) => {
                          setImageUrlInput(e.target.value);
                          setImageUrlError(null); // Clear error on input change
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !loadingImageUrl) {
                            handleLoadImageFromUrl();
                          }
                        }}
                        placeholder="https://example.com/map.jpg"
                        className="scene-panel__field-input"
                        disabled={loadingImageUrl}
                      />
                      {imageUrlError && (
                        <small style={{ color: '#ff6b6b', display: 'block', marginTop: '4px' }}>
                          {imageUrlError}
                        </small>
                      )}
                      <small
                        style={{
                          color: 'var(--glass-text-secondary, #999)',
                          display: 'block',
                          marginTop: '4px',
                        }}
                      >
                        Supported: JPG, PNG, WebP, GIF
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleLoadImageFromUrl}
                        disabled={loadingImageUrl || !imageUrlInput.trim()}
                        className="btn btn--primary"
                        style={{ minWidth: '72px', padding: '6px 10px' }}
                      >
                        {loadingImageUrl ? 'Loading...' : 'Load'}
                      </button>
                      <button
                        onClick={handleSaveLoadedImageToBaseMaps}
                        disabled={!loadedImageFromUrl}
                        className="btn"
                        style={{ minWidth: '120px', padding: '6px 10px' }}
                        title={
                          loadedImageFromUrl
                            ? 'Save the last loaded image to Base Maps'
                            : 'Load an image first'
                        }
                      >
                        Save to Base Maps
                      </button>
                    </div>
                  </div>
                </div>

              <div className="scene-panel__field">
                <label>Or upload an image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Convert to base64 data URL
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const result = event.target?.result;
                        if (typeof result === 'string') {
                          // Create an image to get dimensions
                          const img = new Image();
                          img.onload = () => {
                            handleFieldUpdate('backgroundImage', {
                              url: result,
                              width: img.width,
                              height: img.height,
                              offsetX: -img.width / 2,
                              offsetY: -img.height / 2,
                              scale: 1,
                            });
                          };
                          img.src = result;
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="file-input"
                />
                <small
                  style={{
                    color: 'var(--glass-text-secondary, #999)',
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  Supported: JPG, PNG, WebP, GIF
                </small>
              </div>

              <div className="scene-panel__field">
                <label>Or browse default maps</label>
                <button
                  onClick={() => {
                    console.log(
                      '🗺️ ScenePanel: Browse Base Maps button clicked',
                    );
                    setShowBaseMapBrowser(true);
                    console.log(
                      '🗺️ ScenePanel: showBaseMapBrowser set to true',
                    );
                  }}
                  className="btn btn--primary"
                  style={{ width: '100%' }}
                >
                  🗺️ Browse Base Maps
                </button>
              </div>

              {safeScene.backgroundImage && (
                <>
                  <div className="scene-panel__field">
                    <label>Background Preview</label>
                    <div
                      style={{
                        width: '100%',
                        height: '150px',
                        backgroundImage: `url(${safeScene.backgroundImage.url})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        border:
                          '1px solid var(--glass-border, rgba(255,255,255,0.1))',
                        borderRadius: '4px',
                        marginTop: '8px',
                      }}
                    />
                  </div>

                  <div className="scene-panel__field">
                    <label>
                      Scale:{' '}
                      {Math.round((safeScene.backgroundImage.scale || 1) * 100)}
                      %
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={safeScene.backgroundImage.scale || 1}
                      onChange={(e) =>
                        handleFieldUpdate('backgroundImage', {
                          ...safeScene.backgroundImage!,
                          scale: parseFloat(e.target.value),
                        })
                      }
                      className="scene-panel__range-input"
                    />
                  </div>

                  <div className="scene-panel__field">
                    <button
                      onClick={() =>
                        handleFieldUpdate('backgroundImage', undefined)
                      }
                      className="btn btn--primary"
                      style={{ width: '100%' }}
                    >
                      🗑️ Remove Background
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* Visibility Section */}
        <section className="scene-panel__section">
          <h4
            onClick={() => toggleSection('visibility')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: expandedSections.visibility
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
              }}
            >
              ▶
            </span>
            Visibility & Sharing
          </h4>

          {expandedSections.visibility && (
            <>
              <div className="scene-panel__field">
                <label>Who can see this scene</label>
                <div className="scene-panel__visibility-options">
                  <label className="scene-panel__visibility-option">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={safeScene.visibility === 'private'}
                      onChange={() => handleVisibilityChange('private')}
                    />
                    <span className="scene-panel__visibility-icon">🔒</span>
                    <div className="scene-panel__visibility-details">
                      <strong>Private</strong>
                      <small>Only you can see this scene</small>
                    </div>
                  </label>

                  <label className="scene-panel__visibility-option">
                    <input
                      type="radio"
                      name="visibility"
                      value="shared"
                      checked={safeScene.visibility === 'shared'}
                      onChange={() => handleVisibilityChange('shared')}
                    />
                    <span className="scene-panel__visibility-icon">👥</span>
                    <div className="scene-panel__visibility-details">
                      <strong>Shared</strong>
                      <small>Players can view when you share it</small>
                    </div>
                  </label>

                  <label className="scene-panel__visibility-option">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={safeScene.visibility === 'public'}
                      onChange={() => handleVisibilityChange('public')}
                    />
                    <span className="scene-panel__visibility-icon">🌐</span>
                    <div className="scene-panel__visibility-details">
                      <strong>Public</strong>
                      <small>All players can always see this scene</small>
                    </div>
                  </label>
                </div>
              </div>

              <div className="scene-panel__field">
                <label className="scene-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={safeScene.isEditable}
                    onChange={(e) =>
                      handleFieldUpdate('isEditable', e.target.checked)
                    }
                  />
                  Allow editing (tokens, drawings, etc.)
                </label>
              </div>
            </>
          )}
        </section>

        {/* Grid Settings Section */}
        <section className="scene-panel__section">
          <h4
            onClick={() => toggleSection('grid')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: expandedSections.grid
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
              }}
            >
              ▶
            </span>
            Grid Settings
          </h4>

          {expandedSections.grid && (
            <>
              <div className="scene-panel__field">
                <label className="scene-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={safeScene.gridSettings.enabled}
                    onChange={(e) =>
                      handleGridSettingChange('enabled', e.target.checked)
                    }
                  />
                  Enable grid
                </label>
              </div>

              {safeScene.gridSettings.enabled && (
                <>
                  {/* Grid Type Selector */}
                  <div className="scene-panel__field">
                    <label>Grid Type</label>
                    <div className="scene-panel__grid-type-options">
                      <label className="scene-panel__grid-type-option">
                        <input
                          type="radio"
                          name="gridType"
                          value="square"
                          checked={
                            (safeScene.gridSettings.type || 'square') ===
                            'square'
                          }
                          onChange={() =>
                            handleGridSettingChange('type', 'square')
                          }
                        />
                        <span className="scene-panel__grid-icon">□</span>
                        <div className="scene-panel__grid-details">
                          <strong>Square Grid</strong>
                          <small>Traditional D&D grid</small>
                        </div>
                      </label>

                      <label className="scene-panel__grid-type-option">
                        <input
                          type="radio"
                          name="gridType"
                          value="hex"
                          checked={safeScene.gridSettings.type === 'hex'}
                          onChange={() =>
                            handleGridSettingChange('type', 'hex')
                          }
                        />
                        <span className="scene-panel__grid-icon">⬡</span>
                        <div className="scene-panel__grid-details">
                          <strong>Hex Grid</strong>
                          <small>Better for large world maps</small>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Hex Scale Control (only show for hex grids) */}
                  {safeScene.gridSettings.type === 'hex' && (
                    <div className="scene-panel__field">
                      <label>
                        Hex Scale:{' '}
                        {Math.round(
                          (safeScene.gridSettings.hexScale || 1.0) * 100,
                        )}
                        %
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={safeScene.gridSettings.hexScale || 1.0}
                        onChange={(e) =>
                          handleGridSettingChange(
                            'hexScale',
                            parseFloat(e.target.value),
                          )
                        }
                        className="scene-panel__range-input"
                      />
                      <small
                        style={{
                          color: 'var(--glass-text-secondary, #999)',
                          display: 'block',
                          marginTop: '4px',
                        }}
                      >
                        Adjust hex size relative to square equivalent
                      </small>
                    </div>
                  )}

                  <div className="scene-panel__field">
                    <label>Grid size: {safeScene.gridSettings.size}px</label>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={safeScene.gridSettings.size}
                      onChange={(e) =>
                        handleGridSettingChange(
                          'size',
                          parseInt(e.target.value),
                        )
                      }
                      className="scene-panel__range-input"
                    />
                  </div>

                  <div className="scene-panel__field">
                    <label>
                      Grid opacity:{' '}
                      {Math.round(safeScene.gridSettings.opacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={safeScene.gridSettings.opacity}
                      onChange={(e) =>
                        handleGridSettingChange(
                          'opacity',
                          parseFloat(e.target.value),
                        )
                      }
                      className="scene-panel__range-input"
                    />
                  </div>

                  <div className="scene-panel__field">
                    <label>Grid color</label>
                    <input
                      type="color"
                      value={safeScene.gridSettings.color}
                      onChange={(e) =>
                        handleGridSettingChange('color', e.target.value)
                      }
                      className="scene-panel__color-input"
                    />
                  </div>

                  <div className="scene-panel__field">
                    <label className="scene-panel__checkbox-label">
                      <input
                        type="checkbox"
                        checked={safeScene.gridSettings.snapToGrid}
                        onChange={(e) =>
                          handleGridSettingChange(
                            'snapToGrid',
                            e.target.checked,
                          )
                        }
                      />
                      Snap objects to grid
                    </label>
                  </div>

                  <div className="scene-panel__field">
                    <label className="scene-panel__checkbox-label">
                      <input
                        type="checkbox"
                        checked={safeScene.gridSettings.showToPlayers}
                        onChange={(e) =>
                          handleGridSettingChange(
                            'showToPlayers',
                            e.target.checked,
                          )
                        }
                      />
                      Show grid to players
                    </label>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* Lighting Settings Section */}
        <section className="scene-panel__section">
          <h4
            onClick={() => toggleSection('lighting')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: expandedSections.lighting
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
              }}
            >
              ▶
            </span>
            Lighting & Vision
          </h4>

          {expandedSections.lighting && (
            <>
              <div className="scene-panel__field">
                <label className="scene-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={safeScene.lightingSettings.enabled}
                    onChange={(e) =>
                      handleLightingSettingChange('enabled', e.target.checked)
                    }
                  />
                  Enable dynamic lighting
                </label>
              </div>

              {safeScene.lightingSettings.enabled && (
                <>
                  <div className="scene-panel__field">
                    <label>
                      Ambient light:{' '}
                      {Math.round(
                        safeScene.lightingSettings.ambientLight * 100,
                      )}
                      %
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={safeScene.lightingSettings.ambientLight}
                      onChange={(e) =>
                        handleLightingSettingChange(
                          'ambientLight',
                          parseFloat(e.target.value),
                        )
                      }
                      className="scene-panel__range-input"
                    />
                  </div>

                  <div className="scene-panel__field">
                    <label>
                      Darkness:{' '}
                      {Math.round(safeScene.lightingSettings.darkness * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={safeScene.lightingSettings.darkness}
                      onChange={(e) =>
                        handleLightingSettingChange(
                          'darkness',
                          parseFloat(e.target.value),
                        )
                      }
                      className="scene-panel__range-input"
                    />
                  </div>

                  <div className="scene-panel__field">
                    <label className="scene-panel__checkbox-label">
                      <input
                        type="checkbox"
                        checked={safeScene.lightingSettings.globalIllumination}
                        onChange={(e) =>
                          handleLightingSettingChange(
                            'globalIllumination',
                            e.target.checked,
                          )
                        }
                      />
                      Global illumination
                    </label>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* Danger Zone */}
        <section className="scene-panel__section scene-panel__danger-zone">
          <h4
            onClick={() => toggleSection('dangerZone')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: expandedSections.dangerZone
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
              }}
            >
              ▶
            </span>
            Danger Zone
          </h4>

          {expandedSections.dangerZone && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  const drawingCount = safeScene.drawings?.length || 0;
                  const tokenCount = safeScene.placedTokens?.length || 0;
                  const totalObjects = drawingCount + tokenCount;

                  if (totalObjects === 0) {
                    alert('No objects to delete.');
                    return;
                  }

                  const message = `Delete all ${totalObjects} object(s)? This includes:\n- ${drawingCount} drawing(s)\n- ${tokenCount} token(s)\n\nThis cannot be undone.`;

                  if (window.confirm(message)) {
                    // Delete all drawings
                    clearDrawings(safeScene.id);

                    // Delete all tokens
                    const tokenIds = [...safeScene.placedTokens];
                    tokenIds.forEach((token) => {
                      deleteToken(safeScene.id, token.id);
                    });
                  }
                }}
                className="danger-outline"
              >
                Delete All Objects
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm('Delete this scene? This cannot be undone.')
                  ) {
                    deleteScene(safeScene.id);
                  }
                }}
                className="scene-panel__button scene-panel__button--danger"
              >
                Delete Scene
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Base Map Browser Modal */}
      {showBaseMapBrowser && (
        <ErrorBoundary
          fallback={
            <div className="error">Failed to load base map browser</div>
          }
        >
          <BaseMapBrowser
            onSelect={handleBaseMapSelect}
            onClose={() => setShowBaseMapBrowser(false)}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

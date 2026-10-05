import React, { useRef, useState } from 'react';
import { useGameStore, useIsHost } from '@/stores/gameStore';
import type { Scene } from '@/types/game';
import { SceneManagement } from './SceneManagement';
import { BaseMapBrowser } from './BaseMapBrowser';
import { ErrorBoundary } from '../ErrorBoundary';
import type { BaseMap } from '@/services/baseMapAssets';
import { dungeonMapService } from '@/services/dungeonMapService';
import { sceneUtils } from '@/utils/sceneUtils';
import styles from './ScenePanel.module.css';

interface ScenePanelProps {
  scene?: Scene;
}

export type ScenePanelTab = 'map' | 'grid' | 'lighting' | 'general';

const TABS: ReadonlyArray<{ id: ScenePanelTab; label: string; icon: string }> =
  [
    { id: 'map', label: 'Map', icon: '🗺️' },
    { id: 'grid', label: 'Grid', icon: '📐' },
    { id: 'lighting', label: 'Lighting', icon: '💡' },
    { id: 'general', label: 'General', icon: '⚙️' },
  ];

const ACTIVE_TAB_STORAGE_KEY = 'scenePanel.activeTab';
const GRID_SIZE_PRESETS = [50, 70, 100] as const;
const GRID_SIZE_MIN = 20;
const GRID_SIZE_MAX = 200;

const VISIBILITY_OPTIONS: ReadonlyArray<{
  id: Scene['visibility'];
  label: string;
  icon: string;
  help: string;
}> = [
  {
    id: 'private',
    label: 'Private',
    icon: '🔒',
    help: 'Only you can see this scene.',
  },
  {
    id: 'shared',
    label: 'Shared',
    icon: '👥',
    help: 'Players can view it when you share it.',
  },
  {
    id: 'public',
    label: 'Public',
    icon: '🌐',
    help: 'All players can always see this scene.',
  },
];

const isScenePanelTab = (value: string | null): value is ScenePanelTab =>
  value === 'map' ||
  value === 'grid' ||
  value === 'lighting' ||
  value === 'general';

const loadActiveTab = (): ScenePanelTab => {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return isScenePanelTab(saved) ? saved : 'map';
  } catch {
    return 'map';
  }
};

/** Opts a button out of the blanket `.theme-solid button` override (theme-solid.css). */
const buttonClass = (className: string): string => `unstyled ${className}`;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Derives a short format badge (WEBP, PNG, ...) from a data: or http(s) URL. */
const getImageFormatLabel = (url: string): string | null => {
  const dataMatch = url.match(/^data:image\/([a-z0-9+.-]+)[;,]/i);
  if (dataMatch) {
    return dataMatch[1]
      .replace('svg+xml', 'svg')
      .replace('jpeg', 'jpg')
      .toUpperCase();
  }
  const extensionMatch = url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i);
  return extensionMatch ? extensionMatch[1].toUpperCase() : null;
};

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** 'percent' stores 0–1 but displays/edits 0–100. */
  unit: 'px' | 'percent';
  onChange: (value: number) => void;
  hint?: string;
}

/** A range slider paired with a numeric input so exact values are easy to set. */
const SliderField: React.FC<SliderFieldProps> = ({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
}) => {
  const isPercent = unit === 'percent';
  const displayValue = isPercent ? Math.round(value * 100) : value;

  const handleNumberChange = (raw: string) => {
    const parsed = Number(raw);
    if (raw === '' || Number.isNaN(parsed)) return;
    const next = isPercent ? parsed / 100 : parsed;
    onChange(clamp(next, min, max));
  };

  return (
    <div className={styles.field}>
      <div className={styles.sliderHeader}>
        <label htmlFor={id} className={styles.fieldLabel}>
          {label}
        </label>
        <div className={styles.numberWrap}>
          <input
            type="number"
            className={styles.numberInput}
            aria-label={`${label} value`}
            min={isPercent ? Math.round(min * 100) : min}
            max={isPercent ? Math.round(max * 100) : max}
            step={isPercent ? Math.round(step * 100) || 1 : step}
            value={displayValue}
            onChange={(e) => handleNumberChange(e.target.value)}
          />
          <span className={styles.unit}>{isPercent ? '%' : 'px'}</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <small className={styles.hint}>{hint}</small>}
    </div>
  );
};

interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleField: React.FC<ToggleFieldProps> = ({
  label,
  checked,
  onChange,
}) => (
  <label className={styles.toggle}>
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className={styles.toggleTrack} aria-hidden="true" />
    <span className={styles.toggleLabel}>{label}</span>
  </label>
);

const ScenePanelContent: React.FC<ScenePanelProps> = ({ scene }) => {
  // Narrow selectors: the old `useGameStore()` (no selector) subscribed to the
  // whole store.
  const updateScene = useGameStore((state) => state.updateScene);
  const createScene = useGameStore((state) => state.createScene);
  const deleteScene = useGameStore((state) => state.deleteScene);
  const clearDrawings = useGameStore((state) => state.clearDrawings);
  const deleteToken = useGameStore((state) => state.deleteToken);
  const deleteProp = useGameStore((state) => state.deleteProp);
  const setActiveScene = useGameStore((state) => state.setActiveScene);
  const isHost = useIsHost();
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [managementMode, setManagementMode] = useState(false);
  const [showBaseMapBrowser, setShowBaseMapBrowser] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [showMapSources, setShowMapSources] = useState(false);
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
  const [pendingDanger, setPendingDanger] = useState<
    'objects' | 'scene' | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active tab with localStorage persistence (replaces the old per-section
  // accordion state).
  const [activeTab, setActiveTabState] = useState<ScenePanelTab>(loadActiveTab);

  const selectTab = (tab: ScenePanelTab) => {
    setActiveTabState(tab);
    setPendingDanger(null);
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    } catch {
      // Ignore quota / privacy-mode errors
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    selectTab(next.id);
    document.getElementById(`scene-panel-tab-${next.id}`)?.focus();
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
            opacity: 0.1,
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
      <div className={`scene-panel ${styles.panel}`}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h3 className={styles.title}>Scene Management</h3>
            <button
              type="button"
              onClick={() => setManagementMode(true)}
              className={buttonClass(styles.ghostButton)}
              title="Manage All Scenes"
            >
              📋 Manage All
            </button>
          </div>
        </div>
        <div className={styles.emptyState}>
          <p>
            No scene selected. Create or select a scene to manage its settings.
          </p>
          <button
            type="button"
            onClick={() => {
              const defaultScene = sceneUtils.createDefaultScene(
                'Scene 1',
                'host',
              );
              defaultScene.visibility = 'private';
              defaultScene.description = 'A new scene for the adventure';
              const newScene = createScene(defaultScene);
              setActiveScene(newScene.id);
            }}
            className={buttonClass(styles.primaryButton)}
          >
            Create New Scene
          </button>
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to load image from URL';
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
        loadedImageFromUrl.sourceUrl.split('/').pop() || 'Background from URL';
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

  const handleFileUpload = (file: File) => {
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
        const calculatedGridSize = Math.round(
          Math.min(gridCellSizeX, gridCellSizeY),
        );

        console.log(
          `📐 Auto-setting grid size based on map dimensions: ${map.gridSize.width}×${map.gridSize.height} → ${calculatedGridSize}px per cell`,
        );

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

  const handleDeleteAllObjects = () => {
    // Delete all drawings
    clearDrawings(safeScene.id);

    // Delete all tokens
    const tokenIds = [...safeScene.placedTokens];
    tokenIds.forEach((token) => {
      deleteToken(safeScene.id, token.id);
    });
    safeScene.placedProps.forEach((prop) => deleteProp(safeScene.id, prop.id));
    setPendingDanger(null);
  };

  const drawingCount = safeScene.drawings?.length || 0;
  const tokenCount = safeScene.placedTokens?.length || 0;
  const propCount = safeScene.placedProps?.length || 0;
  const totalObjects = drawingCount + tokenCount + propCount;
  const background = safeScene.backgroundImage;
  const mapName = (() => {
    if (!background || background.url.startsWith('data:'))
      return 'Background map';
    const filename = background.url.split(/[?#]/)[0].split('/').pop();
    try {
      return filename ? decodeURIComponent(filename) : 'Background map';
    } catch {
      return filename || 'Background map';
    }
  })();
  const formatLabel = background ? getImageFormatLabel(background.url) : null;
  const activeVisibility =
    VISIBILITY_OPTIONS.find((option) => option.id === safeScene.visibility) ??
    VISIBILITY_OPTIONS[0];

  const renderMapTab = () => (
    <>
      {background ? (
        <div className={styles.mediaCard}>
          <span className={styles.fieldLabel}>{mapName}</span>
          <div
            className={styles.mediaThumb}
            role="img"
            aria-label="Background preview"
            style={{
              backgroundImage: `url(${JSON.stringify(background.url)})`,
            }}
          />
          <div className={styles.mediaMeta}>
            <div className={styles.mediaDims}>
              {Math.round(background.width)} × {Math.round(background.height)}
              px
            </div>
            {formatLabel && <span className={styles.badge}>{formatLabel}</span>}
          </div>
          <SliderField
            id="scene-bg-scale"
            label="Scale"
            value={background.scale || 1}
            min={0.1}
            max={3}
            step={0.1}
            unit="percent"
            onChange={(scale) =>
              handleFieldUpdate('backgroundImage', {
                ...background,
                scale,
              })
            }
          />
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={buttonClass(styles.ghostButton)}
              aria-expanded={showMapSources}
              onClick={() => {
                setShowMapSources((previous) => !previous);
                setShowUrlForm(false);
              }}
            >
              Change Map
            </button>
            <button
              type="button"
              onClick={() => handleFieldUpdate('backgroundImage', undefined)}
              className={buttonClass(styles.dangerGhostButton)}
            >
              🗑️ Remove Background
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.mediaEmpty}>
          <span aria-hidden="true">🖼️</span>
          <p>No background map yet. Choose a source below.</p>
        </div>
      )}

      {(!background || showMapSources) && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {background ? 'Replace map from' : 'Add a map from'}
          </span>
          <div className={styles.sourceGrid}>
            <button
              type="button"
              className={buttonClass(styles.sourceButton)}
              onClick={() => {
                setShowUrlForm(false);
                fileInputRef.current?.click();
              }}
            >
              <span aria-hidden="true">📁</span>
              Upload
            </button>
            <button
              type="button"
              className={buttonClass(styles.sourceButton)}
              onClick={() => {
                setShowUrlForm(false);
                setShowBaseMapBrowser(true);
              }}
            >
              <span aria-hidden="true">🗺️</span>
              Browse Base Maps
            </button>
            <button
              type="button"
              className={buttonClass(
                showUrlForm ? styles.sourceButtonActive : styles.sourceButton,
              )}
              aria-expanded={showUrlForm}
              onClick={() => setShowUrlForm((prev) => !prev)}
            >
              <span aria-hidden="true">🔗</span>
              From URL
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            data-testid="scene-bg-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
          />
          <small className={styles.hint}>Supported: JPG, PNG, WebP, GIF</small>
        </div>
      )}

      {showUrlForm && (!background || showMapSources) && (
        <div className={styles.subCard}>
          <label htmlFor="scene-bg-url" className={styles.fieldLabel}>
            Image URL
          </label>
          <input
            id="scene-bg-url"
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
            className={styles.textInput}
            disabled={loadingImageUrl}
          />
          {imageUrlError && (
            <small className={styles.error} role="alert">
              {imageUrlError}
            </small>
          )}
          <div className={styles.buttonRow}>
            <button
              type="button"
              onClick={handleLoadImageFromUrl}
              disabled={loadingImageUrl || !imageUrlInput.trim()}
              className={buttonClass(styles.primaryButton)}
            >
              {loadingImageUrl ? 'Loading...' : 'Load'}
            </button>
            <button
              type="button"
              onClick={handleSaveLoadedImageToBaseMaps}
              disabled={!loadedImageFromUrl}
              className={buttonClass(styles.ghostButton)}
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
      )}
    </>
  );

  const renderGridTab = () => {
    const grid = safeScene.gridSettings;
    const gridType = grid.type || 'square';
    return (
      <>
        <ToggleField
          label="Enable grid"
          checked={grid.enabled}
          onChange={(checked) => handleGridSettingChange('enabled', checked)}
        />

        {grid.enabled && (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Grid type</span>
              <div
                className={styles.segmented}
                role="radiogroup"
                aria-label="Grid type"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={gridType === 'square'}
                  className={buttonClass(
                    gridType === 'square'
                      ? styles.segmentActive
                      : styles.segment,
                  )}
                  onClick={() => handleGridSettingChange('type', 'square')}
                >
                  □ Square
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={gridType === 'hex'}
                  className={buttonClass(
                    gridType === 'hex' ? styles.segmentActive : styles.segment,
                  )}
                  onClick={() => handleGridSettingChange('type', 'hex')}
                >
                  ⬡ Hex
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Cell size presets</span>
              <div className={styles.presetRow}>
                {GRID_SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={grid.size === preset}
                    className={buttonClass(
                      grid.size === preset
                        ? styles.presetActive
                        : styles.preset,
                    )}
                    onClick={() => handleGridSettingChange('size', preset)}
                  >
                    {preset}px
                  </button>
                ))}
              </div>
            </div>

            <SliderField
              id="scene-grid-size"
              label="Cell size"
              value={grid.size}
              min={GRID_SIZE_MIN}
              max={GRID_SIZE_MAX}
              step={1}
              unit="px"
              onChange={(size) =>
                handleGridSettingChange('size', Math.round(size))
              }
            />

            {gridType === 'hex' && (
              <SliderField
                id="scene-grid-hex-scale"
                label="Hex scale"
                value={grid.hexScale || 1.0}
                min={0.5}
                max={2}
                step={0.1}
                unit="percent"
                hint="Adjust hex size relative to its square equivalent."
                onChange={(hexScale) =>
                  handleGridSettingChange('hexScale', hexScale)
                }
              />
            )}

            <SliderField
              id="scene-grid-opacity"
              label="Opacity"
              value={grid.opacity}
              min={0}
              max={1}
              step={0.05}
              unit="percent"
              onChange={(opacity) =>
                handleGridSettingChange('opacity', opacity)
              }
            />

            <div className={styles.inlineField}>
              <label htmlFor="scene-grid-color" className={styles.fieldLabel}>
                Line color
              </label>
              <input
                id="scene-grid-color"
                type="color"
                value={grid.color}
                onChange={(e) =>
                  handleGridSettingChange('color', e.target.value)
                }
                className={styles.colorInput}
              />
            </div>

            <div className={styles.toggleGrid}>
              <ToggleField
                label="Snap to grid"
                checked={grid.snapToGrid}
                onChange={(checked) =>
                  handleGridSettingChange('snapToGrid', checked)
                }
              />
              <ToggleField
                label="Show to players"
                checked={grid.showToPlayers}
                onChange={(checked) =>
                  handleGridSettingChange('showToPlayers', checked)
                }
              />
            </div>
          </>
        )}
      </>
    );
  };

  const renderLightingTab = () => {
    const lighting = safeScene.lightingSettings;
    return (
      <>
        <ToggleField
          label="Enable dynamic lighting"
          checked={lighting.enabled}
          onChange={(checked) =>
            handleLightingSettingChange('enabled', checked)
          }
        />

        {lighting.enabled ? (
          <>
            <SliderField
              id="scene-light-ambient"
              label="Ambient light"
              value={lighting.ambientLight}
              min={0}
              max={1}
              step={0.05}
              unit="percent"
              onChange={(ambientLight) =>
                handleLightingSettingChange('ambientLight', ambientLight)
              }
            />
            <SliderField
              id="scene-light-darkness"
              label="Darkness"
              value={lighting.darkness}
              min={0}
              max={1}
              step={0.05}
              unit="percent"
              onChange={(darkness) =>
                handleLightingSettingChange('darkness', darkness)
              }
            />
            <ToggleField
              label="Global illumination"
              checked={lighting.globalIllumination}
              onChange={(checked) =>
                handleLightingSettingChange('globalIllumination', checked)
              }
            />
          </>
        ) : (
          <p className={styles.hint}>
            Turn on dynamic lighting to control ambient light, darkness and
            global illumination.
          </p>
        )}
      </>
    );
  };

  const renderGeneralTab = () => (
    <>
      <div className={styles.field}>
        <label htmlFor="scene-general-name" className={styles.fieldLabel}>
          Scene name
        </label>
        <input
          key={safeScene.name}
          id="scene-general-name"
          className={styles.textInput}
          defaultValue={safeScene.name}
          onBlur={(event) => handleNameSubmit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Description</span>
        {editingDescription ? (
          <textarea
            defaultValue={safeScene.description}
            autoFocus
            aria-label="Scene description"
            onBlur={(e) => handleDescriptionSubmit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingDescription(false);
            }}
            className={`${styles.textInput} ${styles.textarea}`}
            rows={3}
            placeholder="Describe this scene..."
          />
        ) : (
          <button
            type="button"
            className={buttonClass(styles.editableBlock)}
            onClick={() => setEditingDescription(true)}
            title="Click to edit"
          >
            {safeScene.description || 'No description'}
          </button>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Who can see this scene</span>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-label="Scene visibility"
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={safeScene.visibility === option.id}
              className={buttonClass(
                safeScene.visibility === option.id
                  ? styles.segmentActive
                  : styles.segment,
              )}
              onClick={() => handleVisibilityChange(option.id)}
            >
              <span aria-hidden="true">{option.icon}</span> {option.label}
            </button>
          ))}
        </div>
        <small className={styles.hint}>{activeVisibility.help}</small>
      </div>

      <ToggleField
        label="Allow player editing (tokens, drawings, etc.)"
        checked={safeScene.isEditable}
        onChange={(checked) => handleFieldUpdate('isEditable', checked)}
      />

      {/* Danger Zone — isolated at the bottom of General with inline confirm */}
      <div className={styles.dangerZone}>
        <h4 className={styles.dangerTitle}>Danger Zone</h4>

        {pendingDanger === 'objects' ? (
          <div className={styles.confirmBox} role="alert">
            <p>
              Delete {drawingCount} drawing(s), {tokenCount} token(s), and{' '}
              {propCount} prop(s)? This cannot be undone.
            </p>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={buttonClass(styles.dangerButton)}
                onClick={handleDeleteAllObjects}
              >
                Confirm delete
              </button>
              <button
                type="button"
                className={buttonClass(styles.ghostButton)}
                onClick={() => setPendingDanger(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : pendingDanger === 'scene' ? (
          <div className={styles.confirmBox} role="alert">
            <p>Delete “{safeScene.name}”? This cannot be undone.</p>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={buttonClass(styles.dangerButton)}
                onClick={() => {
                  setPendingDanger(null);
                  deleteScene(safeScene.id);
                }}
              >
                Confirm delete
              </button>
              <button
                type="button"
                className={buttonClass(styles.ghostButton)}
                onClick={() => setPendingDanger(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={buttonClass(styles.dangerGhostButton)}
              disabled={totalObjects === 0}
              title={totalObjects === 0 ? 'No objects to delete' : undefined}
              onClick={() => setPendingDanger('objects')}
            >
              Delete All Objects
            </button>
            <button
              type="button"
              className={buttonClass(styles.dangerButton)}
              onClick={() => setPendingDanger('scene')}
            >
              Delete Scene
            </button>
          </div>
        )}
      </div>
    </>
  );

  const tabContent: Record<ScenePanelTab, () => React.ReactNode> = {
    map: renderMapTab,
    grid: renderGridTab,
    lighting: renderLightingTab,
    general: renderGeneralTab,
  };

  return (
    <div className={`scene-panel ${styles.panel}`}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h3 className={styles.title}>Scene Settings</h3>
          <button
            type="button"
            onClick={() => setManagementMode(true)}
            className={buttonClass(styles.ghostButton)}
            title="Manage All Scenes"
          >
            📋 Manage All
          </button>
        </div>

        {/* Scene name is always visible and editable in place */}
        {editingName ? (
          <input
            type="text"
            defaultValue={safeScene.name}
            autoFocus
            aria-label="Scene name"
            onBlur={(e) => handleNameSubmit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit(e.currentTarget.value);
              if (e.key === 'Escape') setEditingName(false);
            }}
            className={`${styles.textInput} ${styles.nameInput}`}
          />
        ) : (
          <button
            type="button"
            className={buttonClass(styles.sceneName)}
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {safeScene.name}
            <span className={styles.editIcon} aria-hidden="true">
              ✎
            </span>
          </button>
        )}

        <div className={styles.meta}>
          <span>ID: {safeScene.id.slice(0, 8)}</span>
          <span aria-hidden="true">•</span>
          <span>
            Updated {new Date(safeScene.updatedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div
        className={styles.tabList}
        role="tablist"
        aria-label="Scene settings sections"
        onKeyDown={handleTabKeyDown}
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`scene-panel-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`scene-panel-tabpanel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={buttonClass(selected ? styles.tabActive : styles.tab)}
              onClick={() => selectTab(tab.id)}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        className={styles.content}
        role="tabpanel"
        id={`scene-panel-tabpanel-${activeTab}`}
        aria-labelledby={`scene-panel-tab-${activeTab}`}
      >
        {tabContent[activeTab]()}
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

// Reset editing, media-source, and confirmation state when selecting a new scene.
export const ScenePanel: React.FC<ScenePanelProps> = ({ scene }) => (
  <ScenePanelContent key={scene?.id ?? 'no-scene'} scene={scene} />
);

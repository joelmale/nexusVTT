import React, { useState, useRef, useTransition, useCallback } from 'react';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Download from 'lucide-react/dist/esm/icons/download';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Check from 'lucide-react/dist/esm/icons/check';
import Search from 'lucide-react/dist/esm/icons/search';
import Crop from 'lucide-react/dist/esm/icons/crop';

import { Icon } from '@/components/Common/Icon';
import {
  getAllIconDefinitions,
  type IconCategory,
  type IconDefinition,
} from '@/services/iconCatalog';
import { useIconStore } from '@/stores/iconStore';
import {
  optimizeIconImage,
  optimizeIconDataUrl,
} from '@/utils/imageOptimizer';
import styles from './IconStudioPanel.module.css';

interface IconCardItemProps {
  icon: IconDefinition;
  isOverridden: boolean;
  onUploadFile: (iconId: string, file: File) => Promise<void>;
  onResetIcon: (iconId: string) => void;
  onTightCrop: (iconId: string) => Promise<void>;
  onCopyPrompt: (prompt: string, iconId: string) => void;
  isCopied: boolean;
}

function IconCardItem({
  icon,
  isOverridden,
  onUploadFile,
  onResetIcon,
  onTightCrop,
  onCopyPrompt,
  isCopied,
}: IconCardItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await onUploadFile(icon.id, file);
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadFile(icon.id, file);
    }
    // Clear input so re-uploading the same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={`${styles.iconCard} ${isOverridden ? styles.overridden : ''} ${
        isDragOver ? styles.dragOver : ''
      }`}
      data-testid={`icon-card-${icon.id}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={styles.cardHeader}>
        <span className={styles.iconName} title={icon.name}>
          {icon.name}
        </span>
        <span
          className={`${styles.badge} ${
            isOverridden ? styles.overrideBadge : styles.defaultBadge
          }`}
        >
          {isOverridden ? 'Local Override' : 'Pack Default'}
        </span>
      </div>

      <div
        className={styles.dropZone}
        onClick={() => fileInputRef.current?.click()}
        title="Drop image here or click to upload"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            fileInputRef.current?.click();
          }
        }}
      >
        <Icon id={icon.id} size={44} />
        <span className={styles.dropText}>
          {isDragOver ? 'Drop to replace' : 'Drop PNG/SVG or click'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.svg"
          className={styles.hiddenInput}
          onChange={handleFileInputChange}
          data-testid={`file-input-${icon.id}`}
        />
      </div>

      <div className={styles.promptBox}>
        <span className={styles.promptLabel}>ComfyUI Prompt</span>
        <span className={styles.promptContent}>{icon.subjectPrompt}</span>
        <button
          type="button"
          className={styles.promptBtn}
          onClick={() => onCopyPrompt(icon.subjectPrompt, icon.id)}
          title="Copy subject prompt for ComfyUI / SD generator"
        >
          {isCopied ? <Check size={11} /> : <Copy size={11} />}
          {isCopied ? 'Copied!' : 'Copy Prompt'}
        </button>
      </div>

      <div className={styles.cardFooter}>
        {isOverridden && (
          <div className={styles.overrideActions}>
            <button
              type="button"
              className={styles.fitBtn}
              onClick={() => onTightCrop(icon.id)}
              title="Crop tightly to remove transparent margins and fit frame"
              data-testid={`fit-btn-${icon.id}`}
            >
              <Crop size={11} />
              Fit
            </button>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => onResetIcon(icon.id)}
              title="Revert to active global pack icon"
              data-testid={`reset-btn-${icon.id}`}
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Universal Icon Studio Panel.
 * Allows DMs and Players to:
 * 1. Switch the room's global campaign icon theme pack.
 * 2. Drag & drop custom image overrides locally onto any slot (client-side only).
 * 3. Inspect ComfyUI prompts for batch asset generation.
 * 4. Export and Import personal icon packs via JSON.
 */
export function IconStudioPanel() {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | IconCategory
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedIconId, setCopiedIconId] = useState<string | null>(null);
  const [tightCropEnabled, setTightCropEnabled] = useState(true);
  const [removeBgEnabled, setRemoveBgEnabled] = useState(false);
  const [, startTransition] = useTransition();

  const importFileInputRef = useRef<HTMLInputElement>(null);

  const globalCampaignPackId = useIconStore(
    (state) => state.globalCampaignPackId,
  );
  const availablePacks = useIconStore((state) => state.availablePacks);
  const localUserOverrides = useIconStore((state) => state.localUserOverrides);
  const setGlobalCampaignPack = useIconStore(
    (state) => state.setGlobalCampaignPack,
  );
  const setLocalUserIcon = useIconStore((state) => state.setLocalUserIcon);
  const clearLocalUserIcon = useIconStore((state) => state.clearLocalUserIcon);
  const clearAllLocalOverrides = useIconStore(
    (state) => state.clearAllLocalOverrides,
  );
  const exportLocalPack = useIconStore((state) => state.exportLocalPack);
  const importLocalPack = useIconStore((state) => state.importLocalPack);

  const overrideCount = Object.keys(localUserOverrides).length;

  const handleUploadFile = useCallback(
    async (iconId: string, file: File) => {
      try {
        const dataUrl = await optimizeIconImage(file, {
          autoCrop: tightCropEnabled,
          removeBackground: removeBgEnabled,
        });
        setLocalUserIcon(iconId, dataUrl);
        setStatusMessage(`Updated ${iconId} with custom override.`);
      } catch (err) {
        setStatusMessage(
          err instanceof Error ? err.message : 'Failed to optimize icon image.',
        );
      }
    },
    [tightCropEnabled, removeBgEnabled, setLocalUserIcon],
  );

  const handleTightCropOverride = useCallback(
    async (iconId: string) => {
      const current = localUserOverrides[iconId];
      if (!current) return;
      try {
        const updated = await optimizeIconDataUrl(current, {
          autoCrop: true,
          removeBackground: removeBgEnabled,
        });
        setLocalUserIcon(iconId, updated);
        setStatusMessage(`Cropped ${iconId} tightly to fit frame.`);
      } catch (err) {
        setStatusMessage(
          err instanceof Error ? err.message : 'Failed to crop icon image.',
        );
      }
    },
    [localUserOverrides, removeBgEnabled, setLocalUserIcon],
  );

  const handleFitAllOverrides = useCallback(async () => {
    const currentOverrides = useIconStore.getState().localUserOverrides;
    const ids = Object.keys(currentOverrides);
    if (ids.length === 0) return;
    try {
      let count = 0;
      for (const id of ids) {
        const current = currentOverrides[id];
        if (current) {
          const updated = await optimizeIconDataUrl(current, {
            autoCrop: true,
            removeBackground: removeBgEnabled,
          });
          setLocalUserIcon(id, updated);
          count++;
        }
      }
      setStatusMessage(`Tight-cropped ${count} icon(s) to fit their frames.`);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Failed to crop icons.',
      );
    }
  }, [removeBgEnabled, setLocalUserIcon]);

  const handleResetIcon = useCallback(
    (iconId: string) => {
      clearLocalUserIcon(iconId);
      setStatusMessage(`Reverted ${iconId} to theme default.`);
    },
    [clearLocalUserIcon],
  );

  const handleCopyPrompt = useCallback((prompt: string, iconId: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt);
      setCopiedIconId(iconId);
      setTimeout(() => setCopiedIconId(null), 2000);
    }
  }, []);

  const handleExport = () => {
    try {
      const json = exportLocalPack('Nexus Custom Pack');
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus-icons-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage(`Exported ${overrideCount} icon overrides to JSON.`);
    } catch {
      setStatusMessage('Failed to export icon pack.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const success = importLocalPack(reader.result);
        if (success) {
          setStatusMessage('Successfully imported custom icon pack!');
        } else {
          setStatusMessage('Invalid icon pack JSON format.');
        }
      }
    };
    reader.onerror = () => {
      setStatusMessage('Failed to read import file.');
    };
    reader.readAsText(file);

    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  };

  // Filter icon catalog definitions
  const allIcons = getAllIconDefinitions();
  const filteredIcons = allIcons.filter((icon) => {
    const matchesCategory =
      selectedCategory === 'all' || icon.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.subjectPrompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={styles.container} data-testid="icon-studio-panel">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>
            <Palette size={20} />
            Icon Studio
          </h2>
          <div className={styles.actionButtonGroup}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleExport}
              title="Export local icon overrides to JSON"
            >
              <Download size={13} />
              Export
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => importFileInputRef.current?.click()}
              title="Import icon overrides from JSON"
            >
              <Upload size={13} />
              Import
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".json,application/json"
              className={styles.hiddenInput}
              onChange={handleImportFile}
              data-testid="import-pack-input"
            />
            {overrideCount > 0 && (
              <>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleFitAllOverrides}
                  title="Crop all active overrides tightly to fill their frames"
                  data-testid="fit-all-btn"
                >
                  <Crop size={13} />
                  Fit All ({overrideCount})
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.dangerBtn}`}
                  onClick={() => {
                    clearAllLocalOverrides();
                    setStatusMessage('Cleared all local icon overrides.');
                  }}
                  title="Reset all local overrides to default"
                >
                  <RotateCcw size={13} />
                  Reset All ({overrideCount})
                </button>
              </>
            )}
          </div>
        </div>
        <p className={styles.subtitle}>
          Personalize UI, condition, and tool icons. Overrides remain local to
          your browser and do not affect other players.
        </p>
      </div>

      {/* Global Campaign Pack Controller & Upload Options */}
      <div className={styles.controlBar}>
        <div className={styles.packSelectorGroup}>
          <span className={styles.packLabel}>Campaign Theme Pack:</span>
          <select
            className={styles.select}
            value={globalCampaignPackId}
            onChange={(e) => {
              const newPack = e.target.value;
              startTransition(() => {
                setGlobalCampaignPack(newPack);
              });
            }}
            data-testid="campaign-pack-select"
          >
            {availablePacks.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.optionsGroup}>
          <label
            className={styles.checkboxLabel}
            title="Automatically crop transparent borders tightly so replaced icons fill the frame"
          >
            <input
              type="checkbox"
              checked={tightCropEnabled}
              onChange={(e) => setTightCropEnabled(e.target.checked)}
              className={styles.checkbox}
              data-testid="tight-crop-toggle"
            />
            <span>Tight Crop</span>
          </label>
          <label
            className={styles.checkboxLabel}
            title="Automatically remove solid corner background when uploading or dropping icons"
          >
            <input
              type="checkbox"
              checked={removeBgEnabled}
              onChange={(e) => setRemoveBgEnabled(e.target.checked)}
              className={styles.checkbox}
              data-testid="remove-bg-toggle"
            />
            <span>Remove Solid BG</span>
          </label>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.categoryTabs}>
          {(['all', 'panels', 'conditions', 'tools'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.tabBtn} ${
                selectedCategory === cat ? styles.activeTab : ''
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.searchBox}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div className={styles.statusBanner} data-testid="status-banner">
          {statusMessage}
        </div>
      )}

      {/* Icon Cards Grid */}
      <div className={styles.iconGrid} data-testid="icon-grid">
        {filteredIcons.map((icon) => (
          <IconCardItem
            key={icon.id}
            icon={icon}
            isOverridden={Boolean(localUserOverrides[icon.id])}
            onUploadFile={handleUploadFile}
            onResetIcon={handleResetIcon}
            onTightCrop={handleTightCropOverride}
            onCopyPrompt={handleCopyPrompt}
            isCopied={copiedIconId === icon.id}
          />
        ))}
      </div>
    </div>
  );
}

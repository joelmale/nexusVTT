import React from 'react';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import styles from './GeneratorSidebar.module.css';

interface AddToSceneBarProps {
  hasActiveScene: boolean;
  hasValidArtifact: boolean;
  activeSceneName?: string;
  isImporting: boolean;
  /** Data URL of the cached export, shown so users see what will be added. */
  previewUrl?: string | null;
  errorMessage?: string | null;
  onAddToScene: () => void;
}

/** Sticky footer: scene status, a preview of the cached map, and the import. */
export const AddToSceneBar: React.FC<AddToSceneBarProps> = ({
  hasActiveScene,
  hasValidArtifact,
  activeSceneName,
  isImporting,
  previewUrl,
  errorMessage,
  onAddToScene,
}) => {
  const canAdd = hasActiveScene && hasValidArtifact && !isImporting;

  return (
    <div className={styles.footer}>
      <div className={styles.scenePill} data-active={hasActiveScene}>
        <MapPin size={13} style={{ flexShrink: 0 }} aria-hidden="true" />
        <span className={styles.sceneName}>
          {hasActiveScene
            ? `Scene: ${activeSceneName || 'Active Scene'}`
            : 'No active scene selected'}
        </span>
      </div>

      {previewUrl && hasValidArtifact && (
        <div className={styles.previewRow}>
          <img
            className={styles.thumb}
            src={previewUrl}
            alt="Preview of the map that will be added"
          />
          <div className={styles.previewText}>
            This is the map that will be added. Style changes update it after a
            moment.
          </div>
        </div>
      )}

      <button
        type="button"
        className={styles.primaryButton}
        onClick={onAddToScene}
        disabled={!canAdd}
        title={
          !hasActiveScene
            ? 'Please select or create an active scene first'
            : !hasValidArtifact
              ? 'No generated map to add to scene.'
              : 'Imports current map as the scene background'
        }
      >
        {isImporting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Capturing & Adding to Scene...</span>
          </>
        ) : (
          '🗺️ Add to Scene'
        )}
      </button>

      {errorMessage && (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      )}
      {!hasActiveScene && (
        <div className={styles.hint}>Select a scene in the Scenes tab to enable.</div>
      )}
    </div>
  );
};

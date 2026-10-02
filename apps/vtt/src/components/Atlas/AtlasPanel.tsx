import React, { useState, useEffect, useRef } from 'react';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import Pin from 'lucide-react/dist/esm/icons/pin';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Layers from 'lucide-react/dist/esm/icons/layers';
import styles from './AtlasPanel.module.css';
import { useAtlasAssets } from '@/hooks/useAtlasAssets';
import { useDockToCanvasDrag, type DragPayload } from '@/hooks/useDockToCanvasDrag';
import { Portal } from '@/components/Portal';
import type { AtlasAsset } from '@/hooks/atlasSources/types';

const TMT_ATTRIBUTION_URL = 'https://github.com/IsThisMyRealName/too-many-tokens-dnd';
const STAGED_ASSETS_KEY = 'nexus-atlas-staged-assets';
const DENSITY_STORAGE_KEY = 'nexus-atlas-density';

type Density = 'S' | 'M' | 'L';

interface StagedAsset {
  id: string;
  name: string;
  thumbnailUrl: string;
  category: 'tokens' | 'props';
  tags?: string[];
}

export const AtlasPanel: React.FC = () => {
  const {
    query,
    setQuery,
    category,
    setCategory,
    assets,
    loading,
    loadingMore,
    loadMore,
    hasMore,
    libraryFacets,
  } = useAtlasAssets();

  // Density state
  const [density, setDensity] = useState<Density>(() => {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (saved === 'S' || saved === 'M' || saved === 'L') return saved;
    } catch {
      // Fallback
    }
    return 'M';
  });

  const handleDensityChange = (d: Density) => {
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, d);
    } catch {
      // Ignore storage errors
    }
  };

  // GM Stage Tray state
  const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>(() => {
    try {
      const saved = localStorage.getItem(STAGED_ASSETS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [];
  });

  const persistStaged = (items: StagedAsset[]) => {
    setStagedAssets(items);
    try {
      localStorage.setItem(STAGED_ASSETS_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  };

  const toggleStageAsset = (asset: AtlasAsset) => {
    const isStaged = stagedAssets.some((item) => item.id === asset.id);
    if (isStaged) {
      persistStaged(stagedAssets.filter((item) => item.id !== asset.id));
    } else {
      const newItem: StagedAsset = {
        id: asset.id,
        name: asset.name,
        thumbnailUrl: asset.thumbnailUrl,
        category: asset.source === 'props' ? 'props' : 'tokens',
        tags: asset.tags,
      };
      persistStaged([newItem, ...stagedAssets]);
    }
  };

  const clearStaged = () => {
    persistStaged([]);
  };

  // Sentinel for pagination (ADR-0008)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  const hasMoreRef = useRef(hasMore);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreRef.current) {
          loadMoreRef.current();
        }
      },
      { root: null, rootMargin: '400px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [assets.length]);

  const showLibraryCredit = assets.some((a) => a.source === 'library');

  // Drag and drop to canvas
  const {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ghostImage,
    ghostPosition,
    overCanvas,
  } = useDockToCanvasDrag();

  // Intrinsic size for CSS containment per density
  const intrinsicSize =
    density === 'S'
      ? '84px 110px'
      : density === 'L'
        ? '160px 190px'
        : '116px 145px';

  const gridClass =
    density === 'S'
      ? styles.gridSmall
      : density === 'L'
        ? styles.gridLarge
        : styles.gridMedium;

  return (
    <div className={styles.container} data-testid="atlas-panel">
      {/* Header & Search */}
      <div className={styles.header}>
        <div className={styles.searchRow}>
          <div className={styles.searchWrapper}>
            <Search size={15} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search tactical assets, monsters, props..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search Atlas assets"
            />
            {query && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => setQuery('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Density Selector */}
          <div className={styles.densityToggle} role="group" aria-label="Grid density">
            <button
              type="button"
              className={`${styles.densityButton} ${density === 'S' ? styles.densityButtonActive : ''}`}
              onClick={() => handleDensityChange('S')}
              title="Compact density"
              aria-label="Compact density"
            >
              S
            </button>
            <button
              type="button"
              className={`${styles.densityButton} ${density === 'M' ? styles.densityButtonActive : ''}`}
              onClick={() => handleDensityChange('M')}
              title="Standard density"
              aria-label="Standard density"
            >
              M
            </button>
            <button
              type="button"
              className={`${styles.densityButton} ${density === 'L' ? styles.densityButtonActive : ''}`}
              onClick={() => handleDensityChange('L')}
              title="Detailed density"
              aria-label="Detailed density"
            >
              L
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className={styles.categoryPills} role="tablist" aria-label="Asset categories">
          <button
            type="button"
            className={`${styles.categoryPill} ${category === 'all' ? styles.categoryPillActive : ''}`}
            onClick={() => setCategory('all')}
          >
            <Layers size={13} aria-hidden="true" /> All
          </button>
          <button
            type="button"
            className={`${styles.categoryPill} ${category === 'pc' ? styles.categoryPillActive : ''}`}
            onClick={() => setCategory('pc')}
          >
            👤 PCs
          </button>
          <button
            type="button"
            className={`${styles.categoryPill} ${category === 'monster' ? styles.categoryPillActive : ''}`}
            onClick={() => setCategory('monster')}
          >
            🐺 Monsters
          </button>
          <button
            type="button"
            className={`${styles.categoryPill} ${category === 'props' ? styles.categoryPillActive : ''}`}
            onClick={() => setCategory('props')}
          >
            📦 Props
          </button>
          {libraryFacets.categories.map((facet) => (
            <button
              key={`facet-${facet.name}`}
              type="button"
              className={`${styles.categoryPill} ${category === facet.name ? styles.categoryPillActive : ''}`}
              onClick={() => setCategory(facet.name)}
            >
              <Sparkles size={11} aria-hidden="true" /> {facet.name} ({facet.count})
            </button>
          ))}
        </div>
      </div>

      {/* GM Stage Tray (Encounter Prep Belt) */}
      {stagedAssets.length > 0 && (
        <div className={styles.stageTray} data-testid="atlas-stage-tray">
          <div className={styles.stageTrayHeader}>
            <span>⚡ Quick Stage Tray ({stagedAssets.length})</span>
            <div className={styles.stageTrayActions}>
              <button
                type="button"
                className={styles.clearTrayBtn}
                onClick={clearStaged}
                title="Clear all staged assets"
                aria-label="Clear all staged assets"
              >
                <Trash2 size={12} style={{ marginRight: '4px' }} /> Clear
              </button>
            </div>
          </div>
          <div className={styles.stageTrayItems}>
            {stagedAssets.map((item) => (
              <div
                key={`staged-${item.id}`}
                className={styles.stagedItem}
                title={`${item.name} - Drag to place on canvas`}
                onPointerDown={(e) => {
                  handlePointerDown(
                    e,
                    {
                      id: item.id,
                      category: item.category,
                      name: item.name,
                      thumbnailUrl: item.thumbnailUrl,
                      tags: item.tags,
                    },
                    item.thumbnailUrl,
                  );
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <img
                  src={item.thumbnailUrl}
                  alt={item.name}
                  className={styles.stagedItemImg}
                  draggable="false"
                />
                <span className={styles.stagedItemName}>{item.name}</span>
                <button
                  type="button"
                  className={styles.removeStagedBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    persistStaged(stagedAssets.filter((s) => s.id !== item.id));
                  }}
                  title="Remove from stage"
                  aria-label={`Remove ${item.name} from stage`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className={styles.content}>
        {loading && assets.length === 0 ? (
          <div className={styles.loadingSpinner}>Loading tactical assets...</div>
        ) : assets.length === 0 ? (
          <div className={styles.emptyState}>No tactical assets found. Try adjusting your search query.</div>
        ) : (
          <>
            <div className={gridClass}>
              {assets.map((asset) => {
                const isStaged = stagedAssets.some((s) => s.id === asset.id);
                const payload: DragPayload = {
                  id: asset.id,
                  category: asset.source === 'props' ? 'props' : 'tokens',
                  name: asset.name,
                  thumbnailUrl: asset.thumbnailUrl,
                  tags: asset.tags,
                  resolveFullAsset: asset.resolveFullAsset,
                };

                return (
                  <div
                    key={asset.id}
                    className={styles.card}
                    style={{
                      touchAction: 'none',
                      contentVisibility: 'auto',
                      containIntrinsicSize: intrinsicSize,
                    }}
                    onPointerDown={(e) => {
                      handlePointerDown(e, payload, asset.thumbnailUrl);
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    <div className={styles.imageWrapper}>
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className={styles.cardImage}
                        draggable="false"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        className={`${styles.pinBadge} ${isStaged ? styles.pinBadgeActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStageAsset(asset);
                        }}
                        title={isStaged ? 'Remove from Quick Stage' : 'Pin to Quick Stage'}
                        aria-label={isStaged ? `Unpin ${asset.name}` : `Pin ${asset.name}`}
                      >
                        <Pin size={13} />
                      </button>
                    </div>

                    <div className={styles.cardMeta}>
                      <div className={styles.cardName} title={asset.name}>
                        {asset.name}
                      </div>
                      <div className={styles.cardSubtext}>
                        <span>{asset.category || asset.source}</span>
                        <span className={styles.sourceBadge}>{asset.source}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Sentinel */}
            <div
              ref={sentinelRef}
              className={styles.loadMoreSentinel}
              data-testid="atlas-load-more-sentinel"
            >
              {loadingMore && <span>Loading more assets…</span>}
            </div>
          </>
        )}
      </div>

      {/* Attribution Footer */}
      {showLibraryCredit && (
        <div className={styles.attributionFooter}>
          Token art courtesy of{' '}
          <a href={TMT_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer">
            Too Many Tokens
          </a>{' '}
          (MIT License).
        </div>
      )}

      {/* Drag Ghost Portal */}
      {isDragging && ghostPosition && ghostImage && (
        <Portal>
          <img
            src={ghostImage}
            alt="ghost"
            style={{
              position: 'fixed',
              left: ghostPosition.x,
              top: ghostPosition.y,
              transform: 'translate(-50%, -50%)',
              width: '64px',
              height: '64px',
              opacity: overCanvas ? 1 : 0.5,
              outline: overCanvas ? '2px solid var(--color-primary)' : 'none',
              pointerEvents: 'none',
              zIndex: 'var(--z-drag-ghost, 95)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              borderRadius: '4px',
            }}
          />
        </Portal>
      )}
    </div>
  );
};

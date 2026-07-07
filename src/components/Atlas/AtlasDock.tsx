import React, { useState, useEffect, useRef } from 'react';
import styles from './AtlasDock.module.css';
import { useAtlasAssets } from '@/hooks/useAtlasAssets';
import { useDockToCanvasDrag } from '@/hooks/useDockToCanvasDrag';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useUIStackStore, useStackZIndex } from '@/stores/uiStackStore';
import { Portal } from '@/components/Portal';

type DockState = 'closed' | 'peek' | 'open';

const TMT_ATTRIBUTION_URL = 'https://github.com/IsThisMyRealName/too-many-tokens-dnd';

export const AtlasDock: React.FC = () => {
  const [dockState, setDockState] = useState<DockState>('closed');
  // Open-once latch (ADR-0009): once the dock has been opened, keep the
  // fetch enabled for the rest of the component's life so closing the dock
  // doesn't abort in-flight requests or force a refetch churn on reopen.
  const [hasOpened, setHasOpened] = useState(false);
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
  } = useAtlasAssets({
    enabled: hasOpened,
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  const hasMoreRef = useRef(hasMore);

  // Keep the refs in sync via effects (not during render) so the
  // IntersectionObserver callback below always sees the latest closures
  // without needing to re-create the observer on every render.
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // ADR-0008: hand-rolled virtualization via content-visibility:auto cards
  // (CSS) + an IntersectionObserver sentinel that triggers cursor pagination
  // instead of a react-window/react-virtual dependency.
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

  // Are library results currently in view (query non-empty always includes
  // library; category filter narrows to library-only when a facet category
  // is selected that only the library source has). Kept simple per brief:
  // show the credit whenever any asset in the current result set is from
  // the library source, or the category selector is showing facet options.
  const showLibraryCredit = assets.some(a => a.source === 'library');
  const libraryCategoryOptions = libraryFacets.categories;

  const {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ghostImage,
    ghostPosition,
    overCanvas
  } = useDockToCanvasDrag();

  const { panelRef: pillRef, onPointerDown: pillDragStart } = useDraggablePanel({
    id: 'atlasPill',
    defaultPosition: {
      x: 20,
      y: typeof window !== 'undefined' ? window.innerHeight - 80 : 800
    }
  });

  const bringToFront = useUIStackStore((state) => state.bringToFront);
  const pillZIndex = useStackZIndex('atlasDock');

  // Handle escape key to close dock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dockState !== 'closed') {
        setDockState('closed');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dockState]);

  if (dockState !== 'closed' && !hasOpened) {
    setHasOpened(true);
  }

  const toggleDock = () => {
    setDockState(prev => {
      if (prev === 'closed') return 'peek';
      if (prev === 'peek') return 'open';
      return 'closed';
    });
  };

  const panelStateClass = 
    dockState === 'closed' ? styles.stateClosed :
    dockState === 'peek' ? styles.statePeek :
    styles.stateOpen;

  return (
    <>
      <Portal>
        <div
          ref={pillRef}
          style={{ 
            position: 'fixed', 
            top: 0,
            left: 0,
            zIndex: pillZIndex,
            display: dockState === 'closed' ? 'block' : 'none'
          }}
          className={styles.draggablePillContainer}
        >
            <button 
              className={styles.pillButton} 
              onClick={() => {
                setDockState('peek');
                bringToFront('atlasDock');
              }}
              title="Open Atlas Library"
            >
              <div 
                className={styles.dragHandle} 
                onPointerDownCapture={(e) => {
                  bringToFront('atlasPill');
                  pillDragStart(e);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                ⠿
              </div>
              <span>📚</span> Atlas
            </button>
        </div>
      </Portal>

      <div className={styles.dockContainer}>


      <div className={`${styles.dockPanel} ${panelStateClass}`}>
        {/* Header / Controls */}
        <div className={styles.dockHeader}>
          <div className={styles.dockControls}>
            <button 
              className={styles.pillButton} 
              style={{ position: 'relative', margin: 0, padding: '6px 16px', borderRadius: '16px' }}
              onClick={toggleDock}
            >
              {dockState === 'peek' ? '🔼 Expand' : '🔽 Collapse'}
            </button>
            <input 
              type="text" 
              className={styles.searchBar}
              placeholder="Search assets..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <select
              className={styles.categorySelect}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="maps">Maps</option>
              <option value="pc">PC Tokens</option>
              <option value="monster">Monster Tokens</option>
              <option value="props">Props</option>
              {libraryCategoryOptions.length > 0 && (
                <optgroup label="Library">
                  {libraryCategoryOptions.map(facet => (
                    <option key={`library-${facet.name}`} value={facet.name}>
                      {facet.name} ({facet.count})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <button 
            className={styles.closeButton}
            onClick={() => setDockState('closed')}
            title="Close Atlas"
          >
            ✕
          </button>
        </div>

        {/* Asset Grid */}
        <div className={styles.dockContent}>
          {loading && assets.length === 0 ? (
            <div className={styles.loadingSpinner}>Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className={styles.emptyState}>No assets found. Try adjusting your search.</div>
          ) : (
            <>
              <div className={styles.assetGrid}>
                {assets.map(asset => (
                  <div
                    key={asset.id}
                    className={styles.assetCard}
                    style={{ touchAction: 'none', contentVisibility: 'auto', containIntrinsicSize: '120px 156px' }}
                    onPointerDown={(e) => {
                      handlePointerDown(e, {
                        id: asset.id,
                        category: (asset.category === 'props' ? 'props' : 'tokens') as 'tokens' | 'props',
                      }, asset.thumbnailUrl);
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    <img src={asset.thumbnailUrl} alt={asset.name} className={styles.assetImage} draggable="false" loading="lazy" />
                    <div className={styles.assetName} title={asset.name}>{asset.name}</div>
                    <div className={styles.assetSource}>{asset.source}</div>
                  </div>
                ))}
              </div>
              {/* Sentinel for IntersectionObserver-driven cursor pagination (ADR-0008) */}
              <div ref={sentinelRef} className={styles.loadMoreSentinel} data-testid="atlas-load-more-sentinel">
                {loadingMore && <span className={styles.loadingSpinnerInline}>Loading more…</span>}
              </div>
              {showLibraryCredit && (
                <div className={styles.attributionFooter}>
                  Token art courtesy of{' '}
                  <a href={TMT_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer">
                    Too Many Tokens
                  </a>{' '}
                  (MIT License).
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Drag Ghost */}
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
              borderRadius: '4px'
            }}
          />
        </Portal>
      )}
    </div>
    </>
  );
};

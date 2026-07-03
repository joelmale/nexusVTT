import React, { useState, useEffect } from 'react';
import styles from './AtlasDock.module.css';
import { useAtlasAssets } from '@/hooks/useAtlasAssets';

type DockState = 'closed' | 'peek' | 'open';

export const AtlasDock: React.FC = () => {
  const [dockState, setDockState] = useState<DockState>('closed');
  // Open-once latch (ADR-0009): once the dock has been opened, keep the
  // fetch enabled for the rest of the component's life so closing the dock
  // doesn't abort in-flight requests or force a refetch churn on reopen.
  const [hasOpened, setHasOpened] = useState(false);
  const { query, setQuery, category, setCategory, assets, loading } = useAtlasAssets({
    enabled: hasOpened,
  });

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

  useEffect(() => {
    if (dockState !== 'closed' && !hasOpened) {
      setHasOpened(true);
    }
  }, [dockState, hasOpened]);

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
    <div className={styles.dockContainer}>
      {dockState === 'closed' && (
        <button 
          className={styles.pillButton} 
          onClick={() => setDockState('peek')}
          title="Open Atlas Library"
        >
          <span>📚</span> Atlas
        </button>
      )}

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
            <div className={styles.assetGrid}>
              {assets.map(asset => (
                <div 
                  key={asset.id} 
                  className={styles.assetCard}
                  draggable="true"
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'asset',
                      id: asset.id,
                      source: asset.source,
                      name: asset.name,
                      category: asset.category,
                      url: asset.thumbnailUrl
                    }));
                  }}
                >
                  <img src={asset.thumbnailUrl} alt={asset.name} className={styles.assetImage} draggable="false" />
                  <div className={styles.assetName} title={asset.name}>{asset.name}</div>
                  <div className={styles.assetSource}>{asset.source}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { assetManager, type AssetMetadata } from '@/services/assetManager';

interface AssetBrowserProps {
  onAssetSelect?: (asset: AssetMetadata) => void;
  selectedCategory?: string;
}

export const AssetBrowser: React.FC<AssetBrowserProps> = ({
  onAssetSelect,
  selectedCategory = 'all',
}) => {
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(selectedCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery) {
        const results = await assetManager.searchAssets(searchQuery);
        setAssets(results);
        setHasMore(false);
        setPage(0); // Reset page on new search
      } else {
        const result = await assetManager.getAssetsByCategory(category, 0, 20);
        setAssets(result.assets);
        setHasMore(result.hasMore);
        setPage(0);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  }, [category, searchQuery]);

  const loadCategories = useCallback(async () => {
    try {
      const categories = await assetManager.getCategories();
      setCategories(['all', ...categories]);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const loadCacheSize = useCallback(async () => {
    try {
      const size = await assetManager.getCacheSize();
      setCacheSize(size);
    } catch (error) {
      console.error('Failed to get cache size:', error);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadAssets();
    loadCategories();
    loadCacheSize();
  }, [loadAssets, loadCategories, loadCacheSize]);

  const loadMore = async () => {
    if (!hasMore || searchQuery) return;

    try {
      const result = await assetManager.getAssetsByCategory(
        category,
        page + 1,
        20,
      );
      setAssets((prev) => [...prev, ...result.assets]);
      setHasMore(result.hasMore);
      setPage(page + 1);
    } catch (error) {
      console.error('Failed to load more assets:', error);
    }
  };

  const handleClearCache = async () => {
    if (
      confirm(
        'Clear all cached map assets? This will free up storage but assets will need to be downloaded again.',
      )
    ) {
      try {
        await assetManager.clearCache();
        setCacheSize(0);
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="asset-browser">
      <div className="asset-browser-header">
        <h3>Map Asset Library</h3>
        <div className="cache-info">
          <span>Cache: {formatFileSize(cacheSize)}</span>
          {cacheSize > 0 && (
            <button
              className="btn btn-small btn-secondary"
              onClick={handleClearCache}
            >
              Clear Cache
            </button>
          )}
        </div>
      </div>

      <div className="asset-controls">
        <div className="asset-search">
          <input
            type="text"
            placeholder="Search maps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="category-filter">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="category-select"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all'
                  ? 'All Categories'
                  : cat
                      .replace('-', ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="asset-loading">
          <div className="loading-spinner"></div>
          <span>Loading maps...</span>
        </div>
      ) : (
        <>
          <div className="asset-grid">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="asset-card"
                onClick={() => onAssetSelect?.(asset)}
              >
                <div className="asset-thumbnail">
                  <img
                    src={assetManager.getThumbnailUrl(asset)}
                    alt={asset.name}
                    loading="lazy"
                  />
                  <div className="asset-overlay">
                    <span className="asset-size">
                      {asset.dimensions.width} × {asset.dimensions.height}
                    </span>
                  </div>
                </div>
                <div className="asset-info">
                  <h4 className="asset-name">{asset.name}</h4>
                  <span className="asset-meta">
                    {formatFileSize(asset.fileSize)} •{' '}
                    {asset.format.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="load-more">
              <button className="btn btn-secondary" onClick={loadMore}>
                Load More Maps
              </button>
            </div>
          )}

          {assets.length === 0 && !loading && (
            <div className="no-assets">
              <p>No maps found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

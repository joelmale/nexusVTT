import React from 'react';
import { useAtlasAssets } from '@/hooks/useAtlasAssets';

export const AtlasDevHarness: React.FC = () => {
  const { query, setQuery, category, setCategory, assets, loading, offlineSources, refresh } = useAtlasAssets();

  return (
    <div style={{ padding: 20, color: '#fff', background: '#1e1e1e', minHeight: '100vh' }}>
      <h1>Atlas Federation Dev Harness</h1>
      
      <div style={{ marginBottom: 20 }}>
        <input 
          type="text" 
          placeholder="Search assets..." 
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ padding: 8, marginRight: 10, width: 300 }}
        />
        <select 
          value={category} 
          onChange={e => setCategory(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="all">All Categories</option>
          <option value="maps">Maps</option>
          <option value="pc">PC Tokens</option>
          <option value="monster">Monster Tokens</option>
        </select>
        <button onClick={refresh} style={{ padding: 8 }}>Refresh</button>
      </div>

      {offlineSources.length > 0 && (
        <div style={{ background: '#5a2a2a', padding: 10, marginBottom: 20, borderRadius: 4 }}>
          <strong>Offline Sources:</strong> {offlineSources.join(', ')}
        </div>
      )}

      {loading && <div>Loading...</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 15, marginTop: 20 }}>
        {assets.map(asset => (
          <div key={asset.id} style={{ background: '#2a2a2a', padding: 10, borderRadius: 8 }}>
            <img 
              src={asset.thumbnailUrl} 
              alt={asset.name} 
              style={{ width: '100%', height: 120, objectFit: 'contain', background: '#000' }} 
            />
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {asset.name}
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Source: <span style={{ color: '#4da6ff' }}>{asset.source}</span>
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              ID: {asset.id}
            </div>
          </div>
        ))}
        {!loading && assets.length === 0 && <div>No assets found.</div>}
      </div>
    </div>
  );
};

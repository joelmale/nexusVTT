import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { useTokenAssets } from '@/services/tokenAssets';
import { TokenLibraryManager } from './TokenLibraryManager';
import { TokenCreationPanel } from './TokenCreationPanel';
import { TokenConfigPanel } from './TokenConfigPanel';
import { DraggableToken } from './DraggableToken';
import { TokenCategoryTabs } from './TokenCategoryTabs';
import type { Token } from '@/types/token';

interface TokenPanelProps {
  onTokenSelect?: (token: Token) => void;
}

export const TokenPanel: React.FC<TokenPanelProps> = ({ onTokenSelect }) => {
  const { getAllTokens, updateToken } = useTokenAssets();
  const [showLibraryManager, setShowLibraryManager] = useState(false);
  const [showCreationPanel, setShowCreationPanel] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Defer expensive search operations to prevent blocking UI
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [activeCategory, setActiveCategory] = useState<
    'all' | 'pc' | 'npc' | 'monster'
  >(() => {
    const saved = localStorage.getItem('tokenPanel.activeCategory');
    if (saved && ['all', 'pc', 'npc', 'monster'].includes(saved)) {
      return saved as 'all' | 'pc' | 'npc' | 'monster';
    }
    return 'all';
  });

  const allTokens = getAllTokens();

  // Save active category to localStorage
  useEffect(() => {
    localStorage.setItem('tokenPanel.activeCategory', activeCategory);
  }, [activeCategory]);

  // Category counts
  const categoryCounts = useMemo(
    () => ({
      all: allTokens.length,
      pc: allTokens.filter((t) => t.category === 'pc').length,
      npc: allTokens.filter((t) => t.category === 'npc').length,
      monster: allTokens.filter((t) => t.category === 'monster').length,
    }),
    [allTokens],
  );

  // Filtered tokens based on active category and search
  const filteredTokens = useMemo(() => {
    let tokens = allTokens;

    // Filter by category
    if (activeCategory !== 'all') {
      tokens = tokens.filter((t) => t.category === activeCategory);
    }

    // Filter by search (scoped to active category)
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      tokens = tokens.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return tokens;
  }, [allTokens, activeCategory, deferredSearchQuery]);

  const handleTokenClick = (token: Token) => {
    if (onTokenSelect) {
      onTokenSelect(token);
    }
  };

  const handleTokenConfigure = (token: Token) => {
    setSelectedToken(token);
    setShowConfigPanel(true);
  };

  const handleTokenConfigSave = async (updates: Partial<Token>) => {
    if (!selectedToken) return;

    try {
      await updateToken(selectedToken.id, updates);
      setShowConfigPanel(false);
      setSelectedToken(null);
    } catch (error) {
      console.error('Failed to update token:', error);
      alert('Failed to save token configuration');
    }
  };

  return (
    <>
      <div
        className="token-panel-wrapper"
        style={{
          height: '100%',
          display: 'flex',
        }}
      >
        {/* Category Tabs */}
        <TokenCategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categoryCounts={categoryCounts}
        />

        {/* Main Panel Content */}
        <div
          className="token-panel-main"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Optimized Header */}
          <div
            className="token-panel-header"
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--glass-border)',
              background: 'var(--glass-surface-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'var(--glass-text)',
              }}
            >
              Tokens
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowCreationPanel(true)}
                title="Create Token"
                className="token-action-btn"
                style={{
                  width: '36px',
                  height: '36px',
                  padding: '0',
                  background: 'var(--color-primary)',
                  color: 'var(--glass-text)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-secondary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                +
              </button>
              <button
                onClick={() => setShowLibraryManager(true)}
                title="Manage Libraries"
                className="token-action-btn"
                style={{
                  width: '36px',
                  height: '36px',
                  padding: '0',
                  background: 'var(--color-accent)',
                  color: 'var(--glass-text)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-secondary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Search */}
          <div
            className="token-search-container"
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--glass-border)',
              background: 'var(--glass-surface)',
            }}
          >
            <input
              type="text"
              placeholder={`Search ${activeCategory === 'all' ? 'all' : activeCategory} tokens...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="token-search-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--glass-surface-strong)',
                color: 'var(--glass-text)!important',
                transition: 'all 0.2s',
              }}
            />
          </div>

          {/* Token Grid */}
          <div
            className="token-grid-container"
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              background: 'var(--glass-surface)',
            }}
          >
            {filteredTokens.length === 0 ? (
              <div
                className="token-empty-state"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--glass-text-muted)',
                  fontSize: '16px',
                  gap: '16px',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                {searchQuery.trim() ? (
                  <>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: 'bold',
                      }}
                    >
                      No matches found
                    </p>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      Try different keywords
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: 'bold',
                      }}
                    >
                      No {activeCategory === 'all' ? '' : activeCategory} tokens
                      yet
                    </p>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      Create or import{' '}
                      {activeCategory === 'all' ? '' : activeCategory} tokens to
                      get started
                    </p>
                    <button
                      onClick={() => setShowCreationPanel(true)}
                      className="token-create-btn"
                      style={{
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: 'var(--color-primary)',
                        color: 'var(--glass-text)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        marginTop: '8px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          'var(--color-secondary)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          'var(--color-primary)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      + Create{' '}
                      {activeCategory === 'all'
                        ? ''
                        : activeCategory.toUpperCase()}{' '}
                      Token
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '12px',
                }}
              >
                {filteredTokens.map((token) => (
                  <DraggableToken
                    key={token.id}
                    token={token}
                    onClick={handleTokenClick}
                    onConfigure={handleTokenConfigure}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showLibraryManager && (
        <TokenLibraryManager
          isOpen={showLibraryManager}
          onClose={() => setShowLibraryManager(false)}
          onTokenSelect={(token) => {
            handleTokenClick(token);
            setShowLibraryManager(false);
          }}
        />
      )}

      {showCreationPanel && (
        <TokenCreationPanel
          isOpen={showCreationPanel}
          onClose={() => setShowCreationPanel(false)}
          onTokenCreated={() => {
            setShowCreationPanel(false);
          }}
        />
      )}

      {showConfigPanel && selectedToken && (
        <TokenConfigPanel
          token={selectedToken}
          isOpen={showConfigPanel}
          onClose={() => {
            setShowConfigPanel(false);
            setSelectedToken(null);
          }}
          onSave={handleTokenConfigSave}
        />
      )}
    </>
  );
};

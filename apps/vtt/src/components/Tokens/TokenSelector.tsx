import React, { useState, useMemo, useDeferredValue } from 'react';
import { useTokenAssets } from '@/services/tokenAssets';
import { useTokenInterfaceStrategy } from '@/hooks/useDeviceDetection';
import type { Token, TokenCategory } from '@/types/token';
import { TokenLibraryManager } from './TokenLibraryManager';

interface InterfaceConfig {
  tokenGridColumns: number;
  tokenSize: 'small' | 'medium';
  showThumbnails: boolean;
  enableSearch: boolean;
  enableFilters: boolean;
  maxVisibleCategories: number;
}

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenSelect: (token: Token) => void;
  selectedToken?: Token | null;
}

const TOKEN_CATEGORIES: { id: TokenCategory; label: string; icon: string }[] = [
  { id: 'pc', label: 'Players', icon: '🧙‍♂️' },
  { id: 'npc', label: 'NPCs', icon: '👤' },
  { id: 'monster', label: 'Monsters', icon: '👹' },
  { id: 'object', label: 'Objects', icon: '📦' },
  { id: 'vehicle', label: 'Vehicles', icon: '🚗' },
  { id: 'effect', label: 'Effects', icon: '✨' },
];

interface TokenGridProps {
  interfaceConfig: InterfaceConfig;
  filteredTokens: Token[];
  selectedToken: Token | null | undefined;
  handleTokenClick: (token: Token) => void;
}

const TokenGrid: React.FC<TokenGridProps> = ({
  interfaceConfig,
  filteredTokens,
  selectedToken,
  handleTokenClick,
}) => (
  <div
    className="token-grid"
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${interfaceConfig.tokenGridColumns}, 1fr)`,
      gap: '8px',
      padding: '16px',
      maxHeight: '60vh',
      overflowY: 'auto',
    }}
  >
    {filteredTokens.map((token) => (
      <div
        key={token.id}
        className={`token-item ${selectedToken?.id === token.id ? 'selected' : ''}`}
        onClick={() => handleTokenClick(token)}
        style={{
          border: '2px solid transparent',
          borderColor: selectedToken?.id === token.id ? '#007bff' : '#ddd',
          borderRadius: '8px',
          padding: '8px',
          cursor: 'pointer',
          textAlign: 'center',
          backgroundColor:
            selectedToken?.id === token.id ? '#e3f2fd' : '#f9f9f9',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (selectedToken?.id !== token.id) {
            e.currentTarget.style.borderColor = '#007bff';
            e.currentTarget.style.backgroundColor = '#f0f8ff';
          }
        }}
        onMouseLeave={(e) => {
          if (selectedToken?.id !== token.id) {
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#f9f9f9';
          }
        }}
      >
        <div
          style={{
            width: interfaceConfig.tokenSize === 'small' ? '40px' : '60px',
            height: interfaceConfig.tokenSize === 'small' ? '40px' : '60px',
            margin: '0 auto 8px',
            backgroundImage: `url(${token.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '50%',
            border: '1px solid #ccc',
          }}
        />
        <div
          style={{
            fontSize: interfaceConfig.tokenSize === 'small' ? '10px' : '12px',
            fontWeight: 'bold',
            color: '#333',
            lineHeight: '1.2',
            wordBreak: 'break-word',
          }}
        >
          {token.name}
        </div>
        {token.size !== 'medium' && (
          <div
            style={{
              fontSize: '10px',
              color: '#666',
              marginTop: '2px',
            }}
          >
            {token.size}
          </div>
        )}
      </div>
    ))}
  </div>
);

interface CategoryTabsProps {
  interfaceConfig: InterfaceConfig;
  activeCategory: TokenCategory;
  setActiveCategory: (category: TokenCategory) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  interfaceConfig,
  activeCategory,
  setActiveCategory,
}) => (
  <div
    className="category-tabs"
    style={{ display: 'flex', borderBottom: '1px solid #ddd' }}
  >
    {TOKEN_CATEGORIES.slice(0, interfaceConfig.maxVisibleCategories).map(
      (category) => (
        <button
          key={category.id}
          onClick={() => setActiveCategory(category.id)}
          style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            backgroundColor:
              activeCategory === category.id ? '#007bff' : 'transparent',
            color: activeCategory === category.id ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{category.icon}</span>
          <span>{category.label}</span>
        </button>
      ),
    )}
  </div>
);

interface SearchBarProps {
  interfaceConfig: InterfaceConfig;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  interfaceConfig,
  searchQuery,
  setSearchQuery,
}) =>
  interfaceConfig.enableSearch ? (
    <div style={{ padding: '16px' }}>
      <input
        type="text"
        placeholder="Search tokens..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '14px',
        }}
      />
    </div>
  ) : null;

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  isOpen,
  onClose,
  onTokenSelect,
  selectedToken,
}) => {
  const { getTokensByCategory, searchTokens, isLoading } = useTokenAssets();
  const { strategy, interfaceConfig } = useTokenInterfaceStrategy();

  const [activeCategory, setActiveCategory] = useState<TokenCategory>('pc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLibraryManager, setShowLibraryManager] = useState(false);

  // Defer expensive search operations to prevent blocking UI
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredTokens = useMemo(() => {
    if (deferredSearchQuery.trim()) {
      return searchTokens(deferredSearchQuery);
    }

    return getTokensByCategory(activeCategory);
  }, [getTokensByCategory, searchTokens, deferredSearchQuery, activeCategory]);

  const handleTokenClick = (token: Token) => {
    onTokenSelect(token);
    if (strategy === 'modal') {
      onClose();
    }
  };

  if (!isOpen || isLoading) {
    return null;
  }

  // Modal rendering for mobile/tablet
  if (strategy === 'modal') {
    return (
      <div
        className="token-selector-modal"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 'var(--z-modal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: '500px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid #ddd',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              Select Token
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setShowLibraryManager(true)}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                📚 Libraries
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          </div>

          <SearchBar
            interfaceConfig={interfaceConfig}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          <CategoryTabs
            interfaceConfig={interfaceConfig}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
          <TokenGrid
            interfaceConfig={interfaceConfig}
            filteredTokens={filteredTokens}
            selectedToken={selectedToken}
            handleTokenClick={handleTokenClick}
          />
        </div>
      </div>
    );
  }

  // Sidebar rendering for desktop with touch
  if (strategy === 'sidebar') {
    return (
      <div
        className="token-selector-sidebar"
        style={{
          position: 'fixed',
          right: isOpen ? 0 : '-400px',
          top: 0,
          bottom: 0,
          width: '400px',
          backgroundColor: 'white',
          boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.1)',
          zIndex: 'var(--z-panel)',
          transition: 'right 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #ddd',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            Tokens
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowLibraryManager(true)}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              📚 Libraries
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        </div>

        <SearchBar
          interfaceConfig={interfaceConfig}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <CategoryTabs
          interfaceConfig={interfaceConfig}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TokenGrid
            interfaceConfig={interfaceConfig}
            filteredTokens={filteredTokens}
            selectedToken={selectedToken}
            handleTokenClick={handleTokenClick}
          />
        </div>
      </div>
    );
  }

  // Floating window placeholder (to be implemented later)
  return (
    <>
      <div>Floating window not yet implemented</div>

      {/* Token Library Manager */}
      {showLibraryManager && (
        <TokenLibraryManager
          isOpen={showLibraryManager}
          onClose={() => setShowLibraryManager(false)}
          onTokenSelect={(token) => {
            onTokenSelect(token);
            setShowLibraryManager(false);
          }}
        />
      )}
    </>
  );
};

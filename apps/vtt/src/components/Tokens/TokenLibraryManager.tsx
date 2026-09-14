import React, { useState } from 'react';
import { tokenAssetManager, useTokenAssets } from '@/services/tokenAssets';
import type { TokenLibrary, Token } from '@/types/token';
import { TokenCreationPanel } from './TokenCreationPanel';

interface TokenLibraryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenSelect?: (token: Token) => void;
}

export const TokenLibraryManager: React.FC<TokenLibraryManagerProps> = ({
  isOpen,
  onClose,
  onTokenSelect,
}) => {
  const { getLibraries } = useTokenAssets();
  const [libraries, setLibraries] = useState<TokenLibrary[]>(getLibraries());
  const [selectedLibrary, setSelectedLibrary] = useState<TokenLibrary | null>(
    libraries[0] || null,
  );
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [isCreatingLibrary, setIsCreatingLibrary] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newLibraryDescription, setNewLibraryDescription] = useState('');

  if (!isOpen) return null;

  const refreshLibraries = () => {
    const updated = getLibraries();
    setLibraries(updated);
    if (selectedLibrary) {
      const updatedSelected = updated.find(
        (lib) => lib.id === selectedLibrary.id,
      );
      setSelectedLibrary(updatedSelected || updated[0] || null);
    }
  };

  const handleCreateLibrary = () => {
    if (!newLibraryName.trim()) {
      alert('Please enter a library name');
      return;
    }

    const newLibrary = tokenAssetManager.createCustomLibrary(
      newLibraryName.trim(),
      newLibraryDescription.trim() || undefined,
    );

    setNewLibraryName('');
    setNewLibraryDescription('');
    setIsCreatingLibrary(false);
    refreshLibraries();
    setSelectedLibrary(newLibrary);
  };

  const handleTokenCreated = (_token: Token) => {
    refreshLibraries();
    setIsCreatingToken(false);
  };

  const handleTokenClick = (token: Token) => {
    if (onTokenSelect) {
      onTokenSelect(token);
      onClose();
    }
  };

  const getStats = () => {
    const stats = tokenAssetManager.getCacheStats();
    return stats;
  };

  const stats = getStats();

  return (
    <>
      <div
        className="token-library-manager"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 'var(--z-panel)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={onClose}
      >
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                Token Library Manager
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
                {stats.totalTokens} tokens across {stats.libraries} libraries
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '28px',
                cursor: 'pointer',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar - Libraries */}
            <div
              style={{
                width: '280px',
                borderRight: '1px solid #e0e0e0',
                padding: '16px',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  Libraries
                </h3>
                <button
                  onClick={() => setIsCreatingLibrary(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#007bff',
                  }}
                  title="Create new library"
                >
                  +
                </button>
              </div>

              {isCreatingLibrary && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Library name"
                    value={newLibraryName}
                    onChange={(e) => setNewLibraryName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newLibraryDescription}
                    onChange={(e) => setNewLibraryDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleCreateLibrary}
                      className="primary"
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#007bff',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingLibrary(false);
                        setNewLibraryName('');
                        setNewLibraryDescription('');
                      }}
                      className="secondary"
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {libraries.map((library) => (
                  <div
                    key={library.id}
                    onClick={() => setSelectedLibrary(library)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor:
                        selectedLibrary?.id === library.id
                          ? '#e3f2fd'
                          : '#f9f9f9',
                      border:
                        selectedLibrary?.id === library.id
                          ? '2px solid #007bff'
                          : '1px solid #e0e0e0',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: '14px',
                        marginBottom: '4px',
                      }}
                    >
                      {library.name}
                      {library.isDefault && (
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: '#666',
                          }}
                        >
                          (Default)
                        </span>
                      )}
                    </div>
                    {library.description && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '4px',
                        }}
                      >
                        {library.description}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {library.tokens.length} tokens
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content - Tokens */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Toolbar */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #e0e0e0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3
                    style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}
                  >
                    {selectedLibrary?.name || 'Select a library'}
                  </h3>
                  {selectedLibrary?.description && (
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '13px',
                        color: '#666',
                      }}
                    >
                      {selectedLibrary.description}
                    </p>
                  )}
                </div>
                {selectedLibrary && (
                  <button
                    onClick={() => setIsCreatingToken(true)}
                    className="primary"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#007bff',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    + Create Token
                  </button>
                )}
              </div>

              {/* Token Grid */}
              <div
                style={{
                  flex: 1,
                  padding: '24px',
                  overflowY: 'auto',
                }}
              >
                {!selectedLibrary ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#999',
                      fontSize: '16px',
                    }}
                  >
                    Select a library to view tokens
                  </div>
                ) : selectedLibrary.tokens.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#999',
                      fontSize: '16px',
                      gap: '16px',
                    }}
                  >
                    <p>This library has no tokens yet</p>
                    <button
                      onClick={() => setIsCreatingToken(true)}
                      className="primary"
                      style={{
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#007bff',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      + Create Your First Token
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {selectedLibrary.tokens.map((token) => (
                      <div
                        key={token.id}
                        onClick={() => handleTokenClick(token)}
                        style={{
                          border: '1px solid #e0e0e0',
                          borderRadius: '12px',
                          padding: '12px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          backgroundColor: 'white',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#007bff';
                          e.currentTarget.style.boxShadow =
                            '0 4px 12px rgba(0, 123, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e0e0e0';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: '100px',
                            backgroundImage: `url(${token.thumbnailImage || token.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            border: '1px solid #ccc',
                          }}
                        />
                        <div
                          style={{
                            fontWeight: 'bold',
                            fontSize: '13px',
                            marginBottom: '4px',
                            lineHeight: '1.3',
                          }}
                        >
                          {token.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#666',
                            marginBottom: '4px',
                          }}
                        >
                          {token.size} • {token.category}
                        </div>
                        {token.isCustom && (
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#007bff',
                              backgroundColor: '#e3f2fd',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              display: 'inline-block',
                            }}
                          >
                            Custom
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Creation Panel */}
      {isCreatingToken && (
        <TokenCreationPanel
          isOpen={isCreatingToken}
          onClose={() => setIsCreatingToken(false)}
          onTokenCreated={handleTokenCreated}
        />
      )}
    </>
  );
};

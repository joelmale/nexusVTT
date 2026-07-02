import React, { useState } from 'react';

interface GeneratorFloatingControlsProps {
  activeGenerator: 'dungeon' | 'cave' | 'world' | 'city' | 'dwelling';
  onGeneratorChange: (
    generator: 'dungeon' | 'cave' | 'world' | 'city' | 'dwelling',
  ) => void;
  onAddToScene: () => void;
  onUploadJSON?: () => void;
  hasActiveScene: boolean;
}

export const GeneratorFloatingControls: React.FC<
  GeneratorFloatingControlsProps
> = ({
  activeGenerator,
  onGeneratorChange,
  onAddToScene,
  onUploadJSON,
  hasActiveScene,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const generators = [
    { id: 'dungeon' as const, icon: '🏰', label: 'Dungeon' },
    { id: 'cave' as const, icon: '🗻', label: 'Cave' },
    { id: 'world' as const, icon: '🌍', label: 'World' },
    { id: 'city' as const, icon: '🏛️', label: 'City' },
    { id: 'dwelling' as const, icon: '🏠', label: 'Dwelling' },
  ];

  const shortcuts = {
    dungeon: [
      { key: 'Enter', desc: 'New dungeon' },
      { key: 'E', desc: 'Save PNG' },
      { key: 'S', desc: 'Style' },
      { key: 'Tab', desc: 'Tags' },
      { key: 'J', desc: 'JSON' },
      { key: 'G', desc: 'Grid' },
      { key: 'N', desc: 'Notes' },
      { key: 'L', desc: 'Legend' },
      { key: 'H', desc: 'Secrets' },
      { key: 'M', desc: 'Mono' },
      { key: 'W', desc: 'Water' },
      { key: 'Shift+W', desc: 'Water height' },
      { key: 'P', desc: 'Props' },
      { key: 'C', desc: 'Corners' },
      { key: 'R', desc: 'Rotate' },
      { key: 'Space', desc: 'Rearrange' },
      { key: 'Shift+Space', desc: 'Reroll notes' },
      { key: '1', desc: 'Normal cells' },
      { key: '2', desc: 'Small cells' },
      { key: 'Shift+G', desc: 'Grid mode' },
    ],
    cave: [
      { key: 'Enter', desc: 'New cave' },
      { key: 'E', desc: 'Save PNG' },
      { key: 'S', desc: 'Style' },
      { key: 'Tab', desc: 'Tags' },
      { key: 'G', desc: 'Grid' },
      { key: 'N', desc: 'Notes' },
    ],
    world: [
      { key: 'Enter', desc: 'New world' },
      { key: 'E', desc: 'Save PNG' },
      { key: 'S', desc: 'Style' },
      { key: 'Tab', desc: 'Tags' },
      { key: 'G', desc: 'Grid' },
      { key: 'N', desc: 'Names' },
    ],
    city: [
      { key: 'Enter', desc: 'New city' },
      { key: 'E', desc: 'Save PNG' },
      { key: 'S', desc: 'Style' },
      { key: 'C', desc: 'Citadel' },
      { key: 'T', desc: 'Temple' },
      { key: 'P', desc: 'Plaza' },
    ],
    dwelling: [],
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        zIndex: 'var(--z-tool-ui)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.5rem',
        maxWidth: isExpanded ? '350px' : '60px',
        transition: 'max-width 0.3s ease',
      }}
    >
      {/* Main Control Panel - Render first so it appears at the top */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: isExpanded ? '1rem' : '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          transition: 'all 0.3s ease',
          width: isExpanded ? '100%' : 'auto',
        }}
      >
        {/* Toggle Button */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            style={{
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              padding: '0.75rem',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Open controls"
          >
            🎮
          </button>
        )}

        {/* Expanded Panel */}
        {isExpanded && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            {/* Header with collapse button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                🎮 Controls
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  padding: 0,
                  lineHeight: 1,
                }}
                title="Collapse"
              >
                ⊗
              </button>
            </div>

            {/* Generator Selection */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
              }}
            >
              <label
                style={{
                  fontSize: '0.75rem',
                  color: '#aaa',
                  fontWeight: 500,
                  marginBottom: '0.25rem',
                }}
              >
                Generator
              </label>
              {generators.map((gen) => (
                <button
                  key={gen.id}
                  onClick={() => onGeneratorChange(gen.id)}
                  className="glass-button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem',
                    fontSize: '0.8125rem',
                    background:
                      activeGenerator === gen.id
                        ? 'rgba(99, 102, 241, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      activeGenerator === gen.id
                        ? '1px solid rgba(99, 102, 241, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {gen.icon} {gen.label}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <button
                onClick={onAddToScene}
                className="glass-button primary"
                disabled={!hasActiveScene}
                style={{
                  width: '100%',
                  cursor: hasActiveScene ? 'pointer' : 'not-allowed',
                  opacity: hasActiveScene ? 1 : 0.5,
                  fontSize: '0.8125rem',
                  padding: '0.5rem',
                }}
                title={
                  !hasActiveScene
                    ? 'No active scene selected. Create or select a scene first.'
                    : 'Add map to active scene'
                }
              >
                🗺️ Add to Scene
              </button>

              {activeGenerator === 'dungeon' && onUploadJSON && (
                <button
                  onClick={onUploadJSON}
                  className="glass-button secondary"
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    padding: '0.5rem',
                  }}
                >
                  📤 Upload JSON
                </button>
              )}

              {shortcuts[activeGenerator].length > 0 && (
                <button
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className="glass-button secondary"
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>⌨️ Shortcuts</span>
                  <span
                    style={{
                      transform: showShortcuts
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    ▼
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Panel (collapsible) - Render second so it appears below */}
      {isExpanded && showShortcuts && shortcuts[activeGenerator].length > 0 && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            maxHeight: '400px',
            overflowY: 'auto',
            animation: 'slideIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#fff',
              }}
            >
              ⌨️ Keyboard Shortcuts
            </h4>
            <button
              onClick={() => setShowShortcuts(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '1.25rem',
                padding: 0,
                lineHeight: 1,
              }}
              title="Hide shortcuts"
            >
              ✕
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '0.5rem',
              fontSize: '0.75rem',
            }}
          >
            {shortcuts[activeGenerator].map((shortcut, index) => (
              <React.Fragment key={index}>
                <kbd
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortcut.key}
                </kbd>
                <span style={{ color: '#ccc', alignSelf: 'center' }}>
                  {shortcut.desc}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

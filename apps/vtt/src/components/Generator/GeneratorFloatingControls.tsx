import React, { useState } from 'react';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Dices from 'lucide-react/dist/esm/icons/dices';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Grid from 'lucide-react/dist/esm/icons/grid';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Keyboard from 'lucide-react/dist/esm/icons/keyboard';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

export interface GeneratorActionPayload {
  keyCode: number;
  code?: string;
  key?: string;
  shiftKey?: boolean;
}

interface GeneratorFloatingControlsProps {
  activeGenerator: 'dungeon' | 'cave' | 'world' | 'city' | 'dwelling';
  onGeneratorChange: (
    generator: 'dungeon' | 'cave' | 'world' | 'city' | 'dwelling',
  ) => void;
  onAddToScene: () => void;
  onUploadJSON?: () => void;
  onAction?: (action: GeneratorActionPayload) => void;
  hasActiveScene: boolean;
  hasValidArtifact?: boolean;
  activeSceneName?: string;
  isImporting?: boolean;
  forceRasterize?: boolean;
  onForceRasterizeChange?: (value: boolean) => void;
}

interface ShortcutCategory {
  category: string;
  items: { key: string; desc: string }[];
}

export const GeneratorFloatingControls: React.FC<
  GeneratorFloatingControlsProps
> = ({
  activeGenerator,
  onGeneratorChange,
  onAddToScene,
  onUploadJSON,
  onAction,
  hasActiveScene,
  hasValidArtifact = true,
  activeSceneName,
  isImporting = false,
  forceRasterize = true,
  onForceRasterizeChange,
}) => {
  // Expanded by default per user request
  const [isExpanded, setIsExpanded] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const generators = [
    { id: 'dungeon' as const, icon: '🏰', label: 'Dungeon' },
    { id: 'cave' as const, icon: '🗻', label: 'Cave' },
    { id: 'world' as const, icon: '🌍', label: 'World' },
    { id: 'city' as const, icon: '🏛️', label: 'City' },
    { id: 'dwelling' as const, icon: '🏠', label: 'Dwelling' },
  ];

  // Grouped and categorized shortcuts for better cognitive load & scannability
  const categorizedShortcuts: Record<string, ShortcutCategory[]> = {
    dungeon: [
      {
        category: 'Generation & Layout',
        items: [
          { key: 'Enter', desc: 'Reroll new dungeon' },
          { key: 'Space', desc: 'Rearrange notes' },
          { key: 'Shift+Space', desc: 'Reroll notes' },
          { key: 'R', desc: 'Rotate dungeon' },
          { key: 'Tab', desc: 'Open tags dialog' },
        ],
      },
      {
        category: 'Visuals & Grid',
        items: [
          { key: 'S', desc: 'Cycle color style' },
          { key: 'G', desc: 'Toggle grid' },
          { key: 'Shift+G', desc: 'Toggle grid mode' },
          { key: 'M', desc: 'Monochrome toggle' },
          { key: '1 / 2', desc: 'Normal / small cells' },
          { key: 'C', desc: 'Round corners' },
        ],
      },
      {
        category: 'Features & Content',
        items: [
          { key: 'N', desc: 'Toggle room notes' },
          { key: 'L', desc: 'Toggle legend' },
          { key: 'H', desc: 'Toggle secret rooms' },
          { key: 'P', desc: 'Toggle room props' },
          { key: 'W', desc: 'Toggle water' },
          { key: 'Shift+W', desc: 'Adjust water height' },
        ],
      },
      {
        category: 'Data & Export',
        items: [
          { key: 'E', desc: 'Export high-res PNG' },
          { key: 'J', desc: 'Export dungeon JSON' },
        ],
      },
    ],
    cave: [
      {
        category: 'Generation & Layout',
        items: [
          { key: 'Enter', desc: 'Generate new cave' },
          { key: 'Tab', desc: 'Cave tags' },
        ],
      },
      {
        category: 'Visuals & Grid',
        items: [
          { key: 'S', desc: 'Cycle visual style' },
          { key: 'G', desc: 'Toggle grid' },
          { key: 'N', desc: 'Toggle notes' },
        ],
      },
      {
        category: 'Export',
        items: [{ key: 'E', desc: 'Save PNG' }],
      },
    ],
    world: [
      {
        category: 'Generation & Layout',
        items: [
          { key: 'Enter', desc: 'Generate new world' },
          { key: 'Tab', desc: 'World tags' },
        ],
      },
      {
        category: 'Visuals & Grid',
        items: [
          { key: 'S', desc: 'Cycle map palette' },
          { key: 'G', desc: 'Toggle grid' },
          { key: 'N', desc: 'Toggle location names' },
        ],
      },
      {
        category: 'Export',
        items: [{ key: 'E', desc: 'Save PNG' }],
      },
    ],
    city: [
      {
        category: 'Generation & Districts',
        items: [
          { key: 'Enter', desc: 'Generate new city' },
          { key: 'C', desc: 'Toggle citadel' },
          { key: 'T', desc: 'Toggle temple' },
          { key: 'P', desc: 'Toggle plaza' },
        ],
      },
      {
        category: 'Visuals & Export',
        items: [
          { key: 'S', desc: 'Cycle color style' },
          { key: 'E', desc: 'Save PNG' },
        ],
      },
    ],
    dwelling: [
      {
        category: 'Generation',
        items: [
          { key: 'Enter', desc: 'Generate new dwelling' },
          { key: 'E', desc: 'Save PNG' },
        ],
      },
    ],
  };

  const currentShortcuts = categorizedShortcuts[activeGenerator] || [];

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
        maxWidth: isExpanded ? '340px' : '64px',
        transition: 'max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Minimized Trigger Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            background: 'var(--surface-primary, rgba(28, 30, 34, 0.9))',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.15))',
            borderRadius: '12px',
            color: 'var(--text-primary, #fff)',
            cursor: 'pointer',
            padding: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--indigo-400, #818cf8)';
            e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-primary, rgba(255, 255, 255, 0.15))';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Open controls"
          aria-label="Open controls"
        >
          <Sparkles size={20} color="var(--indigo-400, #818cf8)" />
        </button>
      )}

      {/* Expanded Main Studio Card */}
      {isExpanded && (
        <div
          style={{
            background: 'rgba(20, 22, 27, 0.92)',
            backdropFilter: 'blur(20px)',
            borderRadius: '14px',
            padding: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            color: 'var(--text-primary, #fff)',
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="var(--indigo-400, #818cf8)" />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  letterSpacing: '0.01em',
                }}
              >
                Map Studio
              </span>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #9ca3af)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
                e.currentTarget.style.background = 'transparent';
              }}
              title="Minimize panel"
              aria-label="Minimize panel"
            >
              <Minimize2 size={15} />
            </button>
          </div>

          {/* Active Scene Indicator Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.625rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              background: hasActiveScene
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(245, 158, 11, 0.12)',
              border: hasActiveScene
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(245, 158, 11, 0.3)',
              color: hasActiveScene
                ? 'var(--emerald-400, #34d399)'
                : 'var(--amber-400, #fbbf24)',
            }}
          >
            <MapPin size={13} style={{ flexShrink: 0 }} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 500,
              }}
            >
              {hasActiveScene
                ? `Scene: ${activeSceneName || 'Active Scene'}`
                : 'No active scene selected'}
            </span>
          </div>

          {/* Segmented Generator Selector Chips */}
          <div>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-secondary, #9ca3af)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.375rem',
              }}
            >
              Generators
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.25rem',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {generators.map((gen) => {
                const isActive = activeGenerator === gen.id;
                return (
                  <button
                    key={gen.id}
                    onClick={() => onGeneratorChange(gen.id)}
                    style={{
                      background: isActive
                        ? 'var(--indigo-600, #4f46e5)'
                        : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: isActive ? '#fff' : '#9ca3af',
                      cursor: 'pointer',
                      padding: '0.375rem 0.125rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.125rem',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive
                        ? '0 2px 8px rgba(79, 70, 229, 0.4)'
                        : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.color = '#fff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#9ca3af';
                      }
                    }}
                    title={gen.label}
                  >
                    <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>
                      {gen.icon}
                    </span>
                    <span style={{ fontSize: '0.625rem', fontWeight: 500 }}>
                      {gen.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions Bar (Clickable interactive buttons!) */}
          <div>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-secondary, #9ca3af)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.375rem',
              }}
            >
              Quick Actions
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.375rem',
              }}
            >
              <button
                onClick={() => onAction?.({ keyCode: 13, key: 'Enter', code: 'Enter' })}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
                title="Reroll new map (Enter)"
              >
                <Dices size={14} color="var(--indigo-400, #818cf8)" />
                <span>Reroll Map</span>
              </button>

              <button
                onClick={() => onAction?.({ keyCode: 83, key: 's', code: 'KeyS' })}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
                title="Cycle visual style / palette (S)"
              >
                <Palette size={14} color="var(--purple-400, #c084fc)" />
                <span>Cycle Style</span>
              </button>

              <button
                onClick={() => onAction?.({ keyCode: 71, key: 'g', code: 'KeyG' })}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
                title="Toggle grid overlay (G)"
              >
                <Grid size={14} color="var(--cyan-400, #22d3ee)" />
                <span>Toggle Grid</span>
              </button>

              <button
                onClick={() =>
                  onAction?.(
                    activeGenerator === 'dungeon'
                      ? { keyCode: 72, key: 'h', code: 'KeyH' }
                      : { keyCode: 78, key: 'n', code: 'KeyN' },
                  )
                }
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
                title={
                  activeGenerator === 'dungeon'
                    ? 'Toggle secret rooms (H)'
                    : 'Toggle labels/notes (N)'
                }
              >
                <Eye size={14} color="var(--emerald-400, #34d399)" />
                <span>{activeGenerator === 'dungeon' ? 'Secrets' : 'Labels'}</span>
              </button>
            </div>
          </div>

          {/* Primary Action Button: Add to Scene */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <button
              onClick={onAddToScene}
              disabled={!hasActiveScene || !hasValidArtifact || isImporting}
              style={{
                width: '100%',
                background: hasActiveScene && hasValidArtifact
                  ? 'linear-gradient(135deg, var(--indigo-600, #4f46e5) 0%, var(--purple-600, #9333ea) 100%)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: hasActiveScene && hasValidArtifact
                  ? '1px solid rgba(165, 180, 252, 0.35)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#fff',
                cursor:
                  hasActiveScene && hasValidArtifact && !isImporting
                    ? 'pointer'
                    : 'not-allowed',
                padding: '0.625rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow:
                  hasActiveScene && hasValidArtifact
                    ? '0 4px 16px rgba(79, 70, 229, 0.35)'
                    : 'none',
                opacity: hasActiveScene && hasValidArtifact ? 1 : 0.5,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (hasActiveScene && hasValidArtifact && !isImporting) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow =
                    '0 6px 20px rgba(79, 70, 229, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasActiveScene && hasValidArtifact && !isImporting) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 16px rgba(79, 70, 229, 0.35)';
                }
              }}
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

            {/* Subtext info */}
            <div
              style={{
                fontSize: '0.675rem',
                color: 'var(--text-secondary, #9ca3af)',
                textAlign: 'center',
              }}
            >
              {hasActiveScene
                ? 'Applies current map to active scene background'
                : 'Select a scene in Scenes tab to enable'}
            </div>
          </div>

          {/* Optional Upload JSON & Rasterize Options */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              paddingTop: '0.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {activeGenerator === 'dungeon' && onUploadJSON && (
              <button
                onClick={onUploadJSON}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#ccc',
                  cursor: 'pointer',
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = '#ccc';
                }}
              >
                <Upload size={13} />
                <span>Upload Dungeon JSON</span>
              </button>
            )}

            {onForceRasterizeChange && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.725rem',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '0.125rem 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={forceRasterize}
                  onChange={(e) => onForceRasterizeChange(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--indigo-500, #6366f1)' }}
                />
                <span>Optimize with WebP</span>
              </label>
            )}
          </div>

          {/* Collapsible Categorized Shortcuts Section */}
          {currentShortcuts.length > 0 && (
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '0.375rem',
              }}
            >
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary, #9ca3af)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Keyboard size={13} />
                  <span>Keyboard Shortcuts</span>
                </div>
                {showShortcuts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showShortcuts && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '0.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.625rem',
                    fontSize: '0.725rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.675rem',
                      color: 'var(--indigo-300, #a5b4fc)',
                      fontStyle: 'italic',
                      lineHeight: 1.3,
                    }}
                  >
                    Tip: Click the map pane to give it keyboard focus.
                  </div>

                  {currentShortcuts.map((cat, idx) => (
                    <div key={idx}>
                      <div
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {cat.category}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '0.25rem 0.5rem',
                          alignItems: 'center',
                        }}
                      >
                        {cat.items.map((item, itemIdx) => (
                          <React.Fragment key={itemIdx}>
                            <kbd
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '4px',
                                padding: '0.125rem 0.375rem',
                                fontSize: '0.675rem',
                                fontFamily: 'monospace',
                                color: '#e0e7ff',
                                whiteSpace: 'nowrap',
                                textAlign: 'center',
                              }}
                            >
                              {item.key}
                            </kbd>
                            <span style={{ color: '#d1d5db' }}>{item.desc}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

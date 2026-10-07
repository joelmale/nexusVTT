import React, { useState } from 'react';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Dices from 'lucide-react/dist/esm/icons/dices';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Grid from 'lucide-react/dist/esm/icons/grid';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Tag from 'lucide-react/dist/esm/icons/tag';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Compass from 'lucide-react/dist/esm/icons/compass';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Mountain from 'lucide-react/dist/esm/icons/mountain';
import DoorOpen from 'lucide-react/dist/esm/icons/door-open';
import Type from 'lucide-react/dist/esm/icons/type';
import Keyboard from 'lucide-react/dist/esm/icons/keyboard';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import {
  actionTitle,
  getQuickActions,
  getShortcutGroups,
  type GeneratorIconKey,
} from './generatorActions';

const QUICK_ICONS: Record<
  GeneratorIconKey,
  { Icon: React.ComponentType<{ size?: number; color?: string }>; color: string }
> = {
  dice: { Icon: Dices, color: 'var(--indigo-400, #818cf8)' },
  palette: { Icon: Palette, color: 'var(--purple-400, #c084fc)' },
  grid: { Icon: Grid, color: 'var(--cyan-400, #22d3ee)' },
  eye: { Icon: Eye, color: 'var(--emerald-400, #34d399)' },
  tag: { Icon: Tag, color: 'var(--emerald-400, #34d399)' },
  layers: { Icon: Layers, color: 'var(--amber-400, #fbbf24)' },
  compass: { Icon: Compass, color: 'var(--cyan-400, #22d3ee)' },
  sun: { Icon: Sun, color: 'var(--amber-400, #fbbf24)' },
  mountain: { Icon: Mountain, color: 'var(--emerald-400, #34d399)' },
  door: { Icon: DoorOpen, color: 'var(--purple-400, #c084fc)' },
  type: { Icon: Type, color: 'var(--cyan-400, #22d3ee)' },
};

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
  // Draggable + resizable like the rest of the app's floating chrome (see
  // PlayerClusterFloating / FloatingPanel). Position and size persist to
  // localStorage under the 'generator' panel id.
  const { onPointerDown, isCollapsed, setCollapsed, shiftPosition, panelRef } =
    useDraggablePanel({
      id: 'generator',
      defaultPosition: { x: 16, y: 16 },
    });
  // Expanded by default per user request
  const isExpanded = !isCollapsed;
  const { size, onResizeStart, edgeCursor } = useResizablePanel({
    id: 'generator',
    defaultSize: { width: 340, height: 560 },
    minWidth: 280,
    minHeight: 320,
    maxWidth: 520,
    maxHeight: 900,
    onPositionChange: shiftPosition,
  });
  const [showShortcuts, setShowShortcuts] = useState(false);

  const generators = [
    { id: 'dungeon' as const, icon: '🏰', label: 'Dungeon' },
    { id: 'cave' as const, icon: '🗻', label: 'Cave' },
    { id: 'world' as const, icon: '🌍', label: 'World' },
    { id: 'city' as const, icon: '🏛️', label: 'City' },
    { id: 'dwelling' as const, icon: '🏠', label: 'Dwelling' },
  ];

  // Buttons and the shortcut list both come from the per-generator registry,
  // so each button sends the key that generator actually binds.
  const quickActions = getQuickActions(activeGenerator);
  const shortcutGroups = getShortcutGroups(activeGenerator);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 'var(--z-tool-ui)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.5rem',
      }}
    >
      {/* Minimized Trigger Button */}
      {!isExpanded && (
        <button
          onClick={() => setCollapsed(false)}
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
            position: 'relative',
            background: 'rgba(20, 22, 27, 0.92)',
            backdropFilter: 'blur(20px)',
            borderRadius: '14px',
            padding: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            width: size.width,
            height: size.height,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            color: 'var(--text-primary, #fff)',
            overflow: 'auto',
          }}
        >
          {/* Resize handles */}
          {(
            [
              'left',
              'right',
              'top',
              'bottom',
              'top-left',
              'top-right',
              'bottom-left',
              'bottom-right',
            ] as const
          ).map((edge) => {
            const isCorner = edge.includes('-');
            const edgeStyle: React.CSSProperties = { position: 'absolute', zIndex: 5 };
            if (edge === 'left' || edge === 'right') {
              Object.assign(edgeStyle, { top: 12, bottom: 12, width: 6, [edge]: -3 });
            } else if (edge === 'top' || edge === 'bottom') {
              Object.assign(edgeStyle, { left: 12, right: 12, height: 6, [edge]: -3 });
            } else if (isCorner) {
              const [v, h] = edge.split('-') as ['top' | 'bottom', 'left' | 'right'];
              Object.assign(edgeStyle, { width: 12, height: 12, [v]: -3, [h]: -3 });
            }
            return (
              <div
                key={edge}
                style={{ ...edgeStyle, cursor: edgeCursor(edge) }}
                onPointerDown={onResizeStart(edge)}
              />
            );
          })}

          {/* Header Row (drag handle) */}
          <div
            onPointerDown={onPointerDown}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'grab',
              flexShrink: 0,
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
              onClick={() => setCollapsed(true)}
              onPointerDown={(e) => e.stopPropagation()}
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
              {quickActions.map((action) => {
                const { Icon, color } = QUICK_ICONS[action.quick!.icon];
                return (
                  <button
                    key={action.id}
                    onClick={() =>
                      onAction?.({
                        keyCode: action.keyCode,
                        key: action.key,
                        code: action.code,
                        shiftKey: action.shiftKey,
                      })
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
                    title={actionTitle(action)}
                  >
                    <Icon size={14} color={color} />
                    <span>{action.quick?.label ?? action.label}</span>
                    {action.kind === 'dialog' && (
                      <span aria-hidden="true" style={{ marginLeft: 'auto', opacity: 0.5 }}>
                        …
                      </span>
                    )}
                  </button>
                );
              })}
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
          {shortcutGroups.length > 0 && (
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

                  {shortcutGroups.map((cat) => (
                    <div key={cat.group}>
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
                        {cat.label}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '0.25rem 0.5rem',
                          alignItems: 'center',
                        }}
                      >
                        {cat.items.map((item) => (
                          <React.Fragment key={item.id}>
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
                              {item.keyLabel}
                            </kbd>
                            <span style={{ color: '#d1d5db' }}>{item.description}</span>
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Dices from 'lucide-react/dist/esm/icons/dices';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import ArrowLeftRight from 'lucide-react/dist/esm/icons/arrow-left-right';
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close';
import PanelLeftOpen from 'lucide-react/dist/esm/icons/panel-left-open';
import { ActionButton } from './ActionButton';
import { ShortcutList } from './ShortcutList';
import { AddToSceneBar } from './AddToSceneBar';
import {
  GENERATORS,
  GENERATOR_ACTIONS,
  actionTitle,
  getRerollAction,
  getTabActions,
  searchActions,
  type GeneratorAction,
  type GeneratorActionGroup,
  type GeneratorId,
} from './generatorActions';
import styles from './GeneratorSidebar.module.css';

/** Shape the panel forwards to the hub (kept for callers/tests). */
export interface GeneratorActionPayload {
  keyCode: number;
  code?: string;
  key?: string;
  shiftKey?: boolean;
}

export type DockSide = 'left' | 'right';

interface GeneratorSidebarProps {
  activeGenerator: GeneratorId;
  onGeneratorChange: (generator: GeneratorId) => void;
  onAddToScene: () => void;
  onUploadJSON?: () => void;
  onAction?: (action: GeneratorAction) => void;
  /** Registry action ids the generator has not acknowledged yet. */
  pendingActionIds?: ReadonlySet<string>;
  hasActiveScene: boolean;
  hasValidArtifact?: boolean;
  activeSceneName?: string;
  isImporting?: boolean;
  previewUrl?: string | null;
  errorMessage?: string | null;
  forceRasterize?: boolean;
  onForceRasterizeChange?: (value: boolean) => void;
}

type TabId = 'generate' | 'style' | 'layers' | 'output';

const TABS: { id: TabId; label: string }[] = [
  { id: 'generate', label: 'Generate' },
  { id: 'style', label: 'Style' },
  { id: 'layers', label: 'Layers' },
  { id: 'output', label: 'Output' },
];

const TAB_GROUP: Record<TabId, GeneratorActionGroup> = {
  generate: 'generate',
  style: 'style',
  layers: 'layers',
  output: 'export',
};

const TAB_HINTS: Partial<Record<GeneratorActionGroup, string>> = {
  style: 'Actions ending in … open a dialog inside the map.',
  layers: 'Each button flips that layer. Check the map for its current state.',
};

const MIN_WIDTH = 260;
const MAX_WIDTH = 460;
const DEFAULT_WIDTH = 340;
/** Show the search box once a generator has this many actions. */
const SEARCH_THRESHOLD = 14;

const KEY_WIDTH = 'nexus-ui-generator-width';
const KEY_DOCK = 'nexus-ui-generator-dock';
const KEY_COLLAPSED = 'nexus-ui-generator-collapsed';

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota); the UI still works.
  }
}

const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export const GeneratorSidebar: React.FC<GeneratorSidebarProps> = ({
  activeGenerator,
  onGeneratorChange,
  onAddToScene,
  onUploadJSON,
  onAction,
  pendingActionIds,
  hasActiveScene,
  hasValidArtifact = true,
  activeSceneName,
  isImporting = false,
  previewUrl,
  errorMessage,
  forceRasterize = true,
  onForceRasterizeChange,
}) => {
  const [tab, setTab] = useState<TabId>('generate');
  // The filter belongs to one generator; switching generator discards it.
  const [queryState, setQueryState] = useState({
    generator: activeGenerator,
    text: '',
  });
  const query = queryState.generator === activeGenerator ? queryState.text : '';
  const setQuery = (text: string) =>
    setQueryState({ generator: activeGenerator, text });
  const [width, setWidth] = useState(() => {
    const saved = Number(readStored(KEY_WIDTH));
    return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : DEFAULT_WIDTH;
  });
  const [dock, setDock] = useState<DockSide>(() =>
    readStored(KEY_DOCK) === 'right' ? 'right' : 'left',
  );
  const [collapsed, setCollapsed] = useState(
    () => readStored(KEY_COLLAPSED) === 'true',
  );
  const widthRef = useRef(width);
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const reroll = getRerollAction(activeGenerator);
  const totalActions = GENERATOR_ACTIONS[activeGenerator].length;
  const showSearch = totalActions >= SEARCH_THRESHOLD;
  const searching = showSearch && query.trim().length > 0;
  const results = useMemo(
    () => (searching ? searchActions(activeGenerator, query) : []),
    [activeGenerator, query, searching],
  );

  // Tabs with nothing to show are hidden (Output is always kept: it holds the
  // WebP option even for generators with no in-map export).
  const visibleTabs = TABS.filter(
    (t) =>
      t.id === 'output' || getTabActions(activeGenerator, TAB_GROUP[t.id]).length > 0,
  );
  const currentTab = visibleTabs.some((t) => t.id === tab)
    ? tab
    : (visibleTabs[0]?.id ?? 'generate');

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      writeStored(KEY_COLLAPSED, String(!prev));
      return !prev;
    });
  }, []);

  const swapDock = () => {
    setDock((prev) => {
      const next: DockSide = prev === 'left' ? 'right' : 'left';
      writeStored(KEY_DOCK, next);
      return next;
    });
  };

  const run = useCallback(
    (action: GeneratorAction) => onAction?.(action),
    [onAction],
  );

  const canAdd = hasActiveScene && hasValidArtifact && !isImporting;

  // "[" collapses the sidebar; Ctrl/Cmd+Enter adds to the scene. Both are
  // ignored while typing, and only reach us when focus is outside the iframe.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleCollapsed();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canAdd) {
        e.preventDefault();
        onAddToScene();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCollapsed, canAdd, onAddToScene]);

  // Drag the edge to resize; keyboard users get arrow keys on the same handle.
  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    const direction = dock === 'left' ? 1 : -1;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      setWidth(clampWidth(startWidth + (ev.clientX - startX) * direction));
    };
    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      writeStored(KEY_WIDTH, String(widthRef.current));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 10;
    let next: number | null = null;
    const grow = dock === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = dock === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === grow) next = widthRef.current + step;
    else if (e.key === shrink) next = widthRef.current - step;
    if (next === null) return;
    e.preventDefault();
    const clamped = clampWidth(next);
    setWidth(clamped);
    writeStored(KEY_WIDTH, String(clamped));
  };

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const next = visibleTabs[(index + delta + visibleTabs.length) % visibleTabs.length];
    setTab(next.id);
    document.getElementById(`studio-tab-${next.id}`)?.focus();
  };

  const rootStyle = { '--studio-width': `${width}px` } as React.CSSProperties;

  const renderActions = (actions: GeneratorAction[]) => {
    const presets = actions.filter((a) => a.kind === 'preset');
    const others = actions.filter((a) => a.kind !== 'preset');
    return (
      <>
        {presets.length > 0 && (
          <div>
            <div className={styles.sectionLabel}>Presets</div>
            <div className={styles.chipRow}>
              {presets.map((a) => (
                <ActionButton
                  key={a.id}
                  action={a}
                  pending={pendingActionIds?.has(a.id) ?? false}
                  onRun={run}
                />
              ))}
            </div>
          </div>
        )}
        {others.length > 0 && (
          <div className={styles.actionGrid}>
            {others.map((a) => (
              <ActionButton
                key={a.id}
                action={a}
                pending={pendingActionIds?.has(a.id) ?? false}
                onRun={run}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  // ── Collapsed icon rail ──
  if (collapsed) {
    return (
      <aside
        className={styles.sidebar}
        data-dock={dock}
        data-collapsed="true"
        style={rootStyle}
        aria-label="Map Studio controls"
      >
        <div className={styles.rail}>
          <button
            type="button"
            className={styles.railButton}
            onClick={toggleCollapsed}
            aria-label="Expand Map Studio"
            title="Expand Map Studio ([)"
          >
            <PanelLeftOpen size={18} />
          </button>
          {GENERATORS.map((gen) => (
            <button
              key={gen.id}
              type="button"
              className={styles.railButton}
              aria-pressed={activeGenerator === gen.id}
              aria-label={gen.label}
              title={gen.label}
              onClick={() => onGeneratorChange(gen.id)}
            >
              {gen.icon}
            </button>
          ))}
          <button
            type="button"
            className={styles.railButton}
            aria-label="Reroll map"
            title={actionTitle(reroll)}
            disabled={pendingActionIds?.has(reroll.id)}
            onClick={() => run(reroll)}
          >
            <Dices size={18} />
          </button>
          <div className={styles.railSpacer} />
          <button
            type="button"
            className={styles.railButton}
            aria-label="Add to scene"
            title={
              canAdd ? 'Add the current map to the scene' : 'Nothing to add yet'
            }
            disabled={!canAdd}
            onClick={onAddToScene}
          >
            {isImporting ? <Loader2 size={18} className="animate-spin" /> : '🗺️'}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={styles.sidebar}
      data-dock={dock}
      data-collapsed="false"
      style={rootStyle}
      aria-label="Map Studio controls"
    >
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Map Studio"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />

      <div className={styles.header}>
        <div className={styles.title}>
          <Sparkles size={16} color="var(--indigo-400, #818cf8)" aria-hidden="true" />
          <span>Map Studio</span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={swapDock}
            aria-label={`Dock ${dock === 'left' ? 'right' : 'left'}`}
            title={`Move to the ${dock === 'left' ? 'right' : 'left'} side`}
          >
            <ArrowLeftRight size={15} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={toggleCollapsed}
            aria-label="Collapse Map Studio"
            title="Collapse to icons ([)"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div>
          <div className={styles.sectionLabel}>Generators</div>
          <div className={styles.picker}>
            {GENERATORS.map((gen) => (
              <button
                key={gen.id}
                type="button"
                className={styles.genButton}
                aria-pressed={activeGenerator === gen.id}
                title={gen.label}
                onClick={() => onGeneratorChange(gen.id)}
              >
                <span className={styles.genIcon} aria-hidden="true">
                  {gen.icon}
                </span>
                <span className={styles.genLabel}>{gen.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => run(reroll)}
          disabled={pendingActionIds?.has(reroll.id)}
          title={actionTitle(reroll)}
        >
          {pendingActionIds?.has(reroll.id) ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Dices size={16} aria-hidden="true" />
          )}
          <span>{reroll.label}</span>
        </button>

        {showSearch && (
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an action…"
            aria-label="Find an action"
          />
        )}

        {searching ? (
          <div className={styles.tabPanel} aria-live="polite">
            {results.length === 0 ? (
              <div className={styles.empty}>No actions match “{query.trim()}”.</div>
            ) : (
              renderActions(results)
            )}
          </div>
        ) : (
          <>
            <div className={styles.tabs} role="tablist" aria-label="Map controls">
              {visibleTabs.map((t, index) => (
                <button
                  key={t.id}
                  type="button"
                  id={`studio-tab-${t.id}`}
                  role="tab"
                  className={styles.tab}
                  aria-selected={currentTab === t.id}
                  aria-controls="studio-tabpanel"
                  tabIndex={currentTab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKeyDown(e, index)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div
              id="studio-tabpanel"
              role="tabpanel"
              aria-labelledby={`studio-tab-${currentTab}`}
              className={styles.tabPanel}
            >
              {currentTab !== 'output' && (
                <>
                  {renderActions(
                    getTabActions(activeGenerator, TAB_GROUP[currentTab]),
                  )}
                  {TAB_HINTS[TAB_GROUP[currentTab]] && (
                    <div className={styles.hint}>
                      {TAB_HINTS[TAB_GROUP[currentTab]]}
                    </div>
                  )}
                </>
              )}

              {currentTab === 'output' && (
                <>
                  {renderActions(getTabActions(activeGenerator, 'export'))}
                  <div className={styles.options}>
                    {activeGenerator === 'dungeon' && onUploadJSON && (
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={onUploadJSON}
                      >
                        <Upload size={13} aria-hidden="true" />
                        <span className={styles.actionLabel}>
                          Upload Dungeon JSON
                        </span>
                      </button>
                    )}
                    {onForceRasterizeChange && (
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          checked={forceRasterize}
                          onChange={(e) =>
                            onForceRasterizeChange(e.target.checked)
                          }
                          style={{ accentColor: 'var(--indigo-500, #6366f1)' }}
                        />
                        <span>Optimize with WebP</span>
                      </label>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <ShortcutList generator={activeGenerator} />
      </div>

      <AddToSceneBar
        hasActiveScene={hasActiveScene}
        hasValidArtifact={hasValidArtifact}
        activeSceneName={activeSceneName}
        isImporting={isImporting}
        previewUrl={previewUrl}
        errorMessage={errorMessage}
        onAddToScene={onAddToScene}
      />
    </aside>
  );
};

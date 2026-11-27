import React, { useLayoutEffect, useState } from 'react';
import Grip from 'lucide-react/dist/esm/icons/grip';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';

import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useGameStore } from '@/stores/gameStore';
import { useLayoutWorkspaceStore } from '@/stores/layoutWorkspaceStore';
import {
  topmostPanel,
  useFocusMode,
  useStackZIndex,
  useUIStackStore,
  type PanelId,
} from '@/stores/uiStackStore';
import { resolvePanelDockLayout } from '@/types/layout';
import type { PanelDockLayout } from '@/types/game';

import { Icon } from './Common/Icon';
import styles from './PanelDock.module.css';
import { PopoverMenu } from './PopoverMenu';
import { WorkspaceMenu } from './WorkspaceMenu';

export interface PanelDockPanel {
  id: PanelId;
  icon: string;
  label: string;
}

interface PanelDockProps {
  panels: PanelDockPanel[];
  openObjectPanels?: PanelDockPanel[];
  activePanels: PanelId[];
  onClose: (panel: PanelId) => void;
  onSelect: (panel: PanelId) => void;
}

const DEFAULT_FAVORITES = ['initiative', 'chat', 'dice'];

export function PanelDock(props: PanelDockProps): React.JSX.Element {
  const layout = useGameStore((state) =>
    resolvePanelDockLayout(state.settings.panelDockLayout),
  );
  return (
    <PanelDockLauncher
      key={layout === 'rail' ? 'rail' : 'bar'}
      layout={layout}
      {...props}
    />
  );
}

function PanelDockLauncher({
  layout,
  panels,
  openObjectPanels = [],
  activePanels,
  onClose,
  onSelect,
}: PanelDockProps & { layout: PanelDockLayout }): React.JSX.Element {
  const isRail = layout === 'rail';
  const dockId = isRail ? 'panelDockRail' : 'panelDock';
  const workspace = useLayoutWorkspaceStore((state) =>
    state.workspaces.find((preset) => preset.id === state.lastAppliedId),
  );
  const stack = useUIStackStore((state) => state.panelStack);
  const bringToFront = useUIStackStore((state) => state.bringToFront);
  const focusMode = useFocusMode();
  const zIndex = useStackZIndex(dockId);
  // Standard windows open on the right. Keep the persistent rail reachable
  // on the opposite edge and remember its position independently of the bar.
  const [defaultPosition] = useState(() =>
    isRail ? { x: 20, y: 84 } : { x: window.innerWidth - 20, y: 20 },
  );
  const { onPointerDown, panelRef } = useDraggablePanel({
    id: dockId,
    defaultPosition,
    resizeAnchor: isRail ? 'left' : 'right',
  });
  const [query, setQuery] = useState('');

  const panelsById = new Map(
    [...panels, ...openObjectPanels].map((panel) => [panel.id, panel]),
  );
  const openPanels = activePanels.flatMap((id) => {
    const panel = panelsById.get(id);
    return panel ? [panel] : [];
  });
  const topmostId = topmostPanel(
    stack,
    openPanels.map(({ id }) => id),
  );
  const favoritePanels = [
    ...new Set([...(workspace?.activePanels ?? []), ...DEFAULT_FAVORITES]),
  ]
    .flatMap((id) => {
      const panel = panels.find((candidate) => candidate.id === id);
      return panel ? [panel] : [];
    })
    .slice(0, 3);
  const orderedPanels =
    layout === 'switcher'
      ? [
          ...openPanels,
          ...panels.filter(({ id }) => !activePanels.includes(id)),
        ]
      : panels;
  const matches = orderedPanels.filter(({ id, label }) => {
    if (layout === 'rail') return !activePanels.includes(id);
    return (
      layout !== 'switcher' ||
      label.toLowerCase().includes(query.trim().toLowerCase())
    );
  });

  useLayoutEffect(() => {
    if (focusMode)
      panelRef.current
        ?.querySelector<HTMLElement>('[popover]:popover-open')
        ?.hidePopover();
  }, [focusMode, panelRef]);

  function activate(panel: PanelDockPanel): void {
    if (layout !== 'favorites' && activePanels.includes(panel.id)) {
      bringToFront(panel.id);
    } else {
      onSelect(panel.id);
    }
  }

  function choosePanel(panel: PanelDockPanel, target: HTMLElement): void {
    const popover = target.closest<HTMLElement>('[popover]');
    popover?.hidePopover?.();
    setQuery('');
    activate(panel);
  }

  function renderPanelButton(
    panel: PanelDockPanel,
    inPicker = false,
  ): React.JSX.Element {
    const isOpen = activePanels.includes(panel.id);
    const inFront = topmostId === panel.id;
    return (
      <button
        key={panel.id}
        type="button"
        className={`unstyled ${styles.panelButton}`}
        aria-pressed={layout === 'favorites' ? isOpen : undefined}
        aria-current={layout !== 'favorites' && inFront ? 'true' : undefined}
        data-open={isOpen || undefined}
        data-topmost={inFront || undefined}
        onClick={(event) => {
          if (inPicker) choosePanel(panel, event.currentTarget);
          else activate(panel);
        }}
      >
        <span className={styles.icon} aria-hidden="true">
          <Icon
            id={panel.id.startsWith('panel:') ? panel.id : `panel:${panel.id}`}
            fallback={panel.icon}
            size={18}
          />
        </span>
        <span className={styles.panelLabel}>{panel.label}</span>
        {isOpen && (inPicker || layout === 'rail') && (
          <span className={styles.windowState} aria-hidden="true">
            {inFront ? 'In front' : 'Open'}
          </span>
        )}
      </button>
    );
  }

  const pickerLabel = {
    favorites: 'All panels',
    switcher: 'Panels',
    rail: 'Add panel',
  }[layout];
  const picker = (
    <PopoverMenu
      key={layout}
      trigger={
        <>
          {layout === 'switcher' && <Search size={16} aria-hidden="true" />}
          {layout === 'rail' && <Plus size={16} aria-hidden="true" />}
          {pickerLabel}
        </>
      }
      triggerClassName={`unstyled ${styles.panelButton}`}
      contentClassName={styles.picker}
      focusOnOpen={layout === 'switcher' ? 'input' : 'button'}
    >
      <div
        role="group"
        aria-label={layout === 'switcher' ? 'Panel Switcher' : pickerLabel}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          // Search inputs consume Escape to clear their value. Dismiss the
          // launcher here and keep the window stack's Escape handler idle.
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover();
        }}
      >
        {layout === 'switcher' && (
          <form
            className={styles.search}
            onSubmit={(event) => {
              event.preventDefault();
              if (matches[0]) choosePanel(matches[0], event.currentTarget);
            }}
          >
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Find a panel"
              placeholder="Find a panel"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
        )}
        <div
          className={layout === 'switcher' ? styles.results : styles.directory}
        >
          {matches.map((panel) => renderPanelButton(panel, true))}
          {matches.length === 0 && (
            <p className={styles.empty} role="status">
              {layout === 'rail'
                ? 'All available panels are open'
                : 'No matching panels'}
            </p>
          )}
        </div>
      </div>
    </PopoverMenu>
  );

  return (
    <div
      ref={panelRef}
      data-chrome
      data-layout={layout}
      inert={focusMode || undefined}
      className={styles.dock}
      onPointerDownCapture={() => bringToFront(dockId)}
      style={{ zIndex }}
      role="group"
      aria-label="Panels"
    >
      <div className={styles.header}>
        <div
          className={styles.dragHandle}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          title="Drag Panel Dock"
        >
          <Grip size={16} />
        </div>
        {layout === 'favorites' && (
          <div
            className={styles.favorites}
            role="group"
            aria-label="Favorite panels"
          >
            {favoritePanels.map((panel) => renderPanelButton(panel))}
          </div>
        )}
        {layout === 'rail' ? (
          <span className={styles.heading}>Open panels</span>
        ) : (
          picker
        )}
        <WorkspaceMenu />
      </div>
      {layout === 'rail' && (
        <>
          <div
            className={styles.openPanels}
            role="group"
            aria-label="Open windows"
          >
            {openPanels.map((panel) => (
              <div className={styles.windowRow} key={panel.id}>
                {renderPanelButton(panel)}
                <button
                  type="button"
                  className={`unstyled ${styles.closeButton}`}
                  aria-label={`Close ${panel.label}`}
                  onClick={(event) => {
                    const row = event.currentTarget.parentElement;
                    const nextRow =
                      row?.nextElementSibling ?? row?.previousElementSibling;
                    const next =
                      nextRow?.querySelector<HTMLButtonElement>('button') ??
                      panelRef.current?.querySelector<HTMLButtonElement>(
                        'button[popovertarget]',
                      );
                    next?.focus();
                    onClose(panel.id);
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            {openPanels.length === 0 && (
              <p className={styles.empty}>No open panels</p>
            )}
          </div>
          {picker}
        </>
      )}
    </div>
  );
}

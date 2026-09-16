import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLayoutWorkspaceStore } from '@/stores/layoutWorkspaceStore';
import { useUIStackStore } from '@/stores/uiStackStore';
import { Portal } from './Portal';
import styles from './WorkspaceMenu.module.css';

/**
 * Save / apply / delete named layout workspaces.
 *
 * Lives in the PanelDock rather than Settings: this is a mid-session control
 * (a DM switching between exploration and combat), and Settings is itself a
 * FloatingPanel whose own geometry is part of the layout being restored -
 * applying a workspace from inside it could close the panel being clicked.
 */
export const WorkspaceMenu: React.FC = () => {
  const workspaces = useLayoutWorkspaceStore((s) => s.workspaces);
  const lastAppliedId = useLayoutWorkspaceStore((s) => s.lastAppliedId);
  const saveWorkspace = useLayoutWorkspaceStore((s) => s.saveWorkspace);
  const applyWorkspace = useLayoutWorkspaceStore((s) => s.applyWorkspace);
  const deleteWorkspace = useLayoutWorkspaceStore((s) => s.deleteWorkspace);
  const resetLayout = useUIStackStore((s) => s.resetLayout);

  const [isOpen, setIsOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });

  // The PanelDock sets `overflow: hidden`, so an absolutely-positioned popover
  // inside it is clipped away. Portal the menu out and anchor it to the
  // trigger's viewport rect instead.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSave = useCallback(() => {
    const name = draftName.trim();
    if (!name) return;
    saveWorkspace(name);
    setDraftName('');
  }, [draftName, saveWorkspace]);

  const handleReset = useCallback(() => {
    // resetLayout sweeps every `nexus-ui-` key, which by design includes the
    // saved workspaces - so this really is destructive.
    const confirmed = window.confirm(
      'Reset the layout to defaults? This also deletes all saved workspaces.',
    );
    if (confirmed) {
      resetLayout();
      useLayoutWorkspaceStore.getState().reload();
      setIsOpen(false);
    }
  }, [resetLayout]);

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Layout workspaces"
        title="Layout workspaces"
      >
        🗂
      </button>

      {isOpen && (
        <Portal>
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ top: anchor.top, right: anchor.right }}
          role="menu"
          aria-label="Layout workspaces"
        >
          <div className={styles.heading}>Workspaces</div>

          {workspaces.length === 0 && (
            <p className={styles.empty}>No saved workspaces yet.</p>
          )}

          <ul className={styles.list}>
            {workspaces.map((workspace) => (
              <li key={workspace.id} className={styles.row}>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.applyButton}
                  data-active={workspace.id === lastAppliedId || undefined}
                  onClick={() => {
                    applyWorkspace(workspace.id);
                    setIsOpen(false);
                  }}
                >
                  {workspace.name}
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  aria-label={`Delete workspace ${workspace.name}`}
                  title={`Delete ${workspace.name}`}
                  onClick={() => deleteWorkspace(workspace.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.saveRow}>
            <input
              className={styles.input}
              value={draftName}
              placeholder="Save current layout as…"
              aria-label="New workspace name"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSave}
              disabled={!draftName.trim()}
            >
              Save
            </button>
          </div>

          <button
            type="button"
            className={styles.resetButton}
            onClick={handleReset}
          >
            Reset layout &amp; delete workspaces
          </button>
        </div>
        </Portal>
      )}
    </div>
  );
};

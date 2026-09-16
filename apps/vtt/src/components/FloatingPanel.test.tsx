import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { FloatingPanel } from './FloatingPanel';
import { useUIStackStore } from '@/stores/uiStackStore';

/**
 * Covers the FloatingPanel shell contract:
 *  - renders children into #portal-root (via Portal)
 *  - Escape closes ONLY the topmost open panel
 *  - focus returns to the previously-focused element on unmount
 */

/** Mark `ids` as open so `topmostPanel` can resolve; last id ends up on top. */
function openPanels(...ids: string[]) {
  useUIStackStore.setState({
    activePanels: [...ids],
    panelStack: ['gameToolbar', ...ids],
    poppedOutPanels: [],
  });
}

beforeEach(() => {
  localStorage.clear();
  openPanels('tokens');

  const portalRoot = document.createElement('div');
  portalRoot.id = 'portal-root';
  document.body.appendChild(portalRoot);

  // Run rAF callbacks synchronously so the focus-on-open effect resolves
  // within the same test tick.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  document.getElementById('portal-root')?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FloatingPanel', () => {
  it('renders children into #portal-root', () => {
    render(
      <FloatingPanel panelId="tokens" isOpen={true} onClose={() => {}} label="Test Panel">
        <div>panel content</div>
      </FloatingPanel>,
    );

    const portalRoot = document.getElementById('portal-root');
    expect(portalRoot?.textContent).toContain('panel content');
  });

  it('sets role="dialog" and aria-label from the label prop', () => {
    render(
      <FloatingPanel panelId="tokens" isOpen={true} onClose={() => {}} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Tokens' });
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('data-state')).toBe('open');
  });

  it('sets data-state="closed" and aria-hidden when isOpen is false', () => {
    render(
      <FloatingPanel panelId="tokens" isOpen={false} onClose={() => {}} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('data-state')).toBe('closed');
    expect(dialog?.getAttribute('aria-hidden')).toBe('true');
  });

  it('calls onClose when Escape is pressed while open and topmost', () => {
    const onClose = vi.fn();
    render(
      <FloatingPanel panelId="tokens" isOpen={true} onClose={onClose} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes ONLY the topmost panel, not every open panel', () => {
    openPanels('tokens', 'dice');
    const onCloseTokens = vi.fn();
    const onCloseDice = vi.fn();

    render(
      <>
        <FloatingPanel
          panelId="tokens"
          isOpen={true}
          onClose={onCloseTokens}
          label="Tokens"
        >
          <div>tokens</div>
        </FloatingPanel>
        <FloatingPanel
          panelId="dice"
          isOpen={true}
          onClose={onCloseDice}
          label="Dice"
        >
          <div>dice</div>
        </FloatingPanel>
      </>,
    );

    // Both panels mounted and each ran bringToFront; `dice` mounted last so it
    // is on top of the stack.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(onCloseDice).toHaveBeenCalledTimes(1);
    expect(onCloseTokens).not.toHaveBeenCalled();
  });

  it('does not call onClose on Escape when another panel is topmost', () => {
    const onClose = vi.fn();
    render(
      <FloatingPanel panelId="tokens" isOpen={true} onClose={onClose} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    // Something else is raised above this panel after it mounted.
    act(() => {
      openPanels('tokens', 'chat');
    });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose on Escape while closed', () => {
    const onClose = vi.fn();
    render(
      <FloatingPanel panelId="tokens" isOpen={false} onClose={onClose} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the previously-focused element on unmount', () => {
    // GameUI mounts/unmounts panels as `activePanels` changes rather than
    // toggling isOpen, so the restore hangs off unmount.
    const opener = document.createElement('button');
    opener.textContent = 'open panel';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(
      <FloatingPanel panelId="tokens" isOpen={true} onClose={() => {}} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    // Opening moves focus into the panel.
    const dialog = document.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);

    act(() => {
      unmount();
    });

    expect(document.activeElement).toBe(opener);

    opener.remove();
  });

  it('cascades default positions so panels do not stack exactly on top of each other', () => {
    openPanels('tokens', 'dice');

    render(
      <>
        <FloatingPanel panelId="tokens" isOpen onClose={() => {}} label="Tokens">
          <div>tokens</div>
        </FloatingPanel>
        <FloatingPanel panelId="dice" isOpen onClose={() => {}} label="Dice">
          <div>dice</div>
        </FloatingPanel>
      </>,
    );

    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    );
    expect(dialogs).toHaveLength(2);

    const transforms = dialogs.map((d) => d.style.transform);
    expect(transforms[0]).not.toBe(transforms[1]);
  });
});

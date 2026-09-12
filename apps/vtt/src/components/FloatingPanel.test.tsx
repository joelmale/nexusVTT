import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { FloatingPanel } from './FloatingPanel';

/**
 * Covers the FloatingPanel shell contract:
 *  - renders children into #portal-root (via Portal)
 *  - Escape calls onClose while open
 *  - focus returns to the previously-focused element on close
 */

beforeEach(() => {
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
      <FloatingPanel isOpen={true} onClose={() => {}} label="Test Panel">
        <div>panel content</div>
      </FloatingPanel>,
    );

    const portalRoot = document.getElementById('portal-root');
    expect(portalRoot?.textContent).toContain('panel content');
  });

  it('sets role="dialog" and aria-label from the label prop', () => {
    render(
      <FloatingPanel isOpen={true} onClose={() => {}} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Tokens' });
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('data-state')).toBe('open');
  });

  it('sets data-state="closed" and aria-hidden when isOpen is false', () => {
    render(
      <FloatingPanel isOpen={false} onClose={() => {}} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('data-state')).toBe('closed');
    expect(dialog?.getAttribute('aria-hidden')).toBe('true');
  });

  it('calls onClose when Escape is pressed while open', () => {
    const onClose = vi.fn();
    render(
      <FloatingPanel isOpen={true} onClose={onClose} label="Tokens">
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

  it('does not call onClose on Escape while closed', () => {
    const onClose = vi.fn();
    render(
      <FloatingPanel isOpen={false} onClose={onClose} label="Tokens">
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

  it('restores focus to the previously-focused element on close', () => {
    const opener = document.createElement('button');
    opener.textContent = 'open panel';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(
      <FloatingPanel isOpen={true} onClose={() => {}} label="Tokens">
        <div>content</div>
      </FloatingPanel>,
    );

    // Opening moves focus into the panel.
    const dialog = document.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);

    // Closing restores focus to the opener.
    act(() => {
      rerender(
        <FloatingPanel isOpen={false} onClose={() => {}} label="Tokens">
          <div>content</div>
        </FloatingPanel>,
      );
    });

    expect(document.activeElement).toBe(opener);

    opener.remove();
  });
});

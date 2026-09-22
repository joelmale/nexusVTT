import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import { GeneratorOverlay } from './GeneratorOverlay';

/**
 * Covers the A6c GeneratorOverlay hygiene contract:
 *  - Escape calls onClose while open
 *  - focus moves into the overlay on open and restores on close
 *  - Tab cycles focus within the overlay (focus trap) instead of escaping
 *    to the rest of the page
 */

beforeEach(() => {
  // GeneratorOverlay renders through the shared #portal-root Portal (see
  // FloatingPanel.test.tsx) so it shares a stacking context with the other
  // floating chrome instead of being trapped inside .game-layout's own
  // stacking context (position: fixed always creates one).
  const portalRoot = document.createElement('div');
  portalRoot.id = 'portal-root';
  document.body.appendChild(portalRoot);

  // Run rAF callbacks synchronously so the focus-on-open effect resolves
  // within the same test tick (same convention as FloatingPanel.test.tsx).
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

describe('GeneratorOverlay', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <GeneratorOverlay isOpen={false} onClose={() => {}}>
        <div>content</div>
      </GeneratorOverlay>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders a modal dialog with children when open', () => {
    render(
      <GeneratorOverlay isOpen={true} onClose={() => {}}>
        <div>generator content</div>
      </GeneratorOverlay>,
    );

    const dialog = screen.getByRole('dialog', { name: /map generator/i });
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('generator content');
  });

  it('calls onClose when Escape is pressed while open', () => {
    const onClose = vi.fn();
    render(
      <GeneratorOverlay isOpen={true} onClose={onClose}>
        <div>content</div>
      </GeneratorOverlay>,
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the overlay on open and restores it on close', () => {
    const opener = document.createElement('button');
    opener.textContent = 'open generator';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(
      <GeneratorOverlay isOpen={true} onClose={() => {}}>
        <button>first focusable</button>
      </GeneratorOverlay>,
    );

    // Opening moves focus to the first focusable element inside the overlay
    // (the close button, since it's the first in DOM order).
    expect(document.activeElement?.getAttribute('title')).toBe(
      'Close generator and return to scene',
    );

    act(() => {
      rerender(
        <GeneratorOverlay isOpen={false} onClose={() => {}}>
          <button>first focusable</button>
        </GeneratorOverlay>,
      );
    });

    expect(document.activeElement).toBe(opener);

    opener.remove();
  });

  it('traps Tab focus within the overlay', () => {
    render(
      <GeneratorOverlay isOpen={true} onClose={() => {}}>
        <button>middle</button>
      </GeneratorOverlay>,
    );

    const closeButton = screen.getByTitle(
      'Close generator and return to scene',
    );
    const middleButton = screen.getByText('middle');

    // Focus the last element and press Tab - should wrap to the first.
    middleButton.focus();
    expect(document.activeElement).toBe(middleButton);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
  });
});

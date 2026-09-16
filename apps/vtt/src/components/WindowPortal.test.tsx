import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React, { useState } from 'react';
import { WindowPortal } from './WindowPortal';

/**
 * Regression cover for the render-loop bug: WindowPortal used to list
 * `onClose`, `title`, `width` and `height` as effect dependencies. Callers
 * pass an inline arrow for `onClose`, so its identity changed on every render,
 * the cleanup closed the window and the effect immediately re-opened it. The
 * re-open had no user gesture behind it, so the popup blocker killed it and
 * the panel tore itself down. The window must be created exactly ONCE.
 */

let openCalls: number;
let closeCalls: number;
let fakeWindow: Window;

function makeFakeWindow(): Window {
  const doc = document.implementation.createHTMLDocument('popup');
  return {
    document: doc,
    closed: false,
    close: () => {
      closeCalls += 1;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    resizeTo: () => {},
  } as unknown as Window;
}

beforeEach(() => {
  openCalls = 0;
  closeCalls = 0;
  fakeWindow = makeFakeWindow();
  vi.stubGlobal('open', () => {
    openCalls += 1;
    return fakeWindow;
  });
  // Force the window.open fallback rather than the Document PiP path.
  delete (window as unknown as Record<string, unknown>).documentPictureInPicture;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WindowPortal', () => {
  it('opens the window exactly once across re-renders with a changing onClose identity', async () => {
    const Harness: React.FC = () => {
      const [tick, setTick] = useState(0);
      return (
        <>
          <button onClick={() => setTick((t) => t + 1)}>rerender</button>
          <WindowPortal
            title="Panel"
            width={400}
            height={600}
            // A fresh identity on every render - exactly what FloatingPanel
            // used to pass before the onClose ref was introduced.
            onClose={() => {
              void tick;
            }}
          >
            <div>content</div>
          </WindowPortal>
        </>
      );
    };

    const { getByText, rerender } = render(<Harness />);
    await Promise.resolve();

    expect(openCalls).toBe(1);

    getByText('rerender').click();
    getByText('rerender').click();
    rerender(<Harness />);
    await Promise.resolve();

    expect(openCalls).toBe(1);
    expect(closeCalls).toBe(0);
  });

  it('does not re-open the window when width/height change', async () => {
    const { rerender } = render(
      <WindowPortal title="Panel" width={400} height={600} onClose={() => {}}>
        <div>content</div>
      </WindowPortal>,
    );
    await Promise.resolve();
    expect(openCalls).toBe(1);

    rerender(
      <WindowPortal title="Panel" width={520} height={700} onClose={() => {}}>
        <div>content</div>
      </WindowPortal>,
    );
    await Promise.resolve();

    expect(openCalls).toBe(1);
    expect(closeCalls).toBe(0);
  });

  it('closes the window on unmount', async () => {
    const { unmount } = render(
      <WindowPortal title="Panel" width={400} height={600} onClose={() => {}}>
        <div>content</div>
      </WindowPortal>,
    );
    await Promise.resolve();
    expect(openCalls).toBe(1);

    unmount();
    expect(closeCalls).toBeGreaterThanOrEqual(1);
  });

  it('calls onClose when the popup is blocked', async () => {
    vi.stubGlobal('open', () => null);
    const onClose = vi.fn();

    render(
      <WindowPortal title="Panel" width={400} height={600} onClose={onClose}>
        <div>content</div>
      </WindowPortal>,
    );
    await Promise.resolve();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

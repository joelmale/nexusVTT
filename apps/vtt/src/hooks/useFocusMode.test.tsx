import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useFocusModeController, FOCUS_MODE_KEY } from './useFocusMode';
import { useUIStackStore } from '@/stores/uiStackStore';

const Harness: React.FC = () => {
  useFocusModeController();
  return <div className="layout-scene" tabIndex={-1} />;
};

function pressKey(key: string, target: EventTarget = window) {
  act(() => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
  });
}

beforeEach(() => {
  useUIStackStore.setState({ focusMode: false });
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-focus-mode');
  vi.restoreAllMocks();
});

describe('useFocusModeController', () => {
  it('toggles focus mode with the F key and mirrors it onto <html>', () => {
    render(<Harness />);
    expect(document.documentElement.hasAttribute('data-focus-mode')).toBe(false);

    pressKey(FOCUS_MODE_KEY);
    expect(useUIStackStore.getState().focusMode).toBe(true);
    expect(document.documentElement.getAttribute('data-focus-mode')).toBe('on');

    pressKey(FOCUS_MODE_KEY);
    expect(useUIStackStore.getState().focusMode).toBe(false);
    expect(document.documentElement.hasAttribute('data-focus-mode')).toBe(false);
  });

  it('mirrors onto <html> rather than the layout container, so portalled chrome is reachable', () => {
    // #portal-root is a sibling of #root, so only a document-level ancestor
    // can match both trees.
    render(<Harness />);
    pressKey(FOCUS_MODE_KEY);
    expect(document.documentElement.getAttribute('data-focus-mode')).toBe('on');
  });

  it('ignores the hotkey while the user is typing', () => {
    render(<Harness />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    pressKey(FOCUS_MODE_KEY, input);
    expect(useUIStackStore.getState().focusMode).toBe(false);

    input.remove();
  });

  it('ignores the hotkey when a modifier is held (Ctrl+F must stay browser find)', () => {
    render(<Harness />);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: FOCUS_MODE_KEY,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(useUIStackStore.getState().focusMode).toBe(false);
  });

  it('ignores the hotkey while a modal dialog is open', () => {
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);

    render(<Harness />);
    pressKey(FOCUS_MODE_KEY);
    expect(useUIStackStore.getState().focusMode).toBe(false);

    modal.remove();
  });

  it('Escape exits focus mode and stops other window Escape listeners firing', () => {
    const otherListener = vi.fn();
    window.addEventListener('keydown', otherListener);

    render(<Harness />);
    pressKey(FOCUS_MODE_KEY);
    expect(useUIStackStore.getState().focusMode).toBe(true);
    otherListener.mockClear();

    pressKey('Escape');

    expect(useUIStackStore.getState().focusMode).toBe(false);
    // stopImmediatePropagation must prevent the panel-closing listeners from
    // also seeing this Escape.
    expect(otherListener).not.toHaveBeenCalled();

    window.removeEventListener('keydown', otherListener);
  });

  it('Escape is left alone when focus mode is off', () => {
    const otherListener = vi.fn();
    window.addEventListener('keydown', otherListener);

    render(<Harness />);
    pressKey('Escape');

    expect(otherListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', otherListener);
  });

  it('clears focus mode and the html attribute on unmount', () => {
    const { unmount } = render(<Harness />);
    pressKey(FOCUS_MODE_KEY);
    expect(useUIStackStore.getState().focusMode).toBe(true);

    act(() => {
      unmount();
    });

    expect(document.documentElement.hasAttribute('data-focus-mode')).toBe(false);
    expect(useUIStackStore.getState().focusMode).toBe(false);
  });

  it('parks focus on the scene when the focused element is inside chrome', () => {
    const chrome = document.createElement('div');
    chrome.setAttribute('data-chrome', '');
    const button = document.createElement('button');
    chrome.appendChild(button);
    document.body.appendChild(chrome);

    const { container } = render(<Harness />);
    button.focus();
    expect(document.activeElement).toBe(button);

    pressKey(FOCUS_MODE_KEY);

    expect(document.activeElement).toBe(container.querySelector('.layout-scene'));

    // Exiting restores focus to where it was.
    pressKey(FOCUS_MODE_KEY);
    expect(document.activeElement).toBe(button);

    chrome.remove();
  });
});

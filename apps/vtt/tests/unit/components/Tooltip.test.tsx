import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Tooltip } from '@/components/Tooltip';

/**
 * BEHAVIOURAL coverage only -- this suite cannot catch the renderer crash that
 * Tooltip was rewritten to fix.
 *
 * That crash came from CSS anchor positioning and top-layer promotion tripping
 * an internal Chromium CHECK. This file runs in jsdom, which implements neither
 * anchor positioning nor the top layer nor `showPopover()`, and in which a
 * renderer crash has no meaning at all. A green run here says nothing about it.
 *
 * The regression guard for the crash is the real-browser spec at
 * tests/ui/panel-cycle-crash.spec.ts. Do not treat this file as a substitute,
 * and in particular do not read the sibling-tooltips test below as proof that
 * the PanelDock topology is safe -- it proves only that they render.
 */

const PORTAL_ROOT_ID = 'portal-root';

function portalRoot(): HTMLElement {
  return document.getElementById(PORTAL_ROOT_ID) as HTMLElement;
}

beforeEach(() => {
  const root = document.createElement('div');
  root.id = PORTAL_ROOT_ID;
  document.body.appendChild(root);
});

afterEach(() => {
  cleanup();
  document.getElementById(PORTAL_ROOT_ID)?.remove();
});

describe('Tooltip', () => {
  it('renders the trigger in place and no tooltip until hovered', () => {
    render(
      <Tooltip text="Open dice">
        <button>Dice</button>
      </Tooltip>,
    );

    expect(screen.getByRole('button', { name: 'Dice' })).toBeTruthy();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('mounts the tooltip into #portal-root, not next to the trigger', () => {
    const { container } = render(
      <Tooltip text="Open dice">
        <button>Dice</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);

    const tip = screen.getByRole('tooltip');
    // The point of the portal: escape the dock's overflow/stacking context.
    expect(portalRoot().contains(tip)).toBe(true);
    expect(container.contains(tip)).toBe(false);
  });

  it('shows on mouseEnter and hides on mouseLeave', () => {
    const { container } = render(
      <Tooltip text="Open dice">
        <button>Dice</button>
      </Tooltip>,
    );
    const trigger = container.firstElementChild as HTMLElement;

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows on focus and hides on blur, so it is keyboard reachable', () => {
    const { container } = render(
      <Tooltip text="Open dice">
        <button>Dice</button>
      </Tooltip>,
    );
    const trigger = container.firstElementChild as HTMLElement;

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('sanitises unsafe markup but keeps safe formatting', () => {
    const { container } = render(
      <Tooltip text={'<b>Bold</b><img src=x onerror="alert(1)">'}>
        <button>Dice</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);

    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('b')?.textContent).toBe('Bold');
    // DOMPurify strips the handler; the tag itself may survive.
    expect(tip.innerHTML).not.toContain('onerror');
    expect(tip.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });

  it('does not execute script tags passed as text', () => {
    const { container } = render(
      <Tooltip text={'<script>window.__pwned = true;</script>safe'}>
        <button>Dice</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);

    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('script')).toBeNull();
    expect(
      (window as unknown as Record<string, unknown>).__pwned,
    ).toBeUndefined();
  });

  it('keeps sibling tooltips independent', () => {
    // Mirrors the PanelDock topology (one Tooltip per dock button). In jsdom
    // this only shows they render and toggle independently -- it says nothing
    // about the anchor/top-layer interaction that caused the crash.
    render(
      <>
        <Tooltip text="Dice">
          <button>Dice</button>
        </Tooltip>
        <Tooltip text="Chat">
          <button>Chat</button>
        </Tooltip>
        <Tooltip text="Tokens">
          <button>Tokens</button>
        </Tooltip>
      </>,
    );

    const triggers = document.querySelectorAll('.tooltip-container');
    expect(triggers).toHaveLength(3);

    fireEvent.mouseEnter(triggers[0]);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip').textContent).toBe('Dice');

    fireEvent.mouseEnter(triggers[2]);
    expect(screen.getAllByRole('tooltip')).toHaveLength(2);

    fireEvent.mouseLeave(triggers[0]);
    const remaining = screen.getAllByRole('tooltip');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toBe('Tokens');
  });

  it('leaves no orphaned nodes in the portal after unmount', () => {
    const { container, unmount } = render(
      <Tooltip text="Open dice">
        <button>Dice</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    expect(portalRoot().childElementCount).toBe(1);

    unmount();
    expect(portalRoot().childElementCount).toBe(0);
  });

  it('renders nothing extra when #portal-root is missing', () => {
    // Portal bails out rather than throwing; the trigger must still render.
    portalRoot().remove();

    const { container } = render(
      <Tooltip text="Open dice">
        <button>Dice</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);

    expect(screen.getByRole('button', { name: 'Dice' })).toBeTruthy();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

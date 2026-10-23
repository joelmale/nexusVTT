import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from '@/types/game';
import type { PlacedToken } from '@/types/token';

const canvas = vi.hoisted(() => ({
  onSceneTap: undefined as ((p: { x: number; y: number }) => void) | undefined,
  profile: undefined as string | undefined,
}));
vi.mock('@/components/Scene/SceneCanvas', () => ({
  SceneCanvas: (props: {
    interactionProfile?: string;
    onSceneTap?: (p: { x: number; y: number }) => void;
  }) => {
    canvas.onSceneTap = props.onSceneTap;
    canvas.profile = props.interactionProfile;
    return <div data-testid="scene-canvas" />;
  },
}));

const store = vi.hoisted(() => ({
  followDM: true,
  moveTokenOptimistic: vi.fn(),
  updateCamera: vi.fn(),
  setFollowDM: vi.fn(),
}));
vi.mock('@/stores/gameStore', () => ({
  useGameStore: (selector: (s: typeof store) => unknown) => selector(store),
  useFollowDM: () => store.followDM,
}));

import { SimpleMapViewport } from '@/components/simple-player/SimpleMapViewport';

function token(overrides: Partial<PlacedToken> = {}): PlacedToken {
  return {
    id: 'tok-1',
    x: 100,
    y: 100,
    scale: 1,
    placedBy: 'dm',
    characterId: 'c1',
    visibleToPlayers: true,
    ...overrides,
  } as PlacedToken;
}

function scene(tokens: PlacedToken[]): Scene {
  return {
    id: 'scene-1',
    gridSettings: { size: 50, snapToGrid: true },
    placedTokens: tokens,
  } as unknown as Scene;
}

function tap(x: number, y: number) {
  React.act(() => canvas.onSceneTap?.({ x, y }));
}

const owned = new Set(['c1']);

describe('SimpleMapViewport', () => {
  beforeEach(() => {
    store.followDM = true;
    store.moveTokenOptimistic.mockReset();
    store.updateCamera.mockReset();
    store.setFollowDM.mockReset();
  });

  it('renders the canvas in the simple profile', () => {
    render(
      <SimpleMapViewport
        scene={scene([token()])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    expect(canvas.profile).toBe('simple');
  });

  it('centres on my token and stops following the DM', () => {
    render(
      <SimpleMapViewport
        scene={scene([token()])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Center on My Token' }));
    expect(store.setFollowDM).toHaveBeenCalledWith(false);
    expect(store.updateCamera).toHaveBeenCalledWith({ x: 125, y: 125 });
  });

  it('moves my token through tap, distance and confirm', () => {
    render(
      <SimpleMapViewport
        scene={scene([token()])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move My Token' }));
    expect(
      screen.getByText('Tap where your token should go'),
    ).toBeInTheDocument();

    tap(373, 120);
    expect(screen.getByText('Move here — 25 ft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Move' }));

    expect(store.moveTokenOptimistic).toHaveBeenCalledWith('scene-1', 'tok-1', {
      x: 350,
      y: 100,
    });
    expect(
      screen.queryByRole('group', { name: 'Confirm move' }),
    ).not.toBeInTheDocument();
  });

  it('enters move mode when I tap my own token', () => {
    render(
      <SimpleMapViewport
        scene={scene([token()])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    tap(500, 500);
    expect(
      screen.queryByText('Tap where your token should go'),
    ).not.toBeInTheDocument();
    tap(120, 120);
    expect(
      screen.getByText('Tap where your token should go'),
    ).toBeInTheDocument();
  });

  it('cancels a pending move', () => {
    render(
      <SimpleMapViewport
        scene={scene([token()])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move My Token' }));
    tap(300, 300);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(store.moveTokenOptimistic).not.toHaveBeenCalled();
    expect(screen.queryByText(/Move here/)).not.toBeInTheDocument();
  });

  it('toggles move mode off again', () => {
    render(
      <SimpleMapViewport
        scene={scene([token()])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    const move = screen.getByRole('button', { name: 'Move My Token' });
    fireEvent.click(move);
    expect(move).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(move);
    expect(move).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers no token controls for tokens I do not own', () => {
    render(
      <SimpleMapViewport
        scene={scene([token({ characterId: 'c9' })])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Move My Token' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Center on My Token' }),
    ).not.toBeInTheDocument();
    tap(120, 120);
    expect(
      screen.queryByText('Tap where your token should go'),
    ).not.toBeInTheDocument();
  });

  it('cannot move a locked token', () => {
    render(
      <SimpleMapViewport
        scene={scene([token({ locked: true })])}
        userId="p1"
        ownedCharacterIds={owned}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Move My Token' }),
    ).toBeDisabled();
    tap(120, 120);
    expect(
      screen.queryByText('Tap where your token should go'),
    ).not.toBeInTheDocument();
  });

  it('gives spectators only Follow DM', () => {
    render(
      <SimpleMapViewport
        scene={scene([token({ placedBy: 'p1' })])}
        userId="p1"
        ownedCharacterIds={owned}
        readOnly
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Move My Token' }),
    ).not.toBeInTheDocument();
    const follow = screen.getByRole('button', { name: 'Follow DM' });
    expect(follow).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(follow);
    expect(store.setFollowDM).toHaveBeenCalledWith(false);
  });

  it('falls back to default grid settings', () => {
    const bare = { id: 's', placedTokens: [token()] } as unknown as Scene;
    render(
      <SimpleMapViewport scene={bare} userId="p1" ownedCharacterIds={owned} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move My Token' }));
    tap(173, 120);
    expect(screen.getByText('Move here — 5 ft')).toBeInTheDocument();
  });
});

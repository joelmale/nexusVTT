import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScenePill } from './ScenePill';
import { useGameStore } from '@/stores/gameStore';
import { drawingPersistenceService } from '@/services/drawingPersistence';
import { initializeGameStateSyncRuntime } from '@/services/gameStateSyncRuntime';
import type { Scene } from '@/types/game';

// Conventions per src/stores/fog.test.ts (network mocked; real store).
vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn().mockReturnValue(true),
    sendEvent: vi.fn(),
    sendGameStateUpdate: vi.fn(),
  },
}));
vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    saveScene: vi.fn().mockResolvedValue(undefined),
    loadScene: vi.fn().mockResolvedValue(null),
  },
}));

/**
 * Tests for Joel's S13 ScenePill redesign: a hover-expanding floating scene
 * dock (compact pill → chips + add button on hover), draggable, host-only.
 * The expanded view is ALWAYS rendered and collapsed via CSS, so queries use
 * scoped selectors / roles rather than assuming conditional mounting.
 * (Replaces the A6c click-popover tests, which tested a design that was
 * superseded in the working tree during gate review.)
 */
const scenesFixture = (): Scene[] =>
  [
    {
      id: 's1',
      name: 'The Tavern',
      drawings: [],
      placedTokens: [],
      placedProps: [],
    },
    {
      id: 's2',
      name: 'The Dungeon',
      drawings: [],
      placedTokens: [],
      placedProps: [],
    },
  ] as unknown as Scene[];

const seedStore = (userType: 'host' | 'player') => {
  useGameStore.setState((state) => {
    state.user.type = userType;
    // createScene throws without an active session
    state.session = {
      roomCode: 'TEST',
      hostId: 'host-1',
      players: [],
    } as unknown as typeof state.session;
    state.sceneState.scenes = scenesFixture() as Scene[];
    state.sceneState.activeSceneId = 's1';
  });
};

const renderPill = () =>
  render(<ScenePill scenes={scenesFixture()} activeSceneId="s1" />);

describe('ScenePill (hover-expanding scene dock)', () => {
  beforeEach(() => {
    initializeGameStateSyncRuntime();
    // vitest mockReset:true wipes factory implementations — re-arm (repo gotcha;
    // an un-armed saveScene returns undefined and its .catch throws INSIDE
    // createScene, aborting it between the push and setActiveScene).
    vi.mocked(drawingPersistenceService.saveScene).mockResolvedValue(undefined);
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the compact pill with the active scene name for a host', () => {
    seedStore('host');
    const { container, getByRole } = renderPill();
    expect(getByRole('region', { name: 'Scene Manager' })).toBeTruthy();
    // Active name appears in the compact view (and again as a chip — scoped query).
    const compact = container.querySelector('[class*="compactView"]');
    expect(compact?.textContent).toContain('The Tavern');
    expect(
      getByRole('region', { name: 'Scene Manager' }).getAttribute(
        'aria-expanded',
      ),
    ).toBe('false');
  });

  it('renders nothing for a non-host', () => {
    seedStore('player');
    const { container } = renderPill();
    expect(container.firstChild).toBeNull();
  });

  it('expands on hover and collapses 400ms after mouse leave', () => {
    seedStore('host');
    const { getByRole } = renderPill();
    const region = getByRole('region', { name: 'Scene Manager' });

    fireEvent.mouseEnter(region);
    expect(region.getAttribute('aria-expanded')).toBe('true');

    fireEvent.mouseLeave(region);
    expect(region.getAttribute('aria-expanded')).toBe('true'); // grace period
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(region.getAttribute('aria-expanded')).toBe('false');
  });

  it('switches the active scene when a chip is clicked', () => {
    seedStore('host');
    const { getByRole, getByTitle } = renderPill();
    fireEvent.mouseEnter(getByRole('region', { name: 'Scene Manager' }));

    fireEvent.click(getByTitle('The Dungeon'));
    expect(useGameStore.getState().sceneState.activeSceneId).toBe('s2');
  });

  it('creates and activates a new scene via the + button', () => {
    seedStore('host');
    const { getByRole } = renderPill();
    fireEvent.mouseEnter(getByRole('region', { name: 'Scene Manager' }));

    fireEvent.click(getByRole('button', { name: 'Create new scene' }));

    const { scenes, activeSceneId } = useGameStore.getState().sceneState;
    expect(scenes.length).toBe(3);
    // The NEW scene (whatever id/name the store assigned it) became active.
    const created = scenes.find((s) => s.id !== 's1' && s.id !== 's2');
    expect(created).toBeTruthy();
    expect(activeSceneId).toBe(created!.id);
  });
});

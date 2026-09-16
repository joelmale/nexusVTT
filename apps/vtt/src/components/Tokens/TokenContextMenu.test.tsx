import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { TokenContextMenu } from './TokenContextMenu';
import { useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { InitiativeEntry } from '@/types/initiative';

/**
 * Item 6 contract: damage and conditions delegate to the initiative entry
 * (the only model with real 5e HP maths), and are unavailable for a token
 * that has no entry.
 */

const TOKEN_ID = 'token-1';
const SCENE_ID = 'scene-1';

function makeEntry(overrides: Partial<InitiativeEntry> = {}): InitiativeEntry {
  return {
    id: 'entry-1',
    name: 'Goblin',
    type: 'monster',
    initiative: 12,
    maxHP: 20,
    currentHP: 20,
    tempHP: 0,
    armorClass: 13,
    conditions: [],
    isActive: false,
    isReady: false,
    isDelayed: false,
    tokenId: TOKEN_ID,
    notes: '',
    deathSaves: { successes: 0, failures: 0 },
    initiativeModifier: 0,
    dexterityModifier: 0,
    ...overrides,
  };
}

function seedScene() {
  const state = useGameStore.getState();
  useGameStore.setState({
    ...state,
    user: { ...state.user, type: 'host' },
    sceneState: {
      ...state.sceneState,
      activeSceneId: SCENE_ID,
      camera: { x: 0, y: 0, zoom: 1 },
      scenes: [
        {
          ...(state.sceneState.scenes[0] ?? {}),
          id: SCENE_ID,
          name: 'Test',
          placedTokens: [
            {
              id: TOKEN_ID,
              x: 0,
              y: 0,
              rotation: 0,
              visibleToPlayers: true,
              isInInitiative: true,
              conditions: [],
            },
          ],
          drawings: [],
        },
      ],
    },
  } as never);
}

beforeEach(() => {
  vi.useFakeTimers();

  const portalRoot = document.createElement('div');
  portalRoot.id = 'portal-root';
  document.body.appendChild(portalRoot);

  // TokenContextMenu bails out without the canvas root to measure against.
  const canvas = document.createElement('div');
  canvas.setAttribute('data-role', 'scene-canvas-root');
  document.body.appendChild(canvas);

  seedScene();
  useInitiativeStore.setState({ entries: [] } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.getElementById('portal-root')?.remove();
  document.querySelector('[data-role="scene-canvas-root"]')?.remove();
});

function renderMenu() {
  const result = render(
    <TokenContextMenu
      tokenId={TOKEN_ID}
      worldX={0}
      worldY={0}
      isDragging={false}
      onEdit={() => {}}
    />,
  );
  // The menu debounces its appearance by 120ms.
  act(() => {
    vi.advanceTimersByTime(150);
  });
  return result;
}

describe('TokenContextMenu', () => {
  it('disables damage and conditions when the token has no initiative entry', () => {
    renderMenu();

    expect(
      screen.getByTitle(/Add this token to initiative to track HP/i),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByTitle(/Add this token to initiative to track conditions/i),
    ).toHaveProperty('disabled', true);
  });

  it('applies damage through initiativeStore, draining tempHP first', () => {
    useInitiativeStore.setState({
      entries: [makeEntry({ currentHP: 20, tempHP: 5 })],
    } as never);

    renderMenu();

    fireEvent.click(screen.getByTitle('Damage / heal'));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Damage'));

    const entry = useInitiativeStore.getState().entries[0];
    // 8 damage against 5 temp + 20 current -> temp gone, 3 off current.
    expect(entry.tempHP).toBe(0);
    expect(entry.currentHP).toBe(17);
  });

  it('heals through initiativeStore, clamped to maxHP', () => {
    useInitiativeStore.setState({
      entries: [makeEntry({ currentHP: 5 })],
    } as never);

    renderMenu();

    fireEvent.click(screen.getByTitle('Damage / heal'));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '999' } });
    fireEvent.click(screen.getByText('Heal'));

    expect(useInitiativeStore.getState().entries[0].currentHP).toBe(20);
  });

  it('ignores a non-positive damage amount', () => {
    useInitiativeStore.setState({ entries: [makeEntry()] } as never);
    renderMenu();

    fireEvent.click(screen.getByTitle('Damage / heal'));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Damage'));

    expect(useInitiativeStore.getState().entries[0].currentHP).toBe(20);
  });

  it('toggles a condition on and back off', () => {
    useInitiativeStore.setState({ entries: [makeEntry()] } as never);
    renderMenu();

    fireEvent.click(screen.getByTitle('Conditions'));

    // NOTE: initiativeStore.addCondition replaces the condition id with a
    // fresh crypto.randomUUID(), so applied conditions can only be matched by
    // name - both here and in the component.
    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));
    expect(
      useInitiativeStore.getState().entries[0].conditions.map((c) => c.name),
    ).toContain('Blinded');

    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));
    expect(
      useInitiativeStore.getState().entries[0].conditions.map((c) => c.name),
    ).not.toContain('Blinded');
  });

  it('reflects an already-applied condition as pressed', () => {
    useInitiativeStore.setState({
      entries: [
        makeEntry({
          conditions: [
            { id: 'stored-uuid', name: 'Blinded', description: '', icon: '', color: '' },
          ],
        }),
      ],
    } as never);
    renderMenu();

    fireEvent.click(screen.getByTitle('Conditions'));
    expect(
      screen.getByRole('button', { name: /Blinded/i }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

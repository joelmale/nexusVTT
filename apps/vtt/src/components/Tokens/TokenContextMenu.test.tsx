import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { TokenContextMenu } from './TokenContextMenu';
import { useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { InitiativeEntry } from '@/types/initiative';
import type { SpellCircleDrawing, SpellConeDrawing } from '@/types/drawing';

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
  it('disables damage when the token has no initiative entry while keeping conditions available', () => {
    renderMenu();

    expect(
      screen.getByTitle(/Add this token to initiative to track HP/i),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByTitle('Conditions'),
    ).toHaveProperty('disabled', false);
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

  it('synchronizes with initiativeStore when toggling initiative ON', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      ...state,
      sceneState: {
        ...state.sceneState,
        scenes: state.sceneState.scenes.map((s) => ({
          ...s,
          placedTokens: s.placedTokens.map((t) =>
            t.id === TOKEN_ID ? { ...t, isInInitiative: false } : t,
          ),
        })),
      },
    } as never);

    renderMenu();

    expect(screen.getByTitle(/Add this token to initiative to track HP/i)).toBeDisabled();

    fireEvent.click(screen.getByTitle('Add to initiative'));

    const entries = useInitiativeStore.getState().entries;
    expect(entries.length).toBe(1);
    expect(entries[0].tokenId).toBe(TOKEN_ID);
  });

  it('toggles token dead status', () => {
    renderMenu();

    fireEvent.click(screen.getByTitle('Mark dead / defeated'));

    const token = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    expect(token?.isDead).toBe(true);

    fireEvent.click(screen.getByTitle('Revive token (mark alive)'));
    const tokenAlive = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    expect(tokenAlive?.isDead).toBe(false);
  });

  it('toggles token position lock', () => {
    renderMenu();

    fireEvent.click(screen.getByTitle('Lock position'));

    const token = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    expect(token?.locked).toBe(true);

    fireEvent.click(screen.getByTitle('Unlock position'));
    const tokenUnlocked = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    expect(tokenUnlocked?.locked).toBe(false);
  });

  it('duplicates token when duplicate button is clicked', async () => {
    renderMenu();

    await act(async () => {
      fireEvent.click(screen.getByTitle('Duplicate token'));
    });

    const tokens = useGameStore.getState().sceneState.scenes[0].placedTokens;
    expect(tokens.length).toBe(2);
  });

  it('sets elevation when preset is clicked', () => {
    renderMenu();

    fireEvent.click(screen.getByTitle(/Elevation/i));
    fireEvent.click(screen.getByRole('button', { name: '+30 ft' }));

    const token = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    expect(token?.elevation).toBe(30);
  });

  it('deletes token and clears selection', () => {
    useGameStore.setState({
      ...useGameStore.getState(),
      sceneState: {
        ...useGameStore.getState().sceneState,
        selectedObjectIds: [TOKEN_ID],
      },
    } as never);

    renderMenu();

    fireEvent.click(screen.getByTitle('Delete'));

    const tokens = useGameStore.getState().sceneState.scenes[0].placedTokens;
    expect(tokens.find((t) => t.id === TOKEN_ID)).toBeUndefined();
    expect(useGameStore.getState().sceneState.selectedObjectIds).toEqual([]);
  });

  it('rolls initiative for single token using 1d20 + Dex modifier', () => {
    // Give token dexterity of 14 (+2 mod)
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    if (token) {
      token.currentStats = { hp: 20, dex: 14 };
    }

    renderMenu();

    const rollBtn = screen.getByTitle('Roll initiative (1d20 + Dex)');
    expect(rollBtn).toBeInTheDocument();

    fireEvent.click(rollBtn);

    const entries = useInitiativeStore.getState().entries;
    const entry = entries.find((e) => e.tokenId === TOKEN_ID);
    expect(entry).toBeDefined();
    expect(entry?.initiativeModifier).toBe(2);
    expect(entry?.initiative).toBeGreaterThanOrEqual(3); // 1 + 2
    expect(entry?.initiative).toBeLessThanOrEqual(22); // 20 + 2
  });

  it('rolls initiative for all selected monsters at once', () => {
    // Add a second token to the scene
    const TOKEN_2 = 'token-2';
    const state = useGameStore.getState();
    const scene = state.sceneState.scenes[0];
    scene.placedTokens.push({
      id: TOKEN_2,
      x: 50,
      y: 50,
      rotation: 0,
      scale: 1,
      layer: 'tokens',
      visibleToPlayers: true,
      dmNotesOnly: false,
      placedBy: 'user-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenId: 'goblin-2',
      sceneId: SCENE_ID,
      roomCode: 'TEST',
      conditions: [],
      currentStats: { hp: 15, dex: 16 }, // +3 mod
    });

    useGameStore.setState({
      ...state,
      sceneState: {
        ...state.sceneState,
        selectedObjectIds: [TOKEN_ID, TOKEN_2],
      },
    } as never);

    renderMenu();

    const multiRollBtn = screen.getByTitle(
      'Roll initiative for all 2 selected creatures (1d20 + Dex)',
    );
    expect(multiRollBtn).toBeInTheDocument();
    expect(multiRollBtn.textContent).toBe('🎲×2');

    fireEvent.click(multiRollBtn);

    const entries = useInitiativeStore.getState().entries;
    const entry1 = entries.find((e) => e.tokenId === TOKEN_ID);
    const entry2 = entries.find((e) => e.tokenId === TOKEN_2);

    expect(entry1).toBeDefined();
    expect(entry2).toBeDefined();
    expect(entry2?.initiativeModifier).toBe(3);
    expect(entry2?.initiative).toBeGreaterThanOrEqual(4); // 1 + 3
    expect(entry2?.initiative).toBeLessThanOrEqual(23); // 20 + 3
  });

  it('drops a Fireball sphere AoE template onto the scene canvas', () => {
    renderMenu();

    const spellBtn = screen.getByTitle('Drop Spell AoE...');
    expect(spellBtn).toBeInTheDocument();

    fireEvent.click(spellBtn);

    const fireballBtn = screen.getByRole('button', { name: /Fireball/i });
    expect(fireballBtn).toBeInTheDocument();

    fireEvent.click(fireballBtn);

    const scene = useGameStore.getState().sceneState.scenes[0];
    const spellDrawing = scene.drawings.find((d) => d.type === 'spell-circle');

    expect(spellDrawing).toBeDefined();
    expect(spellDrawing?.layer).toBe('effects');
    expect((spellDrawing as SpellCircleDrawing).radius).toBe(200); // 20ft radius = 4 squares * 50px
    expect(spellDrawing?.style?.elementType).toBe('fire');
    expect(spellDrawing?.style?.spellName).toBe('Fireball (20ft)');
  });

  it('drops a cone spell template facing token rotation angle', () => {
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.rotation = 90;

    renderMenu();

    fireEvent.click(screen.getByTitle('Drop Spell AoE...'));
    fireEvent.click(screen.getByRole('button', { name: /Burning Hands/i }));

    const scene = useGameStore.getState().sceneState.scenes[0];
    const coneDrawing = scene.drawings.find((d) => d.type === 'spell-cone');

    expect(coneDrawing).toBeDefined();
    expect((coneDrawing as SpellConeDrawing).direction).toBe(90);
    expect((coneDrawing as SpellConeDrawing).length).toBe(150); // 15ft cone = 3 squares * 50px
    expect(coneDrawing?.style?.elementType).toBe('fire');
  });

  it('allows toggling conditions on tokens that are NOT in initiative', () => {
    // Ensure token is not in initiative and has no initiative entry
    const state = useGameStore.getState();
    useGameStore.setState({
      ...state,
      sceneState: {
        ...state.sceneState,
        scenes: state.sceneState.scenes.map((s) => ({
          ...s,
          placedTokens: s.placedTokens.map((t) =>
            t.id === TOKEN_ID ? { ...t, isInInitiative: false, conditions: [] } : t,
          ),
        })),
      },
    } as never);
    useInitiativeStore.setState({ entries: [] });

    renderMenu();

    const conditionMenuBtn = screen.getByTitle('Conditions');
    expect(conditionMenuBtn).toBeEnabled();

    fireEvent.click(conditionMenuBtn);

    const poisonedBtn = screen.getByRole('button', { name: /Poisoned/i });
    expect(poisonedBtn).toBeInTheDocument();
    expect(poisonedBtn.getAttribute('aria-pressed')).toBe('false');

    // Toggle Poisoned ON
    fireEvent.click(poisonedBtn);

    const token = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    expect(token?.conditions.some((c) => c.id === 'poisoned')).toBe(true);

    // Toggle Poisoned OFF
    fireEvent.click(poisonedBtn);
    const tokenAfter = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === TOKEN_ID);
    expect(tokenAfter?.conditions.some((c) => c.id === 'poisoned')).toBe(false);
  });
});

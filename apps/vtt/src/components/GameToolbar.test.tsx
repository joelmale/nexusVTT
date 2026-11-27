import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { GameToolbar } from './GameToolbar';

/**
 * A9 gate coverage for the new host-only "Fog" toolbar group:
 *  - hidden entirely for a non-host (mirrors the pre-existing dm-mask /
 *    dm-utility groups' host gating)
 *  - visible for a host, with the expected four buttons
 *  - fog-toggle calls setFogEnabled with the inverse of the current
 *    fog.enabled flag
 *  - fog-reveal-rect / fog-reveal-brush are plain tool-select buttons
 *    (setActiveTool), like every other shape tool
 *  - fog-clear confirms then calls clearFog
 */

const mockSetActiveTool = vi.fn();
const mockSetFogEnabled = vi.fn();
const mockClearFog = vi.fn();
const mockUpdateCamera = vi.fn();

let mockIsHost = true;
let mockActiveTool = 'select';
let mockFog: { enabled: boolean; shapes: unknown[] } | null = null;

vi.mock('@/stores/gameStore', () => ({
  useGameStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = {
        updateCamera: mockUpdateCamera,
        setActiveTool: mockSetActiveTool,
        setFogEnabled: mockSetFogEnabled,
        clearFog: mockClearFog,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        setFogEnabled: mockSetFogEnabled,
        clearFog: mockClearFog,
      }),
    },
  ),
  useIsHost: () => mockIsHost,
  useCamera: () => ({ x: 0, y: 0, zoom: 1 }),
  useActiveTool: () => mockActiveTool,
  useActiveScene: () => ({ id: 'scene-1', name: 'Test Scene' }),
}));

vi.mock('@/stores/scene', () => ({
  useSceneFog: () => mockFog,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsHost = true;
  mockActiveTool = 'select';
  mockFog = null;
});

describe('GameToolbar - Fog group (A9)', () => {
  it('does not render the legacy dm-mask controls for a host', () => {
    mockIsHost = true;

    render(<GameToolbar mode="design" />);

    expect(screen.queryByLabelText('Create Mask')).toBeNull();
    expect(screen.queryByLabelText('Toggle Mask')).toBeNull();
    expect(screen.queryByLabelText('Remove Mask')).toBeNull();
    expect(screen.queryByLabelText('Reveal Scene')).toBeNull();
    expect(screen.queryByLabelText('Hide Scene')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Fog Setup' }),
    ).toBeInTheDocument();
  });

  it('is not rendered for a non-host', () => {
    mockIsHost = false;

    render(<GameToolbar />);

    expect(screen.queryByRole('button', { name: 'Reveal Fog' })).toBeNull();
    expect(screen.queryByLabelText('Reveal Rect')).toBeNull();
    expect(screen.queryByLabelText('Reveal Brush')).toBeNull();
    expect(screen.queryByLabelText('Clear Fog Reveals')).toBeNull();
  });

  it('is rendered for a host with all four fog controls', () => {
    mockIsHost = true;

    render(<GameToolbar mode="design" />);

    expect(
      screen.getByRole('button', { name: 'Fog Setup' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Fog: Off')).not.toBeNull();
    expect(screen.getByLabelText('Reveal Rect')).not.toBeNull();
    expect(screen.getByLabelText('Reveal Brush')).not.toBeNull();
    expect(screen.getByLabelText('Clear Fog Reveals')).not.toBeNull();
  });

  it('fog-toggle calls setFogEnabled(sceneId, true) when fog is currently off', () => {
    mockFog = null;
    render(<GameToolbar mode="design" />);

    fireEvent.click(screen.getByLabelText('Fog: Off'));

    expect(mockSetFogEnabled).toHaveBeenCalledWith('scene-1', true);
  });

  it('fog-toggle calls setFogEnabled(sceneId, false) when fog is currently on', () => {
    mockFog = { enabled: true, shapes: [] };
    render(<GameToolbar mode="design" />);

    expect(screen.getByLabelText('Fog: On')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Fog: On'));

    expect(mockSetFogEnabled).toHaveBeenCalledWith('scene-1', false);
  });

  it('fog-reveal-rect activates the fog-reveal-rect tool', () => {
    render(<GameToolbar />);

    fireEvent.click(screen.getByLabelText('Reveal Rect'));

    expect(mockSetActiveTool).toHaveBeenCalledWith('fog-reveal-rect');
  });

  it('fog-reveal-brush activates the fog-reveal-brush tool', () => {
    render(<GameToolbar />);

    fireEvent.click(screen.getByLabelText('Reveal Brush'));

    expect(mockSetActiveTool).toHaveBeenCalledWith('fog-reveal-brush');
  });

  it('fog-clear confirms then calls clearFog(sceneId)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GameToolbar mode="design" />);
    fireEvent.click(screen.getByLabelText('Clear Fog Reveals'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockClearFog).toHaveBeenCalledWith('scene-1');
  });

  it('fog-clear does nothing if the confirm dialog is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<GameToolbar mode="design" />);
    fireEvent.click(screen.getByLabelText('Clear Fog Reveals'));

    expect(mockClearFog).not.toHaveBeenCalled();
  });

  it('the reveal-rect button reflects active state via aria-pressed', () => {
    mockActiveTool = 'fog-reveal-rect';
    render(<GameToolbar />);

    const btn = screen.getByLabelText('Reveal Rect');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps live reveals in Play and puts scene setup in Design', () => {
    const { rerender } = render(<GameToolbar />);
    expect(
      screen.getByRole('toolbar', { name: 'Quick Tools Dock' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reveal Fog' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Grid Alignment')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Clear Fog Reveals'),
    ).not.toBeInTheDocument();

    rerender(<GameToolbar mode="design" />);
    expect(
      screen.getByRole('toolbar', { name: 'Design tools' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Grid Alignment' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Spells' }),
    ).not.toBeInTheDocument();
  });

  it('returns to Select when leaving Grid Alignment', () => {
    const { rerender } = render(<GameToolbar mode="design" />);
    mockActiveTool = 'grid-align';
    rerender(<GameToolbar mode="design" />);
    expect(mockSetActiveTool).not.toHaveBeenCalled();
    rerender(<GameToolbar mode="play" />);
    expect(mockSetActiveTool).toHaveBeenCalledExactlyOnceWith('select');
  });

  it('supports tool shortcuts while popovers are closed', () => {
    render(<GameToolbar />);
    fireEvent.keyDown(document.body, { key: 'D' });
    expect(mockSetActiveTool).toHaveBeenCalledExactlyOnceWith('pencil');
  });
});

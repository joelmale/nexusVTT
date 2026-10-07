import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GeneratorSidebar } from './GeneratorSidebar';
import type { GeneratorId } from './generatorActions';

const baseProps = {
  onGeneratorChange: vi.fn(),
  onAddToScene: vi.fn(),
  hasActiveScene: true,
  hasValidArtifact: true,
  activeSceneName: 'Test Scene',
};

const renderSidebar = (
  generator: GeneratorId,
  extra: Partial<React.ComponentProps<typeof GeneratorSidebar>> = {},
) => {
  const onAction = vi.fn();
  render(
    <GeneratorSidebar
      {...baseProps}
      activeGenerator={generator}
      onAction={onAction}
      {...extra}
    />,
  );
  return { onAction };
};

describe('GeneratorSidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => localStorage.clear());

  it('shows the active generator on the Layers tab and sends its own key', () => {
    const { onAction } = renderSidebar('world');
    fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));

    fireEvent.click(screen.getByRole('button', { name: /^Labels/ }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'labels', keyCode: 76 }),
    );
  });

  it('renders presets as chips on the Style tab', () => {
    const { onAction } = renderSidebar('world');
    fireEvent.click(screen.getByRole('tab', { name: 'Style' }));

    fireEvent.click(screen.getByRole('button', { name: 'Antique' }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'preset-antique', keyCode: 50 }),
    );
  });

  it('hides tabs a generator has no actions for', () => {
    renderSidebar('city');
    expect(screen.queryByRole('tab', { name: 'Generate' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Style' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Output' })).toBeInTheDocument();
  });

  it('searches every tab and sends the matching action', () => {
    const { onAction } = renderSidebar('city');
    fireEvent.change(screen.getByLabelText('Find an action'), {
      target: { value: 'grid' },
    });

    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Toggle Grid/ }));
    // The City grid is D, not G (G opens a window there).
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'grid', keyCode: 68 }),
    );
  });

  it('says so when a search matches nothing', () => {
    renderSidebar('dungeon');
    fireEvent.change(screen.getByLabelText('Find an action'), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText(/No actions match/)).toBeInTheDocument();
  });

  it('disables a pending action', () => {
    renderSidebar('dungeon', { pendingActionIds: new Set(['reroll']) });
    expect(screen.getByTitle('Reroll new map (Enter)')).toBeDisabled();
  });

  it('collapses to an icon rail, persists it, and expands again', () => {
    renderSidebar('dungeon');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Map Studio' }));

    expect(localStorage.getItem('nexus-ui-generator-collapsed')).toBe('true');
    expect(screen.queryByText('Map Studio')).toBeNull();
    const rail = screen.getByRole('complementary', {
      name: 'Map Studio controls',
    });
    expect(
      within(rail).getByRole('button', { name: 'Cave' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Map Studio' }));
    expect(screen.getByText('Map Studio')).toBeInTheDocument();
    expect(localStorage.getItem('nexus-ui-generator-collapsed')).toBe('false');
  });

  it('restores the collapsed state from storage', () => {
    localStorage.setItem('nexus-ui-generator-collapsed', 'true');
    renderSidebar('dungeon');
    expect(
      screen.getByRole('button', { name: 'Expand Map Studio' }),
    ).toBeInTheDocument();
  });

  it('toggles the sidebar with the [ key but not while typing', () => {
    renderSidebar('dungeon');
    const search = screen.getByLabelText('Find an action');
    fireEvent.keyDown(search, { key: '[' });
    expect(localStorage.getItem('nexus-ui-generator-collapsed')).toBeNull();

    fireEvent.keyDown(window, { key: '[' });
    expect(localStorage.getItem('nexus-ui-generator-collapsed')).toBe('true');
  });

  it('swaps the dock side and persists it', () => {
    renderSidebar('dungeon');
    const aside = screen.getByRole('complementary', {
      name: 'Map Studio controls',
    });
    expect(aside).toHaveAttribute('data-dock', 'left');

    fireEvent.click(screen.getByRole('button', { name: 'Dock right' }));

    expect(aside).toHaveAttribute('data-dock', 'right');
    expect(localStorage.getItem('nexus-ui-generator-dock')).toBe('right');
  });

  it('resizes with the arrow keys and clamps to the allowed range', () => {
    renderSidebar('dungeon');
    const handle = screen.getByRole('separator', { name: 'Resize Map Studio' });

    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    expect(handle).toHaveAttribute('aria-valuenow', '380');

    for (let i = 0; i < 10; i += 1) {
      fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    }
    expect(handle).toHaveAttribute('aria-valuenow', '460');
    expect(localStorage.getItem('nexus-ui-generator-width')).toBe('460');
  });

  it('adds to the scene with Ctrl+Enter only when it is possible', () => {
    const onAddToScene = vi.fn();
    const { rerender } = render(
      <GeneratorSidebar
        {...baseProps}
        activeGenerator="dungeon"
        onAddToScene={onAddToScene}
      />,
    );
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(onAddToScene).toHaveBeenCalledTimes(1);

    rerender(
      <GeneratorSidebar
        {...baseProps}
        activeGenerator="dungeon"
        onAddToScene={onAddToScene}
        hasValidArtifact={false}
      />,
    );
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(onAddToScene).toHaveBeenCalledTimes(1);
  });

  it('shows the cached map preview and an apply error in the footer', () => {
    renderSidebar('dungeon', {
      previewUrl: 'data:image/webp;base64,AAAA',
      errorMessage: 'Failed to import map: nope',
    });
    expect(
      screen.getByAltText('Preview of the map that will be added'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to import map');
  });

  it('opens the shortcut reference on demand with registry keys', () => {
    renderSidebar('cave');
    expect(screen.queryByText('Toggle tunnels')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Keyboard Shortcuts/ }));
    expect(screen.getByText('Toggle tunnels')).toBeInTheDocument();
  });
});

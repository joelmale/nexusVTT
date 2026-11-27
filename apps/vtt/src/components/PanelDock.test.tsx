import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGameStore } from '@/stores/gameStore';
import { useLayoutWorkspaceStore } from '@/stores/layoutWorkspaceStore';
import { useUIStackStore } from '@/stores/uiStackStore';
import type { PanelDockLayout } from '@/types/game';

import { PanelDock } from './PanelDock';

const panels = [
  { id: 'initiative', icon: '⏱', label: 'Initiative' },
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'dice', icon: '🎲', label: 'Dice' },
  { id: 'characters', icon: '👥', label: 'Characters' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

const settings = useGameStore.getState().settings;
const workspaceState = useLayoutWorkspaceStore.getState();
const stackState = useUIStackStore.getState();

function renderDock(layout?: PanelDockLayout, activePanels = ['chat', 'dice']) {
  useGameStore.setState({ settings: { ...settings, panelDockLayout: layout } });
  useUIStackStore.setState({ panelStack: activePanels, activePanels });
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <PanelDock
      panels={panels}
      activePanels={activePanels}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
  return { onSelect, onClose };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  useGameStore.setState({ settings });
  useLayoutWorkspaceStore.setState(workspaceState);
  useUIStackStore.setState(stackState);
});

describe('PanelDock', () => {
  it('defaults to three visible favorites with an All panels launcher', () => {
    const { onSelect } = renderDock();
    const favorites = within(
      screen.getByRole('group', { name: 'Favorite panels' }),
    );
    expect(favorites.getAllByRole('button')).toHaveLength(3);
    expect(favorites.getByRole('button', { name: 'Chat' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(favorites.getByRole('button', { name: 'Dice' })).toHaveAttribute(
      'data-topmost',
      'true',
    );
    fireEvent.click(favorites.getByRole('button', { name: 'Initiative' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('initiative');
    expect(
      screen.getByRole('button', { name: 'All panels' }),
    ).toBeInTheDocument();
  });

  it('prioritizes available panels from the applied workspace', () => {
    const workspace = workspaceState.saveWorkspace('Exploration');
    useLayoutWorkspaceStore.setState({
      workspaces: [{ ...workspace, activePanels: ['characters', 'scene'] }],
      lastAppliedId: workspace.id,
    });
    renderDock('favorites');
    const favorites = within(
      screen.getByRole('group', { name: 'Favorite panels' }),
    );
    expect(
      favorites.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Characters', 'Initiative', 'Chat']);
  });

  it('puts open panels first in the switcher and searches case-insensitively', () => {
    const { onSelect } = renderDock('switcher');
    const picker = within(
      screen.getByRole('group', { name: 'Panel Switcher', hidden: true }),
    );
    expect(
      picker.getAllByRole('button', { hidden: true })[0],
    ).toHaveTextContent('Chat');
    const search = picker.getByLabelText('Find a panel');
    fireEvent.change(search, { target: { value: ' unknown ' } });
    expect(picker.getByText('No matching panels')).toBeInTheDocument();
    fireEvent.submit(search.closest('form')!);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.change(search, { target: { value: '  CHAR  ' } });
    expect(picker.getAllByRole('button', { hidden: true })).toHaveLength(1);
    fireEvent.submit(search.closest('form')!);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('characters');
    expect(search).toHaveValue('');
  });

  it('focuses a rail window and closes it only with its close button', () => {
    const { onSelect, onClose } = renderDock('rail');
    const windows = within(screen.getByRole('group', { name: 'Open windows' }));
    expect(windows.getByRole('button', { name: 'Dice' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.click(windows.getByRole('button', { name: 'Chat' }));
    expect(windows.getByRole('button', { name: 'Chat' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(windows.getByRole('button', { name: 'Close Chat' }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith('chat');
    expect(windows.getByRole('button', { name: 'Dice' })).toHaveFocus();
  });

  it('offers the panel launcher when no windows are open', () => {
    renderDock('rail', []);
    expect(screen.getByText('No open panels')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add panel' }),
    ).toBeInTheDocument();
  });
});

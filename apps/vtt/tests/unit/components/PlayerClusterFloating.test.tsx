import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PlayerClusterFloating } from '@/components/PlayerClusterFloating';
import { useGameStore } from '@/stores/gameStore';

// Mock child components that have external dependencies
vi.mock('@/components/ConnectionStatus', () => ({
  default: () => <div data-testid="connection-status">🟢</div>,
}));

describe('PlayerClusterFloating', () => {
  const mockLeaveRoom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useGameStore.setState({
      user: {
        id: 'user-1',
        name: 'Test DM',
        type: 'host',
        connected: true,
      },
      session: {
        roomCode: 'TEST',
        hostId: 'user-1',
        players: [
          { id: 'user-1', name: 'Test DM', type: 'host' },
          { id: 'user-2', name: 'Player Two', type: 'player' },
        ],
        status: 'connected',
        dmConnected: true,
      },
    });
  });

  it('renders all player cluster controls when expanded', () => {
    const { container } = render(<PlayerClusterFloating leaveRoom={mockLeaveRoom} />);

    const cluster = container.querySelector('.player-cluster-floating');
    expect(cluster).toBeInTheDocument();
    expect(cluster?.getAttribute('data-collapsed')).toBeNull();

    // Drag handle
    expect(screen.getByTitle('Drag Player Cluster')).toBeInTheDocument();

    // Player indicators
    expect(screen.getByText('Test DM')).toBeInTheDocument();
    expect(screen.getByText('Player Two')).toBeInTheDocument();

    // Actions & Status
    expect(screen.getByTitle('Save and download a campaign backup')).toBeInTheDocument();
    expect(screen.getByTitle('Load a campaign backup')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();

    // Layout controls
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByTitle('Save UI Layout')).toBeInTheDocument();
    expect(screen.getByTitle('Reset UI Layout')).toBeInTheDocument();

    // Leave & minimize buttons
    expect(screen.getByTitle('Leave Room')).toBeInTheDocument();
    expect(screen.getByTitle('Minimize Cluster')).toBeInTheDocument();
  });

  it('toggles collapsed state when clicking minimize button and drag handle', () => {
    const { container } = render(<PlayerClusterFloating leaveRoom={mockLeaveRoom} />);

    const cluster = container.querySelector('.player-cluster-floating');
    expect(cluster?.getAttribute('data-collapsed')).toBeNull();

    // Click minimize
    const minimizeBtn = screen.getByTitle('Minimize Cluster');
    fireEvent.click(minimizeBtn);

    expect(cluster?.getAttribute('data-collapsed')).toBe('true');
    expect(screen.queryByText('Test DM')).not.toBeInTheDocument();
    expect(screen.getByTitle('Expand Player Cluster')).toBeInTheDocument();

    // Click drag handle to expand
    const expandHandle = screen.getByTitle('Expand Player Cluster');
    fireEvent.click(expandHandle);

    expect(cluster?.getAttribute('data-collapsed')).toBeNull();
    expect(screen.getByText('Test DM')).toBeInTheDocument();
  });

  it('calls leaveRoom callback when exit button is clicked', () => {
    render(<PlayerClusterFloating leaveRoom={mockLeaveRoom} />);

    const leaveBtn = screen.getByTitle('Leave Room');
    fireEvent.click(leaveBtn);

    expect(mockLeaveRoom).toHaveBeenCalledTimes(1);
  });
});

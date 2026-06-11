import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionStatus from '../../../src/components/ConnectionStatus';
import { webSocketService } from '../../../src/services/websocket';

// Mock the webSocketService
vi.mock('../../../src/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn(),
    getConnectionQuality: vi.fn(),
    connect: vi.fn(),
  },
}));

const mockWebSocketService = vi.mocked(webSocketService);

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock values
    mockWebSocketService.isConnected.mockReturnValue(true);
    mockWebSocketService.getConnectionQuality.mockReturnValue({
      latency: 50,
      packetLoss: 0,
      quality: 'excellent',
      lastUpdate: Date.now(),
      consecutiveMisses: 0,
    });
  });

  it('should render connection status icon for excellent quality', () => {
    render(<ConnectionStatus />);

    const statusIcon = screen.getByTitle(/excellent/i);
    expect(statusIcon).toBeDefined();
    expect(statusIcon.textContent).toBe('🟢');
  });

  it('should show detailed connection information when showDetails is true', () => {
    render(<ConnectionStatus showDetails={true} />);

    expect(screen.getByText('Excellent')).toBeDefined();
    expect(screen.getByText('50ms latency')).toBeDefined();
  });

  it('should not show details when showDetails is false', () => {
    render(<ConnectionStatus showDetails={false} />);

    expect(screen.queryByText('Excellent')).toBeNull();
    expect(screen.queryByText('50ms latency')).toBeNull();
  });

  it('should show reconnect button for poor connection quality', () => {
    mockWebSocketService.getConnectionQuality.mockReturnValue({
      latency: 2500,
      packetLoss: 0,
      quality: 'poor',
      lastUpdate: Date.now(),
      consecutiveMisses: 1,
    });

    render(<ConnectionStatus showDetails={true} />);

    expect(screen.getByText('Poor')).toBeDefined();
    const reconnectButton = screen.getByText('Reconnect');
    expect(reconnectButton).toBeDefined();
  });

  it('should show reconnect button for critical connection quality', () => {
    mockWebSocketService.getConnectionQuality.mockReturnValue({
      latency: 5000,
      packetLoss: 0,
      quality: 'critical',
      lastUpdate: Date.now(),
      consecutiveMisses: 3,
    });

    render(<ConnectionStatus showDetails={true} />);

    expect(screen.getByText('Critical')).toBeDefined();
    const reconnectButton = screen.getByText('Reconnect');
    expect(reconnectButton).toBeDefined();
  });

  it('should show disconnected state when not connected', () => {
    mockWebSocketService.isConnected.mockReturnValue(false);

    render(<ConnectionStatus showDetails={true} />);

    const statusIcon = screen.getByTitle(/disconnected/i);
    expect(statusIcon).toBeDefined();
    expect(statusIcon.textContent).toBe('🔴');
  });

  it('should show packet loss information when present', () => {
    mockWebSocketService.getConnectionQuality.mockReturnValue({
      latency: 100,
      packetLoss: 2,
      quality: 'good',
      lastUpdate: Date.now(),
      consecutiveMisses: 0,
    });

    render(<ConnectionStatus showDetails={true} />);

    expect(screen.getByText('2 packet loss')).toBeDefined();
  });

  it('should handle different quality levels', () => {
    const qualities = ['excellent', 'good', 'poor', 'critical'] as const;
    const icons = ['🟢', '🟡', '🟠', '🔴'];

    qualities.forEach((quality, index) => {
      mockWebSocketService.getConnectionQuality.mockReturnValue({
        latency: 50,
        packetLoss: 0,
        quality,
        lastUpdate: Date.now(),
        consecutiveMisses: 0,
      });

      const { rerender } = render(<ConnectionStatus />);

      const statusIcon = screen.getByTitle(new RegExp(quality, 'i'));
      expect(statusIcon.textContent).toBe(icons[index]);

      rerender(<ConnectionStatus key={quality} />);
    });
  });
});

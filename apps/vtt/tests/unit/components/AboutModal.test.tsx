import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { AboutModal, AboutTriggerButton } from '@/components/AboutModal';
import type { SystemInfoResponse } from '@/types/systemInfo';

const mockSystemInfo: SystemInfoResponse = {
  status: 'ok',
  timestamp: 1726650000000,
  runtime: {
    nodeVersion: 'v26.5.0',
    platform: 'linux',
    arch: 'x64',
    osRelease: '6.8.0-generic',
    uptimeSeconds: 125,
    formattedUptime: '2m 5s',
  },
  memory: {
    rssMb: 198.4,
    heapUsedMb: 85.1,
    heapTotalMb: 120.0,
    heapUtilizationRatio: 0.71,
  },
  database: {
    engine: 'PostgreSQL',
    version: 'PostgreSQL 16.3',
    status: 'connected',
    activeConnections: 4,
    idleConnections: 6,
    waitingRequests: 0,
    totalConnections: 10,
    latestMigration: '2026-07-19-room-entity-versions',
  },
  realtime: {
    enabled: true,
    connected: true,
    roomsCount: 2,
    connectionsCount: 8,
  },
  deployment: {
    version: '0.1.0',
    buildCommit: 'abc1234',
    gitBranch: 'main',
    environment: 'production',
    isDocker: true,
    dockerImage: 'fnsys/nexus-vtt:latest',
    edition: 'Community (Self-Hosted)',
    license: 'MIT',
    tagline: 'Virtual tabletop for adventurers',
    links: {
      github: 'https://github.com/joelmale/nexusVTT',
      docs: 'https://github.com/joelmale/nexusVTT/tree/main/apps/docs',
      issues: 'https://github.com/joelmale/nexusVTT/issues',
      discord: 'https://discord.gg/nexusvtt',
    },
  },
};

describe('AboutTriggerButton', () => {
  it('renders correctly and handles clicks', () => {
    const handleClick = vi.fn();
    render(<AboutTriggerButton onClick={handleClick} />);

    const button = screen.getByRole('button', {
      name: /About Nexus VTT and System Information/i,
    });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe('AboutModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSystemInfo,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AboutModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog when isOpen is true', async () => {
    render(<AboutModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: /Nexus VTT/i })).toBeInTheDocument();
    expect(screen.getByText('Nexus VTT')).toBeInTheDocument();
    expect(screen.getByText(/System Information/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/PostgreSQL 16\.3/i)).toBeInTheDocument();
      expect(screen.getByText(/198\.4 MB RSS/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<AboutModal isOpen={true} onClose={handleClose} />);

    const closeButton = screen.getByTestId('about-modal-close-button');
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<AboutModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    const handleClose = vi.fn();
    render(<AboutModal isOpen={true} onClose={handleClose} />);

    const backdrop = screen.getByTestId('about-modal-backdrop');
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', () => {
    const handleClose = vi.fn();
    render(<AboutModal isOpen={true} onClose={handleClose} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('increments uptime dynamically over time', async () => {
    render(<AboutModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/2m 5s/i)).toBeInTheDocument();
    });

    // Advance timer by 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.getByText(/2m 10s/i)).toBeInTheDocument();
    });
  });

  it('switches between Release notes and Dependencies tabs', async () => {
    render(<AboutModal isOpen={true} onClose={vi.fn()} />);

    // Default tab is Release notes
    expect(screen.getByRole('tab', { name: /Release notes/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const releasePanel = screen.getByRole('tabpanel', { name: /Release notes/i });
    expect(releasePanel).toBeInTheDocument();
    expect(within(releasePanel).getByText('v0.1.0')).toBeInTheDocument();

    // Click Dependencies tab
    const depTab = screen.getByRole('tab', { name: /Dependencies & Stack/i });
    fireEvent.click(depTab);

    expect(depTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: /Dependencies & Stack/i })).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('express')).toBeInTheDocument();
  });

  it('toggles release accordion section on click and keyboard press', async () => {
    render(<AboutModal isOpen={true} onClose={vi.fn()} />);

    // v0.1.0 is initially expanded
    const v010Header = screen.getByRole('button', { name: /v0\.1\.0/i });
    expect(v010Header).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(v010Header);
    expect(v010Header).toHaveAttribute('aria-expanded', 'false');

    // Keyboard Enter to expand
    fireEvent.keyDown(v010Header, { key: 'Enter' });
    expect(v010Header).toHaveAttribute('aria-expanded', 'true');
  });

  it('handles fetch failure gracefully by rendering fallback data', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    render(<AboutModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/PostgreSQL 16\.3/i)).toBeInTheDocument();
      expect(screen.getByText(/142\.5 MB RSS/i)).toBeInTheDocument();
    });

    consoleWarnSpy.mockRestore();
  });
});

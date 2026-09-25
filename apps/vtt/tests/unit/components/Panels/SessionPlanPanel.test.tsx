import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { SessionPlanPanel } from '../../../../src/components/Panels/SessionPlanPanel';
import { campaignPrepClient } from '../../../../src/services/campaignPrepClient';
import { commandClient } from '../../../../src/services/commandClient';
import { panelRegistry, type ObjectLink } from '../../../../src/services/panelRegistry';
import { useGameStore } from '../../../../src/stores/gameStore';

vi.mock('../../../../src/services/campaignPrepClient', () => ({
  campaignPrepClient: {
    getActiveSessionPlan: vi.fn(),
    updateActivationProgress: vi.fn(),
    activateSessionPlan: vi.fn(),
  },
}));

vi.mock('../../../../src/services/commandClient', () => ({
  commandClient: {
    deployEncounter: vi.fn(),
    startEncounter: vi.fn(),
  },
}));

vi.mock('../../../../src/services/panelRegistry', () => ({
  panelRegistry: {
    open: vi.fn(),
    close: vi.fn(),
    register: vi.fn(),
    getLink: vi.fn(),
    getDefinition: vi.fn(),
  },
}));

const mockPlan = {
  id: 'plan-123',
  campaignId: 'camp-123',
  schemaVersion: 1,
  revision: 3,
  title: 'Session 12 - The Glass Harbor',
  status: 'ready' as const,
  steps: [
    {
      id: 'step-1',
      title: 'Recap & Harbor Welcome',
      estimatedMinutes: 10,
      visibility: 'players' as const,
      type: 'reminder' as const,
      text: 'Recap the previous night events and introduce Captain Serin.',
    },
    {
      id: 'step-2',
      title: 'Glass Harbor Docks Scene',
      estimatedMinutes: 20,
      visibility: 'players' as const,
      type: 'activate-scene' as const,
      sceneTemplateRef: {
        target: 'campaign-object' as const,
        campaignId: 'camp-123',
        id: 'scene-docks-1',
        revision: 1,
      },
    },
    {
      id: 'step-3',
      title: 'Smuggler Ambush',
      estimatedMinutes: 30,
      visibility: 'dm-only' as const,
      type: 'deploy-encounter' as const,
      encounterRef: {
        kind: 'encounter' as const,
        source: 'campaign' as const,
        id: 'enc-smugglers-1',
        revision: 1,
      },
    },
    {
      id: 'step-4',
      title: 'Harbor Map Handout',
      estimatedMinutes: 5,
      visibility: 'players' as const,
      type: 'share-handout' as const,
      assetRef: {
        target: 'asset' as const,
        assetId: 'asset-map-1',
      },
    },
    {
      id: 'step-5',
      title: 'Captain Serin Profile',
      estimatedMinutes: 10,
      visibility: 'dm-only' as const,
      type: 'open-entry' as const,
      entryRef: {
        target: 'campaign-object' as const,
        campaignId: 'camp-123',
        id: 'entry-serin-1',
        revision: 1,
      },
    },
  ],
  dependencies: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockActivation = {
  id: 'act-123',
  campaignId: 'camp-123',
  sessionPlanId: 'plan-123',
  planRevision: 3,
  sessionId: 'room-abc',
  currentStepIndex: 0,
  stepStates: {},
  status: 'active' as const,
  activatedAt: new Date().toISOString(),
  completedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('SessionPlanPanel', () => {
  const mockLink: ObjectLink = {
    kind: 'session-plan',
    id: 'active',
    campaignId: 'camp-123',
    title: 'Session Run Sheet',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState({
      syncGameStateToServer: vi.fn(),
      user: {
        id: 'dm-user-1',
        name: 'Game Master',
        type: 'host',
        color: '#ff0000',
        connected: true,
      },
      session: {
        roomCode: 'room-abc',
        hostId: 'dm-user-1',
        campaignId: 'camp-123',
        players: [],
        status: 'connected',
      },
      sceneState: {
        activeSceneId: 'scene-docks-1',
        scenes: [
          {
            id: 'scene-docks-1',
            name: 'Glass Harbor Docks',
            background: '',
            grid: { size: 50, color: '#fff', visible: true, type: 'square' },
            lighting: { ambientColor: '#000', ambientIntensity: 1, enabled: false },
            fog: { enabled: false, shapes: [] },
            placedTokens: [],
            placedProps: [],
            drawings: [],
            visibility: 'everyone',
            createdAt: 0,
            updatedAt: 0,
            roomCode: 'room-abc',
          },
        ],
      },
    });
  });

  it('renders DM Access Only message if the user is not a host', async () => {
    useGameStore.setState({
      user: {
        id: 'player-1',
        name: 'Player One',
        type: 'player',
        color: '#00ff00',
        connected: true,
      },
      session: {
        roomCode: 'room-abc',
        hostId: 'other-host',
        campaignId: 'camp-123',
        players: [],
        status: 'connected',
      },
    });

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    expect(screen.getByText('DM Access Only')).toBeInTheDocument();
  });

  it('renders empty state when no active session plan exists', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce(null);

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No Active Session Plan')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /check for activated plan/i })).toBeInTheDocument();
  });

  it('renders active plan with steps and progress summary', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: mockActivation,
      plan: mockPlan,
    });

    render(<SessionPlanPanel isPopout={true} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Session 12 - The Glass Harbor')).toBeInTheDocument();
    });

    expect(screen.getByText('Rev 3')).toBeInTheDocument();
    expect(screen.getByText('Multi-Display')).toBeInTheDocument();
    expect(screen.getByText('~75 min estimated')).toBeInTheDocument();
    expect(screen.getByText('Recap & Harbor Welcome')).toBeInTheDocument();
    expect(screen.getByText('Glass Harbor Docks Scene')).toBeInTheDocument();
    expect(screen.getByText('Smuggler Ambush')).toBeInTheDocument();
  });

  it('handles activating a scene from a step', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: { ...mockActivation, currentStepIndex: 1 },
      plan: mockPlan,
    });

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Glass Harbor Docks Scene')).toBeInTheDocument();
    });

    const activateBtn = screen.getByRole('button', { name: /activate scene/i });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(screen.getByText(/switched to scene: glass harbor docks/i)).toBeInTheDocument();
    });
  });

  it('instantiates and activates scene with background map from template when not yet in room', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: { ...mockActivation, currentStepIndex: 1 },
      plan: mockPlan,
    });

    // Set initial default empty room state (Scene 1 with no background)
    useGameStore.setState({
      syncGameStateToServer: vi.fn(),
      sceneState: {
        activeSceneId: 'scene-1',
        scenes: [
          {
            id: 'scene-1',
            name: 'Scene 1',
            roomCode: 'room-abc',
            description: '',
            visibility: 'public',
            isEditable: true,
            createdBy: 'dm-user-1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            gridSettings: {
              enabled: true,
              type: 'square',
              size: 50,
              color: '#ffffff',
              opacity: 0.1,
              snapToGrid: true,
              showToPlayers: true,
            },
            lightingSettings: {
              enabled: false,
              globalIllumination: true,
              ambientLight: 0.5,
              darkness: 0,
            },
            drawings: [],
            placedTokens: [],
            placedProps: [],
            isActive: true,
            playerCount: 0,
          },
        ],
        camera: { x: 0, y: 0, zoom: 1 },
        activeTool: 'select',
        followDM: false,
      },
    });

    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/prep/objects/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              revision: {
                data: {
                  id: 'scene-docks-1',
                  name: 'Glass Harbor Docks',
                  backgroundAssetRef: {
                    target: 'asset',
                    assetId: 'glass-harbor-map',
                  },
                  grid: {
                    enabled: true,
                    type: 'square',
                    size: 100,
                    offsetX: 0,
                    offsetY: 0,
                    snapToGrid: true,
                  },
                  lighting: {
                    enabled: true,
                    globalIllumination: false,
                    ambientLight: 0.35,
                    darkness: 0.65,
                  },
                },
              },
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      } as Response);
    });
    globalThis.fetch = fetchSpy;

    try {
      render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Glass Harbor Docks Scene')).toBeInTheDocument();
      });

      const activateBtn = screen.getByRole('button', { name: /activate scene/i });
      fireEvent.click(activateBtn);

      await waitFor(() => {
        expect(screen.getByText(/activated scene: glass harbor docks/i)).toBeInTheDocument();
      });

      const updatedScene = useGameStore.getState().sceneState.scenes[0];
      expect(updatedScene.name).toBe('Glass Harbor Docks');
      expect(updatedScene.backgroundImage?.url).toBe('/demo/ashes-of-veyra/glass-harbor-map.png');
      expect(updatedScene.gridSettings.size).toBe(100);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles deploying and starting an encounter', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: { ...mockActivation, currentStepIndex: 2 },
      plan: mockPlan,
    });

    vi.mocked(commandClient.deployEncounter).mockResolvedValueOnce({
      success: true,
      receipt: {
        campaignId: 'camp-123',
        commandId: 'cmd-1',
        principalId: 'dm-user-1',
        payloadHash: 'hash',
        committedAt: new Date().toISOString(),
        result: {
          success: true,
          committedVersions: {},
          data: { encounterRunId: 'run-ambush-99' },
        },
      },
    });

    vi.mocked(commandClient.startEncounter).mockResolvedValueOnce({
      success: true,
    });

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Smuggler Ambush')).toBeInTheDocument();
    });

    const deployBtn = screen.getByRole('button', { name: /deploy encounter/i });
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(commandClient.deployEncounter).toHaveBeenCalledWith(
        'camp-123',
        mockPlan.steps[2].encounterRef,
        'scene-docks-1',
        { x: 0, y: 0 },
        false,
      );
      expect(screen.getByText(/encounter deployed on active scene/i)).toBeInTheDocument();
    });

    const startCombatBtn = screen.getByRole('button', { name: /start combat/i });
    fireEvent.click(startCombatBtn);

    await waitFor(() => {
      expect(commandClient.startEncounter).toHaveBeenCalledWith('camp-123', 'run-ambush-99');
      expect(panelRegistry.open).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'encounter',
          id: 'run-ambush-99',
        }),
      );
    });
  });

  it('advances to next beat and updates activation progress', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: mockActivation,
      plan: mockPlan,
    });

    vi.mocked(campaignPrepClient.updateActivationProgress).mockResolvedValueOnce({
      ...mockActivation,
      currentStepIndex: 1,
      stepStates: {
        'step-1': { completed: true, completedAt: new Date().toISOString() },
      },
    });

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Recap & Harbor Welcome')).toBeInTheDocument();
    });

    const advanceBtn = screen.getByRole('button', { name: /complete & next beat/i });
    fireEvent.click(advanceBtn);

    await waitFor(() => {
      expect(campaignPrepClient.updateActivationProgress).toHaveBeenCalledWith(
        'camp-123',
        'act-123',
        expect.objectContaining({
          currentStepIndex: 1,
        }),
      );
    });
  });

  it('shares handout and opens entry', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: { ...mockActivation, currentStepIndex: 3 },
      plan: mockPlan,
    });

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Harbor Map Handout')).toBeInTheDocument();
    });

    const shareBtn = screen.getByRole('button', { name: /reveal handout/i });
    fireEvent.click(shareBtn);

    expect(screen.getByText(/handout revealed to players/i)).toBeInTheDocument();

    // Expand step 5
    fireEvent.click(screen.getByText('Captain Serin Profile'));
    const viewEntryBtn = screen.getByRole('button', { name: /view campaign entry/i });
    fireEvent.click(viewEntryBtn);
    expect(screen.getByText(/opening entry: entry-se/i)).toBeInTheDocument();
  });

  it('renders error state and handles retry button', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan)
      .mockRejectedValueOnce(new Error('Network disconnected'))
      .mockResolvedValueOnce({
        activation: mockActivation,
        plan: mockPlan,
      });

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Plan')).toBeInTheDocument();
      expect(screen.getByText('Network disconnected')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Session 12 - The Glass Harbor')).toBeInTheDocument();
    });
  });

  it('handles encounter deployment error gracefully', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: { ...mockActivation, currentStepIndex: 2 },
      plan: mockPlan,
    });

    vi.mocked(commandClient.deployEncounter).mockRejectedValueOnce(
      new Error('Encounter template missing'),
    );

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Smuggler Ambush')).toBeInTheDocument();
    });

    const deployBtn = screen.getByRole('button', { name: /deploy encounter/i });
    fireEvent.click(deployBtn);

    await waitFor(() => {
      expect(screen.getByText(/encounter template missing/i)).toBeInTheDocument();
    });
  });

  it('handles combat start error gracefully', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValueOnce({
      activation: { ...mockActivation, currentStepIndex: 2 },
      plan: mockPlan,
    });

    vi.mocked(commandClient.startEncounter).mockRejectedValueOnce(
      new Error('Combat start failed'),
    );

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Smuggler Ambush')).toBeInTheDocument();
    });

    const startCombatBtn = screen.getByRole('button', { name: /start combat/i });
    fireEvent.click(startCombatBtn);

    await waitFor(() => {
      expect(screen.getByText(/combat start failed/i)).toBeInTheDocument();
    });
  });

  it('jumps to another step when Set Active is clicked and handles refresh', async () => {
    vi.mocked(campaignPrepClient.getActiveSessionPlan).mockResolvedValue({
      activation: mockActivation,
      plan: mockPlan,
    });

    vi.mocked(campaignPrepClient.updateActivationProgress).mockResolvedValueOnce({
      ...mockActivation,
      currentStepIndex: 4,
    });

    render(<SessionPlanPanel isPopout={false} link={mockLink} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Session 12 - The Glass Harbor')).toBeInTheDocument();
    });

    // Expand step 5
    fireEvent.click(screen.getByText('Captain Serin Profile'));
    const setActiveBtn = screen.getByRole('button', { name: /set active/i });
    fireEvent.click(setActiveBtn);

    await waitFor(() => {
      expect(campaignPrepClient.updateActivationProgress).toHaveBeenCalledWith(
        'camp-123',
        'act-123',
        { currentStepIndex: 4 },
      );
    });

    // Click refresh button in header
    const refreshBtn = screen.getByRole('button', { name: /refresh run sheet/i });
    fireEvent.click(refreshBtn);
    expect(campaignPrepClient.getActiveSessionPlan).toHaveBeenCalledTimes(2);
  });
});

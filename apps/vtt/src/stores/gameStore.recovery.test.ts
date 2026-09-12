import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  PersistedSession,
  SessionRecoveryData,
} from '@/services/sessionPersistence';

// Mock the persistence and network layers so attemptSessionRecovery can be
// driven through its dead-room / no-session / success paths deterministically.
vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    saveScene: vi.fn().mockResolvedValue(undefined),
    loadAllScenes: vi.fn().mockResolvedValue([]),
    loadDrawings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/sessionPersistence', () => ({
  sessionPersistenceService: {
    saveSession: vi.fn(),
    saveGameState: vi.fn().mockResolvedValue(undefined),
    getRecoveryData: vi.fn(),
    clearAll: vi.fn(),
  },
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn().mockReturnValue(false),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    waitForSessionConfirmed: vi.fn().mockResolvedValue(undefined),
    sendGameStateUpdate: vi.fn(),
  },
}));

vi.mock('@/utils/notifications', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
    loading: vi.fn(),
  },
}));

// Import after the mocks so the store wires up against them.
import { useGameStore } from './gameStore';
import { sessionPersistenceService } from '@/services/sessionPersistence';
import { webSocketService } from '@/services/websocket';
import { toast } from '@/utils/notifications';

const makePersistedSession = (): PersistedSession => ({
  roomCode: 'ZZZZ',
  userId: 'user-1',
  userType: 'host',
  userName: 'TestDM',
  lastActivity: Date.now(),
  sessionVersion: 1,
});

const makeRecoveryData = (
  overrides: Partial<SessionRecoveryData> = {},
): SessionRecoveryData => ({
  session: makePersistedSession(),
  gameState: null,
  isValid: true,
  canReconnect: true,
  ...overrides,
});

describe('gameStore attemptSessionRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(webSocketService.connect).mockResolvedValue(undefined);
    vi.mocked(webSocketService.waitForSessionConfirmed).mockResolvedValue(
      undefined,
    );
    useGameStore.setState({
      session: null,
      isRecovering: false,
      isAuthenticated: false,
    });
  });

  it('returns true when the server confirms the session', async () => {
    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValue(
      makeRecoveryData(),
    );

    const result = await useGameStore.getState().attemptSessionRecovery();

    expect(result).toBe(true);
    expect(webSocketService.connect).toHaveBeenCalledWith(
      'ZZZZ',
      'host',
      undefined,
      'user-1',
      'TestDM',
    );
    expect(useGameStore.getState().isRecovering).toBe(false);
  });

  it('clears all recovery state when the room no longer exists on the server (dead-room cookie)', async () => {
    // Simulate the stuck-loop repro: recovery data points at a room the
    // server has dropped, and the reconnect context is still in localStorage.
    localStorage.setItem(
      'nexus-connection-context',
      JSON.stringify({ roomCode: 'ZZZZ', userType: 'host' }),
    );
    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValue(
      makeRecoveryData(),
    );
    vi.mocked(webSocketService.waitForSessionConfirmed).mockRejectedValue(
      new Error('Session confirmation timeout'),
    );

    const result = await useGameStore.getState().attemptSessionRecovery();

    expect(result).toBe(false);
    expect(webSocketService.disconnect).toHaveBeenCalled();
    // resetSessionForExpiredRoom must wipe every recovery layer so the
    // cookie/localStorage loop cannot re-create itself.
    expect(sessionPersistenceService.clearAll).toHaveBeenCalled();
    expect(localStorage.getItem('nexus-connection-context')).toBeNull();
    expect(localStorage.getItem('nexus-active-session')).toBeNull();
    expect(useGameStore.getState().session).toBeNull();
    expect(useGameStore.getState().isRecovering).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Session Expired', {
      description: 'Your previous session has ended.',
    });
  });

  it('does not duplicate the toast when the server explicitly rejected the room', async () => {
    // A 'Room not found' server error already raises a toast in the websocket
    // handler, so the recovery path must stay silent for non-timeout errors.
    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValue(
      makeRecoveryData(),
    );
    vi.mocked(webSocketService.waitForSessionConfirmed).mockRejectedValue(
      new Error('Room not found'),
    );

    const result = await useGameStore.getState().attemptSessionRecovery();

    expect(result).toBe(false);
    expect(webSocketService.disconnect).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('clears isRecovering when no valid session exists (regression: flag used to stick and hang ProtectedRoute)', async () => {
    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValue(
      makeRecoveryData({ session: null, isValid: false, canReconnect: false }),
    );

    const result = await useGameStore.getState().attemptSessionRecovery();

    expect(result).toBe(false);
    expect(useGameStore.getState().isRecovering).toBe(false);
  });

  it('clears isRecovering when the stored session is too old to reconnect', async () => {
    vi.mocked(sessionPersistenceService.getRecoveryData).mockResolvedValue(
      makeRecoveryData({ canReconnect: false }),
    );

    const result = await useGameStore.getState().attemptSessionRecovery();

    expect(result).toBe(false);
    expect(sessionPersistenceService.clearAll).toHaveBeenCalled();
    expect(useGameStore.getState().isRecovering).toBe(false);
  });
});

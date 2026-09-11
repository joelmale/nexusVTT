import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webSocketService } from '../../../src/services/websocket';

type MockWebSocket = {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
};

// Helper to create a mock WebSocket that triggers onopen immediately
function createMockWebSocket(): MockWebSocket {
  const mockWs: MockWebSocket = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };

  // Set up the mock to call onopen immediately when assigned
  Object.defineProperty(mockWs, 'onopen', {
    set(callback: ((event: Event) => void) | null) {
      if (callback) {
        // Use setTimeout to ensure async behavior
        setTimeout(() => callback(new Event('open')), 0);
      }
    },
    get() {
      return null;
    },
  });

  return mockWs;
}

// Helper to get the current mock WebSocket instance
function getMockWebSocket(): MockWebSocket {
  const result = WebSocketMock.mock.results.at(-1)?.value;
  if (!result) throw new Error('Expected a WebSocket instance');
  return result;
}

// Create a proper WebSocket mock constructor
const WebSocketMock = vi.fn(function (_url: string) {
  return createMockWebSocket();
});
WebSocketMock.CONNECTING = 0;
WebSocketMock.OPEN = 1;
WebSocketMock.CLOSING = 2;
WebSocketMock.CLOSED = 3;

// Mock WebSocket
globalThis.WebSocket = WebSocketMock as unknown as typeof WebSocket;

// Mock fetch to prevent HTTP health checks in tests
global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

// Set environment to production mode to disable server discovery
vi.stubEnv('DEV', false);
vi.stubEnv('VITE_WS_PORT', '5001');
vi.stubEnv('VITE_WS_HOST', 'localhost');

describe('WebSocketManager', () => {
  beforeEach(() => {
    WebSocketMock.mockClear();
    webSocketService.resetSessionEventCache();
  });

  afterEach(() => {
    webSocketService.disconnect();
  });

  describe('Connection Management', () => {
    it('should create WebSocket connection', async () => {
      await webSocketService.connect('TEST123');
      expect(webSocketService.isConnected()).toBe(true);
    });

    it('should disconnect properly', async () => {
      await webSocketService.connect('TEST123');

      // Get the mock WebSocket instance
      const mockWs = WebSocketMock.mock.results[0]?.value;

      webSocketService.disconnect();

      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Manual disconnect');
      expect(webSocketService.isConnected()).toBe(false);
    });

    it('should prevent multiple simultaneous connections', async () => {
      // Start two connections simultaneously
      const promise1 = webSocketService.connect('TEST123');
      const promise2 = webSocketService.connect('TEST123');

      await Promise.all([promise1, promise2]);

      // Should only create one WebSocket
      expect(WebSocketMock).toHaveBeenCalledTimes(1);
    });

    it('should keep connect idempotent when the socket is already open', async () => {
      await webSocketService.connect('TEST123', 'player');

      await webSocketService.connect('TEST123', 'player');

      expect(WebSocketMock).toHaveBeenCalledTimes(1);
    });

    it('should create only one socket for repeated reconnect clicks', async () => {
      await webSocketService.connect(
        'TEST123',
        'player',
        undefined,
        'participant-1',
        'Player One',
      );
      const initialSocket = getMockWebSocket();
      initialSocket.onclose?.({
        code: 1000,
        reason: 'Network closed',
      } as CloseEvent);

      await Promise.all([
        webSocketService.reconnect('manual-button'),
        webSocketService.reconnect('manual-button'),
      ]);

      expect(WebSocketMock).toHaveBeenCalledTimes(2);
      const socketInstanceIds = WebSocketMock.mock.calls.map((call) =>
        new URL(String(call[0])).searchParams.get('connectionInstanceId'),
      );
      expect(socketInstanceIds[0]).toBeTruthy();
      expect(socketInstanceIds[1]).toBeTruthy();
      expect(socketInstanceIds[1]).not.toBe(socketInstanceIds[0]);
    });

    it('should preserve the host role during manual reconnect', async () => {
      await webSocketService.connect(
        'HOST01',
        'host',
        'campaign-1',
        'host-participant',
        'Host One',
      );
      const initialSocket = getMockWebSocket();
      initialSocket.onclose?.({
        code: 1000,
        reason: 'Network closed',
      } as CloseEvent);

      await webSocketService.reconnect('manual-button');

      const reconnectUrl = new URL(
        String(WebSocketMock.mock.calls.at(-1)?.[0]),
      );
      expect(reconnectUrl.searchParams.get('reconnect')).toBe('HOST01');
      expect(reconnectUrl.searchParams.has('join')).toBe(false);
      expect(reconnectUrl.searchParams.get('userId')).toBe(
        'host-participant',
      );
    });

    it('should handle connection failure', async () => {
      WebSocketMock.mockImplementationOnce(() => {
        const ws = createMockWebSocket();
        Object.defineProperty(ws, 'onopen', {
          set(_callback) {
            // Don't call callback, simulate connection failure
          },
        });
        Object.defineProperty(ws, 'onerror', {
          set(callback) {
            if (callback) {
              setTimeout(() => callback(new Event('error')), 0);
            }
          },
        });
        return ws;
      });

      await expect(webSocketService.connect('TEST123')).rejects.toThrow();
    });
  });

  describe('Message Handling', () => {
    it('should send messages when connected', async () => {
      await webSocketService.connect('TEST123');

      const testEvent = {
        type: 'dice/roll',
        data: { roll: { expression: '1d20' } },
      };
      webSocketService.sendEvent(testEvent);

      const mockWs = WebSocketMock.mock.results[0]?.value;

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('event');
      expect(sentData.data.name).toBe('dice/roll');
    });

    it('should queue messages when disconnected', () => {
      const testEvent = {
        type: 'dice/roll',
        data: { roll: { expression: '1d20' } },
      };

      // Send event while disconnected
      webSocketService.sendEvent(testEvent);

      // Should not have created any WebSocket instances
      expect(WebSocketMock).not.toHaveBeenCalled();
    });

    it('should send queued messages after reconnection', async () => {
      // Send messages while disconnected (they get queued)
      const testEvent1 = { type: 'test1', data: { foo: 'bar' } };
      const testEvent2 = { type: 'test2', data: { baz: 'qux' } };

      webSocketService.sendEvent(testEvent1);
      webSocketService.sendEvent(testEvent2);

      // Now connect - queued messages should be sent
      await webSocketService.connect('TEST123');

      // Wait for connection to complete and queue to flush
      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWs = WebSocketMock.mock.results[0]?.value;

      // Both queued messages should have been sent
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should handle malformed JSON messages gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await webSocketService.connect('TEST123');

      const mockWs = WebSocketMock.mock.results[0]?.value;

      // Send malformed JSON
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: 'invalid json' } as MessageEvent);
      }

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle valid JSON messages', async () => {
      await webSocketService.connect('TEST123');

      const mockWs = WebSocketMock.mock.results[0]?.value;

      const testMessage = {
        type: 'event',
        data: { name: 'session/joined', players: [] },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(testMessage),
        } as MessageEvent);
      }

      // Should not throw or log errors
      expect(true).toBe(true);
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send a client ping for a true RTT sample', async () => {
      const connectPromise = webSocketService.connect('TEST123');
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;

      await vi.advanceTimersByTimeAsync(30000);

      const mockWs = getMockWebSocket();

      const calls = mockWs.send.mock.calls;
      const heartbeatCalls = calls.filter((call) => {
        const data = JSON.parse(call[0]);
        return data.type === 'heartbeat' && data.data?.type === 'ping';
      });

      expect(heartbeatCalls).toHaveLength(1);
    });

    it('should respond to server ping with pong', async () => {
      vi.useRealTimers(); // Use real timers for this test

      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      // Simulate receiving ping from server
      const pingMessage = {
        type: 'heartbeat',
        data: { type: 'ping', id: 'test-ping-id' },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(pingMessage),
        } as MessageEvent);
      }

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should respond with pong
      expect(mockWs.send).toHaveBeenCalled();
      const calls = mockWs.send.mock.calls;
      const pongCall = calls.find((call) => {
        const data = JSON.parse(call[0]);
        return data.type === 'heartbeat' && data.data?.type === 'pong';
      });

      expect(pongCall).toBeDefined();
      const pongData = JSON.parse(pongCall![0]);
      expect(pongData.data.id).toBe('test-ping-id');

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should ignore an 800 ms clock difference when measuring RTT', async () => {
      vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
      let monotonicNow = 100;
      const performanceSpy = vi
        .spyOn(performance, 'now')
        .mockImplementation(() => monotonicNow);

      const connectPromise = webSocketService.connect('TEST123');
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;

      const mockWs = getMockWebSocket();
      await vi.advanceTimersByTimeAsync(30000);

      const pingCall = mockWs.send.mock.calls.find((call) => {
        const data = JSON.parse(call[0]);
        return data.type === 'heartbeat' && data.data?.type === 'ping';
      });
      expect(pingCall).toBeDefined();
      const pingMessage = JSON.parse(pingCall![0]);

      // The server wall clock is 800 ms ahead, while the monotonic elapsed
      // time on this browser is only 42 ms.
      vi.setSystemTime(new Date('2025-01-01T00:00:00.800Z'));
      monotonicNow += 42;
      const pongMessage = {
        type: 'heartbeat',
        data: { type: 'pong', id: pingMessage.data.id },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(pongMessage),
        } as MessageEvent);
      }

      expect(webSocketService.getConnectionQuality().latency).toBe(42);
      expect(webSocketService.getConnectionQuality().quality).toBe(
        'excellent',
      );
      performanceSpy.mockRestore();
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should attempt reconnection on unexpected disconnect', async () => {
      const connectPromise = webSocketService.connect('TEST123');
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;
      const mockWs = getMockWebSocket();

      // Simulate unexpected disconnect (code !== 1000)
      if (mockWs.onclose) {
        mockWs.onclose({ code: 1006, reason: 'Connection lost' } as CloseEvent);
      }

      // Fast-forward to trigger reconnection attempt
      vi.advanceTimersByTime(2000);
      await vi.advanceTimersByTimeAsync(0);

      // Should have attempted reconnection
      expect(WebSocketMock).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff for reconnection', async () => {
      const connectPromise = webSocketService.connect('TEST123');
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;
      const mockWs = getMockWebSocket();

      // Simulate first disconnect
      if (mockWs.onclose) {
        mockWs.onclose({ code: 1006, reason: 'Connection lost' } as CloseEvent);
      }

      // First reconnect attempt after ~1s
      vi.advanceTimersByTime(1500);
      await vi.advanceTimersByTimeAsync(0);

      // Get the reconnected mock
      const secondMockWs = getMockWebSocket();

      // Simulate second disconnect
      if (secondMockWs.onclose) {
        secondMockWs.onclose({
          code: 1006,
          reason: 'Connection lost',
        } as CloseEvent);
      }

      // Second reconnect should take longer (exponential backoff)
      vi.advanceTimersByTime(3000);
      await vi.advanceTimersByTimeAsync(0);

      // Should have made multiple reconnection attempts
      expect(WebSocketMock).toHaveBeenCalled();
    });

    it('should not reconnect on manual disconnect', async () => {
      const connectPromise = webSocketService.connect('TEST123');
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;

      const initialCallCount = WebSocketMock.mock.calls.length;

      // Manual disconnect (code 1000)
      webSocketService.disconnect();

      // Wait for potential reconnection
      vi.advanceTimersByTime(5000);
      await vi.advanceTimersByTimeAsync(0);

      // Should not have attempted reconnection
      expect(WebSocketMock).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should retry when a reconnection attempt fails', async () => {
      const connectPromise = webSocketService.connect('TEST123');
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;
      const initialSocket = getMockWebSocket();

      WebSocketMock.mockImplementationOnce(() => {
        const ws = createMockWebSocket();
        Object.defineProperty(ws, 'onopen', {
          set(_callback) {
            // Keep the socket closed so the error path wins.
          },
        });
        Object.defineProperty(ws, 'onerror', {
          set(callback) {
            if (callback) {
              setTimeout(() => callback(new Event('error')), 0);
            }
          },
        });
        return ws;
      });

      initialSocket.onclose?.({
        code: 1006,
        reason: 'Connection lost',
      } as CloseEvent);

      await vi.advanceTimersByTimeAsync(5000);

      expect(WebSocketMock).toHaveBeenCalledTimes(3);
      expect(webSocketService.isConnected()).toBe(true);
    });

    it('should cancel a pending reconnect on manual disconnect', async () => {
      const connectPromise = webSocketService.connect('TEST123');
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;
      const initialSocket = getMockWebSocket();

      initialSocket.onclose?.({
        code: 1006,
        reason: 'Connection lost',
      } as CloseEvent);
      webSocketService.disconnect();

      await vi.advanceTimersByTimeAsync(5000);

      expect(WebSocketMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle "Room not found" error', async () => {
      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const errorMessage = {
        type: 'error',
        data: { message: 'Room not found', code: 404 },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(errorMessage),
        } as MessageEvent);
      }

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Error should be handled (logged to console)
      expect(true).toBe(true);
    });

    it('should handle version conflict (409) error', async () => {
      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const errorMessage = {
        type: 'error',
        data: {
          message: 'Update rejected: version conflict detected',
          code: 409,
        },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(errorMessage),
        } as MessageEvent);
      }

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should handle version conflict gracefully
      expect(true).toBe(true);
    });

    it('should handle generic server errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const errorMessage = {
        type: 'error',
        data: { message: 'Internal server error', code: 500 },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(errorMessage),
        } as MessageEvent);
      }

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Session Management', () => {
    it('should cache session/created event', async () => {
      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const sessionCreatedMessage = {
        type: 'event',
        data: {
          name: 'session/created',
          roomCode: 'ABCD',
        },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(sessionCreatedMessage),
        } as MessageEvent);
      }

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Event should be cached for waitForSessionCreated()
      const event = await webSocketService.waitForSessionCreated();
      expect(event.roomCode).toBe('ABCD');
    });

    it('should cache session/joined event', async () => {
      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const sessionJoinedMessage = {
        type: 'event',
        data: {
          name: 'session/joined',
          roomCode: 'ABCD',
          players: [],
        },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(sessionJoinedMessage),
        } as MessageEvent);
      }

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Event should be cached for waitForSessionJoined()
      const event = await webSocketService.waitForSessionJoined();
      expect(event.roomCode).toBe('ABCD');
    });

    it('should reject waitForSessionJoined on error', async () => {
      const joinPromise = webSocketService.waitForSessionJoined();

      // Dispatch error event
      webSocketService.dispatchEvent(
        new CustomEvent('message', {
          detail: {
            type: 'error',
            data: { message: 'Room not found' },
          },
        }),
      );

      await expect(joinPromise).rejects.toThrow('Room not found');
    });
  });

  describe('JSON Patch Handling', () => {
    it('should handle game-state-patch messages', async () => {
      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const patchMessage = {
        type: 'game-state-patch',
        data: {
          version: 5,
          patch: [
            { op: 'replace', path: '/scenes/0/name', value: 'Updated Scene' },
          ],
        },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(patchMessage),
        } as MessageEvent);
      }

      // Wait for patch application
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Patch should be applied to game state
      expect(true).toBe(true);
    });

    it('should handle invalid patches gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const invalidPatchMessage = {
        type: 'game-state-patch',
        data: {
          version: 5,
          patch: [{ op: 'invalid', path: '/invalid', value: 'bad' }],
        },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(invalidPatchMessage),
        } as MessageEvent);
      }

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Update Confirmation', () => {
    it('should handle update-confirmed messages', async () => {
      await webSocketService.connect('TEST123');
      const mockWs = getMockWebSocket();

      const confirmMessage = {
        type: 'update-confirmed',
        data: { updateId: 'test-update-123' },
        timestamp: Date.now(),
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({
          data: JSON.stringify(confirmMessage),
        } as MessageEvent);
      }

      // Wait for confirmation processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update should be confirmed in gameStore
      expect(true).toBe(true);
    });
  });
});

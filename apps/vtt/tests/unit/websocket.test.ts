import { describe, it, expect, beforeEach } from 'vitest';
import { webSocketService } from '@/services/websocket';

describe('webSocketService join handling', () => {
  beforeEach(() => {
    // Reset cached session events to ensure clean waits
    (webSocketService as unknown as { lastSessionJoinedEvent: unknown }).lastSessionJoinedEvent =
      null;
  });

  it('rejects waitForSessionJoined on server error message', async () => {
    const joinPromise = webSocketService.waitForSessionJoined();

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

  it('builds unified /ws URL with join code', () => {
    const url = (
      webSocketService as unknown as {
        getWebSocketUrl: (
          roomCode?: string,
          userType?: 'host' | 'player',
        ) => string;
      }
    ).getWebSocketUrl('TEST', 'player');
    expect(url).toContain('/ws');
    expect(url).toContain('join=TEST');
    // Should not include fallback port discovery artifacts
    expect(url).not.toContain('5002');
    expect(url).not.toContain('5003');
    expect(url).not.toContain('5004');
  });
});

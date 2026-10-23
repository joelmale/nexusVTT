import { useEffect, useRef, useState } from 'react';

export type SimpleConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface UseMobileSessionLifecycleOptions {
  /** Hold a screen wake lock while mounted (where supported). */
  wakeLock: boolean;
  /** Current socket connection, from the game store's connection state. */
  isConnected: boolean;
  /** True when the underlying socket is open right now. */
  isSocketOpen: () => boolean;
  /**
   * Re-establish the session. Wire this to the existing
   * `webSocketService.reconnect()`; it rejoins through the normal reconnect
   * path, which is version-neutral for an unchanged snapshot.
   */
  onResumeSession: () => Promise<void> | void;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

function getWakeLock(): WakeLockLike | null {
  const nav = navigator as Navigator & { wakeLock?: WakeLockLike };
  return nav.wakeLock ?? null;
}

function isOnline(): boolean {
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

/**
 * Keeps phone and tablet players connected. iOS Safari suspends a backgrounded
 * tab (for example while the player is in FaceTime) and the WebSocket dies, so
 * on return to the tab we resume the session silently instead of waiting for
 * the backoff timer. Also holds a screen wake lock so the map doesn't sleep.
 */
export function useMobileSessionLifecycle({
  wakeLock,
  isConnected,
  isSocketOpen,
  onResumeSession,
}: UseMobileSessionLifecycleOptions): {
  connectionState: SimpleConnectionState;
} {
  const [online, setOnline] = useState(isOnline);
  const resumeRef = useRef(onResumeSession);
  const socketOpenRef = useRef(isSocketOpen);
  useEffect(() => {
    resumeRef.current = onResumeSession;
    socketOpenRef.current = isSocketOpen;
  }, [onResumeSession, isSocketOpen]);

  useEffect(() => {
    let resuming = false;
    const resume = () => {
      if (resuming || socketOpenRef.current()) return;
      resuming = true;
      Promise.resolve()
        .then(() => resumeRef.current())
        .catch((error: unknown) => {
          console.warn('📡 Session resume failed:', error);
        })
        .finally(() => {
          resuming = false;
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resume();
    };
    const handleOnline = () => {
      setOnline(true);
      resume();
    };
    const handleOffline = () => setOnline(false);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', resume);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const lock = getWakeLock();
    if (!wakeLock || !lock) return undefined;

    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      lock
        .request('screen')
        .then((acquired) => {
          if (disposed) {
            void acquired.release().catch(() => undefined);
          } else {
            sentinel = acquired;
          }
        })
        .catch(() => undefined);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [wakeLock]);

  const connectionState: SimpleConnectionState = !online
    ? 'offline'
    : isConnected
      ? 'connected'
      : 'reconnecting';

  return { connectionState };
}

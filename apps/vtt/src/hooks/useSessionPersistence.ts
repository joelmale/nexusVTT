/**
 * Session Persistence Hook
 *
 * Provides automatic session state persistence and recovery capabilities.
 * Automatically saves session state on changes and attempts recovery on app startup.
 */

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import {
  sessionPersistenceService,
  type PersistedSession,
  type PersistedGameState,
} from '@/services/sessionPersistence';

interface UseSessionPersistenceOptions {
  autoSave?: boolean;
  saveInterval?: number;
  enableAutoRecovery?: boolean;
}

export function useSessionPersistence(
  options: UseSessionPersistenceOptions = {},
) {
  const {
    autoSave = true,
    saveInterval = 30000, // 30 seconds
    enableAutoRecovery = true,
  } = options;

  const saveSessionState = useGameStore((state) => state.saveSessionState);
  const loadSessionState = useGameStore((state) => state.loadSessionState);
  const attemptSessionRecovery = useGameStore(
    (state) => state.attemptSessionRecovery,
  );
  const clearSessionData = useGameStore((state) => state.clearSessionData);

  const session = useGameStore((state) => state.session);
  const scenes = useGameStore((state) => state.sceneState.scenes);
  const settings = useGameStore((state) => state.settings);
  const isRecovering = useGameStore((state) => state.isRecovering);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastSaveRef = useRef<number>(0);

  // Auto-save session state when relevant data changes
  useEffect(() => {
    if (!autoSave || isRecovering) return;

    // Avoid saving if no session or no scenes (prevents overwriting stored state on startup)
    const hasSession = Boolean(session?.roomCode);
    const hasScenes = Array.isArray(scenes) && scenes.length > 0;
    if (!hasSession || !hasScenes) {
      return;
    }

    // Debounce saves to avoid excessive localStorage writes
    const now = Date.now();
    if (now - lastSaveRef.current < 1000) {
      // Minimum 1 second between saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveSessionState();
        lastSaveRef.current = Date.now();
      }, 1000);
    } else {
      saveSessionState();
      lastSaveRef.current = now;
    }

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [session, scenes, settings, autoSave, saveSessionState, isRecovering]);

  // Periodic save as backup
  useEffect(() => {
    if (!autoSave) return;

    const interval = setInterval(() => {
      // Skip periodic saves during recovery
      const hasSession = Boolean(session?.roomCode);
      const hasScenes = Array.isArray(scenes) && scenes.length > 0;
      if (!isRecovering && hasSession && hasScenes) {
        saveSessionState();
        sessionPersistenceService.updateActivity();
      }
    }, saveInterval);

    return () => clearInterval(interval);
  }, [autoSave, saveInterval, saveSessionState, isRecovering, session?.roomCode, scenes]);

  // Attempt session recovery on mount
  useEffect(() => {
    if (!enableAutoRecovery) return;

    let isMounted = true;
    let recoveryAttempted = false;

    const tryRecovery = async () => {
      // Prevent multiple recovery attempts
      if (recoveryAttempted) {
        console.log('⚠️ Session recovery already attempted, skipping');
        return;
      }
      recoveryAttempted = true;

      try {
        const authCompleteFlag = localStorage.getItem('nexus-auth-complete');
        const urlParams = new URLSearchParams(window.location.search);
        const isOAuthRedirect =
          urlParams.has('code') ||
          urlParams.has('state') ||
          window.location.pathname.includes('/auth/');

        if (authCompleteFlag || isOAuthRedirect) {
          console.log(
            '🔐 Skipping auto-recovery during OAuth authentication flow',
          );
          return;
        }

        // Check for URL-based reconnection first
        const reconnectionData =
          sessionPersistenceService.checkForReconnection();
        if (reconnectionData) {
          console.log('🔗 Found reconnection data in URL', reconnectionData);

          // Handle URL-based reconnection by triggering the same recovery process
          // but with URL-provided parameters taking precedence
          const urlRecovered = await attemptSessionRecovery();
          if (urlRecovered && isMounted) {
            console.log('✅ URL-based session recovery successful');
          }
          return;
        }

        // Attempt automatic session recovery
        const recovered = await attemptSessionRecovery();
        if (recovered && isMounted) {
          console.log('✅ Session recovery successful');
          // Show success notification
          if (typeof window !== 'undefined' && 'toast' in window) {
            // Only show toast if available
            try {
              const toast = (
                window as { toast?: { success: (message: string) => void } }
              ).toast;
              toast?.success('Session restored successfully');
            } catch {
              // Ignore toast errors
            }
          }
        } else if (isMounted) {
          console.log('⚠️ Session recovery failed or not possible');
        }
      } catch (error) {
        console.error('Session recovery failed:', error);
      }
    };

    // Small delay to ensure gameStore is ready
    const timer = setTimeout(tryRecovery, 100);

    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableAutoRecovery]); // Removed attemptSessionRecovery from dependencies to prevent re-runs

  // Handle page visibility changes to update activity
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sessionPersistenceService.updateActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Handle beforeunload to save final state
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveSessionState();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveSessionState]);

  // Return utility functions for manual control
  return {
    saveNow: () => {
      saveSessionState();
      console.log('💾 Session state saved manually');
    },

    loadState: () => {
      loadSessionState();
      console.log('📂 Session state loaded manually');
    },

    clearAll: () => {
      clearSessionData();
      console.log('🗑️ All session data cleared manually');
    },

    getRecoveryData: () => {
      return sessionPersistenceService.getRecoveryData();
    },

    getSessionStats: () => {
      return sessionPersistenceService.getSessionStats();
    },

    generateReconnectUrl: (baseUrl: string) => {
      return sessionPersistenceService.generateReconnectUrl(baseUrl);
    },

    debugStorage: () => {
      sessionPersistenceService.debugStorageState();
    },

    forceRecovery: async () => {
      console.log('🔄 Forcing session recovery attempt...');
      const result = await attemptSessionRecovery();
      console.log('🔄 Force recovery result:', result);
      return result;
    },
  };
}

/**
 * Hook for showing session recovery UI components
 */
export function useSessionRecoveryUI() {
  const [recoveryData, setRecoveryData] = useState<{
    isValid: boolean;
    canReconnect: boolean;
    session: PersistedSession | null;
    gameState: PersistedGameState | null;
  }>({
    isValid: false,
    canReconnect: false,
    session: null,
    gameState: null,
  });

  useEffect(() => {
    sessionPersistenceService.getRecoveryData().then((data) => {
      setRecoveryData(data);
    });
  }, []);

  return {
    hasRecoverableSession: recoveryData.isValid,
    canReconnect: recoveryData.canReconnect,
    sessionInfo: recoveryData.session,
    gameStateInfo: recoveryData.gameState,

    showRecoveryPrompt: () => {
      if (!recoveryData.canReconnect) return false;

      // Could show a modal or notification asking if user wants to reconnect
      return window.confirm(
        `Found a recent session in room ${recoveryData.session?.roomCode}. Would you like to reconnect?`,
      );
    },
  };
}

/**
 * Development hook for testing session persistence
 */
export function useSessionPersistenceDebug() {
  if (process.env.NODE_ENV !== 'development') {
    return {};
  }

  return {
    logSessionData: () => {
      const stats = sessionPersistenceService.getSessionStats();
      console.log('Session Persistence Debug:', stats);
    },

    forceError: () => {
      // Force an error to test error handling
      sessionPersistenceService.clearAll();
      throw new Error('Forced session persistence error for testing');
    },

    simulateReconnection: (roomCode: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set('reconnect', roomCode);
      url.searchParams.set('userId', 'test-user');
      url.searchParams.set('userType', 'player');
      window.history.pushState({}, '', url.toString());
      window.location.reload();
    },
  };
}

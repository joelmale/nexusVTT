/**
 * Game layout component for active game sessions
 *
 * Handles:
 * - Loading game session from URL parameter
 * - Session recovery on page refresh
 * - WebSocket reconnection
 * - Invalid/expired session handling
 */
import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';

// Lazy load the heavy GameUI component
const GameUI = React.lazy(() =>
  import('./GameUI').then((module) => ({ default: module.GameUI })),
);

export const LinearGameLayout: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { session, user } = useGameStore();
  const [isRecovering, setIsRecovering] = useState(true);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    const recoverSession = async () => {
      if (!roomCode) {
        console.error('No room code in URL');
        navigate('/lobby');
        return;
      }

      try {
        // Check if we already have this session loaded
        if (session?.roomCode === roomCode) {
          console.log('✅ Session already loaded:', roomCode);
          setIsRecovering(false);
          return;
        }

        // Try to recover from localStorage
        const stored = localStorage.getItem('nexus-active-session');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.roomCode === roomCode) {
            console.log('🔄 Recovering session from localStorage:', roomCode);

            // Reconnect to WebSocket with room code
            const { webSocketService } = await import('@/services/websocket');
            await webSocketService.connect(roomCode, user.type);

            setIsRecovering(false);
            return;
          }
        }

        // No recoverable session - redirect to lobby
        console.warn('⚠️ No recoverable session for room:', roomCode);
        setRecoveryError('Session expired or invalid');
        setTimeout(() => navigate('/lobby'), 2000);
      } catch (error) {
        console.error('Failed to recover session:', error);
        setRecoveryError('Failed to reconnect to game');
        setTimeout(() => navigate('/lobby'), 2000);
      }
    };

    recoverSession();
  }, [roomCode, navigate, session, user.type]);

  if (isRecovering) {
    return (
      <div className="session-recovery">
        <div className="spinner" />
        <p>Reconnecting to game...</p>
      </div>
    );
  }

  if (recoveryError) {
    return (
      <div className="session-error">
        <p>{recoveryError}</p>
        <p>Redirecting to lobby...</p>
      </div>
    );
  }

  // Render actual game UI
  return (
    <Suspense
      fallback={
        <div className="game-loading">
          <div className="spinner" />
          <p>Loading game interface...</p>
        </div>
      }
    >
      <GameUI />
    </Suspense>
  );
};

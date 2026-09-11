import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';

/**
 * Protected route wrapper that ensures required setup is complete
 *
 * Guards routes that require user data or other prerequisites.
 * Redirects to appropriate setup page if requirements not met.
 *
 * @param requireUser - Whether user data must be present
 * @param requireSession - Whether session data must be present
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireUser?: boolean;
  requireSession?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireUser = false,
  requireSession = false,
}) => {
  const { user, session, isRecovering, attemptSessionRecovery } = useGameStore();
  const navigate = useNavigate();
  const [recoveryChecked, setRecoveryChecked] = useState(false);

  useEffect(() => {
    if (requireUser && !user.name) {
      console.warn('User data required - redirecting to lobby');
      navigate('/lobby');
    }

    if (requireSession && !session && !isRecovering && !recoveryChecked) {
      void attemptSessionRecovery().finally(() => {
        setRecoveryChecked(true);
      });
      return;
    }

    if (requireSession && !session && recoveryChecked && !isRecovering) {
      console.warn('Session required - redirecting to lobby');
      navigate('/lobby');
    }
  }, [
    user,
    session,
    isRecovering,
    recoveryChecked,
    attemptSessionRecovery,
    navigate,
    requireUser,
    requireSession,
  ]);

  if (requireUser && !user.name) return null;
  if (requireSession && !session) return null;

  return <>{children}</>;
};

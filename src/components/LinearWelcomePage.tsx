/**
 * Linear Welcome Page Component
 *
 * Simple welcome page with:
 * - Name input
 * - Player role with optional room code
 * - DM role for game creation
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import { NexusLogo } from './Assets';
import { useAssetExists } from '@/utils/assets';
import DnDTeamBackground from '@/assets/DnDTeamPosing.webp';
import { preloadOnUserIntent } from '@/services/cssLoader';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export const LinearWelcomePage: React.FC = () => {
  const {
    setUser,
    joinRoomWithCode,
    dev_quickDM,
    dev_quickPlayer,
    isAuthenticated,
    autoPlacePlayerToken,
    session,
    attemptSessionRecovery,
    login,
    logout,
    user,
  } = useGameStore();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'player' | 'dm' | null>(
    null,
  );

  // Preload styles based on user intent
  const handleRoleSelection = (role: 'player' | 'dm') => {
    setSelectedRole(role);
    // Preload styles for the selected role
    if (role === 'player') {
      preloadOnUserIntent('character-creation');
    } else if (role === 'dm') {
      preloadOnUserIntent('scene-editing');
    }
  };
  const [roomCode, setRoomCode] = useState('');
  const [quickJoinMode, setQuickJoinMode] = useState<'player' | 'spectator'>(
    'player',
  );
  const [quickJoinTokenImage, setQuickJoinTokenImage] = useState<string | null>(
    null,
  );
  const [quickJoinTokenFileName, setQuickJoinTokenFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hasCustomLogo = useAssetExists('/assets/logos/nexus-logo.svg');

  // Campaign selection state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [characters, setCharacters] = useState<
    { id: string; name: string; data: { race?: string; class?: string; level?: number; portrait?: string; [key: string]: unknown; } }[]
  >([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const emailInputRef = React.useRef<HTMLInputElement | null>(null);
  const buildVersion = import.meta.env.VITE_BUILD_VERSION ?? 'dev';

  // Detect if we're returning from OAuth (check for common OAuth params)
  const isOAuthRedirect = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has('code') ||
      params.has('state') ||
      window.location.pathname.includes('/auth/') ||
      // Also check if we just became authenticated in the last 2 seconds
      (isAuthenticated && !localStorage.getItem('nexus-auth-complete'))
    );
  }, [isAuthenticated]);

  // Mark auth as complete after OAuth
  React.useEffect(() => {
    if (isAuthenticated && isOAuthRedirect && !localStorage.getItem('nexus-auth-complete')) {
      // Clear any stale session data when user authenticates via OAuth
      console.log('🔐 OAuth complete - clearing stale session data');
      localStorage.removeItem('nexus-active-session');
      localStorage.setItem('nexus-auth-complete', 'true');

      // Clear the flag after a short delay
      setTimeout(() => {
        localStorage.removeItem('nexus-auth-complete');
      }, 5000);
    }
  }, [isAuthenticated, isOAuthRedirect]);

  // Auto-navigate to game if session exists, or attempt recovery if needed
  React.useEffect(() => {
    const recoverAndNavigate = async () => {
      // Skip auto-recovery if we're in the middle of OAuth flow
      if (isOAuthRedirect) {
        console.log('🔐 Skipping auto-recovery during OAuth redirect');
        return;
      }

      // Skip auto-recovery if we just completed OAuth login
      if (localStorage.getItem('nexus-auth-complete')) {
        console.log('🔐 Skipping auto-recovery - OAuth just completed');
        return;
      }

      if (session?.roomCode) {
        console.log(
          '🔄 Found existing session, navigating to game:',
          session.roomCode,
        );
        navigate(`/lobby/game/${session.roomCode}`);
        return;
      }

      // Check if we have stored session data that needs recovery
      const stored = localStorage.getItem('nexus-active-session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.roomCode) {
            console.log(
              '🔄 Attempting session recovery for room:',
              parsed.roomCode,
            );
            const recovered = await attemptSessionRecovery();
            if (recovered) {
              console.log(
                '✅ Session recovered, navigation will happen on next render',
              );
            }
          }
        } catch (error) {
          console.error('Failed to recover session from localStorage:', error);
        }
      }
    };

    recoverAndNavigate();
  }, [session, navigate, attemptSessionRecovery, isOAuthRedirect]);

  /**
   * Fetch user's campaigns when DM role is selected and user is authenticated
   */
  React.useEffect(() => {
    const fetchCampaigns = async () => {
      if (selectedRole !== 'dm' || !isAuthenticated) {
        return;
      }

      setCampaignsLoading(true);
      try {
        const response = await fetch('/api/campaigns', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch campaigns');
        }
        const data = await response.json();
        setCampaigns(data);
      } catch (err) {
        console.error('Failed to fetch campaigns:', err);
        setError('Failed to load campaigns');
      } finally {
        setCampaignsLoading(false);
      }
    };

    fetchCampaigns();
  }, [selectedRole, isAuthenticated]);

  /**
   * Fetch user's characters when Player role is selected and user is authenticated
   */
  React.useEffect(() => {
    const fetchCharacters = async () => {
      if (selectedRole !== 'player' || !isAuthenticated) {
        return;
      }

      setCharactersLoading(true);
      try {
        const response = await fetch('/api/characters', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch characters');
        }
        const data = await response.json();
        setCharacters(data);
      } catch (err) {
        console.error('Failed to fetch characters:', err);
        setError('Failed to load characters');
      } finally {
        setCharactersLoading(false);
      }
    };

    fetchCharacters();
  }, [selectedRole, isAuthenticated]);

  /**
   * Handles player setup - creates guest user if not authenticated
   */
  const handlePlayerSetup = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create guest user if not authenticated
      const { isAuthenticated } = useGameStore.getState();
      if (!isAuthenticated) {
        const response = await fetch('/api/guest-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: playerName.trim() }),
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to create guest user');
        }

        const guestUser = await response.json();
        console.log('Guest user created:', guestUser);
        setUser({ ...guestUser, type: 'player' });
      } else {
        setUser({ name: playerName.trim(), type: 'player' });
      }
      navigate('/lobby/player-setup');
    } catch (err) {
      console.error('Failed to create guest user:', err);
      setError('Failed to set up player. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalAuth = async (mode: 'signin' | 'signup') => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login';
      const body =
        mode === 'signup'
          ? { email: authEmail.trim(), password: authPassword, displayName: authDisplayName.trim() || undefined }
          : { email: authEmail.trim(), password: authPassword };

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
      } catch {
        throw new Error(
          'Unable to reach the server. Please check your connection and try again.',
        );
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const statusHint =
          response.status >= 500
            ? 'Server error. Please try again shortly.'
            : response.status === 429
              ? 'Too many attempts. Please wait and try again.'
              : 'Authentication failed.';
        throw new Error(data.error || statusHint);
      }

      login({
        ...data,
        type: 'player',
        connected: true,
        color: 'blue',
      });
      setAuthSuccess(
        mode === 'signup'
          ? 'Account created. You are signed in.'
          : 'Signed in successfully.',
      );
      setShowAccountModal(false);
      navigate('/dashboard');
    } catch (err) {
      console.error('Local auth failed:', err);
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Focus email on modal open and close on Escape
  React.useEffect(() => {
    if (showAccountModal && emailInputRef.current) {
      emailInputRef.current.focus();
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAccountModal(false);
      }
    };

    if (showAccountModal) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [showAccountModal]);

  /**
   * Handles quick join - creates guest user and joins room directly
   */
  const handleQuickJoin = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length !== 4) {
      setError('Please enter a valid 4-character room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create guest user if not authenticated
      const { isAuthenticated } = useGameStore.getState();
      if (!isAuthenticated) {
        const response = await fetch('/api/guest-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: playerName.trim() }),
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to create guest user');
        }

        const guestUser = await response.json();
        console.log('Guest user created:', guestUser);
        setUser({
          ...guestUser,
          type: 'player',
          isSpectator: quickJoinMode === 'spectator',
        });
      } else {
        setUser({
          name: playerName.trim(),
          type: 'player',
          isSpectator: quickJoinMode === 'spectator',
        });
      }
      const joinedRoomCode = await joinRoomWithCode(
        roomCode.trim().toUpperCase(),
      );
      if (quickJoinMode === 'player') {
        setTimeout(() => {
          autoPlacePlayerToken(
            playerName.trim(),
            quickJoinTokenImage || undefined,
          );
        }, 500);
      }
      navigate(`/lobby/game/${joinedRoomCode}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to join room - room may not exist or be full';
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickJoinTokenUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setQuickJoinTokenImage(reader.result as string);
      setQuickJoinTokenFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Handles DM setup - creates guest user if not authenticated, then creates game
   * For authenticated users, requires campaign selection
   * For guest users, auto-creates a campaign
   */
  const handleDMSetup = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    const { isAuthenticated } = useGameStore.getState();

    // Check if authenticated user has selected a campaign
    if (isAuthenticated && !selectedCampaign) {
      setError('Please select a campaign or create a new one');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create guest user if not authenticated
      if (!isAuthenticated) {
        const response = await fetch('/api/guest-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: playerName.trim() }),
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to create guest user');
        }

        const guestUser = await response.json();
        console.log('Guest user created:', guestUser);
        setUser({ ...guestUser, type: 'host' });
      } else {
        // Set user in store for authenticated users
        setUser({ name: playerName.trim(), type: 'host' });
      }

      navigate('/lobby/dm-setup');
    } catch (err) {
      console.error('Failed to create game:', err);
      setError('Failed to set up game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="welcome-page">
      <div className="welcome-background">
        <img src={DnDTeamBackground} alt="D&D Adventure Party" />
        <div className="background-overlay"></div>
        <div className="background-particles">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 4}s`,
                animationDuration: `${4 + Math.random() * 4}s`,
              }}
            ></div>
          ))}
        </div>
      </div>

      <div className="welcome-content">
        <div className="welcome-panel glass-panel">
          <div className="build-badge" aria-label="Build version">
            Build {buildVersion}
          </div>
          {/* Account Menu - Upper Right */}
          <div className="account-menu">
            <button
              className={`account-bubble glass-panel ${isAuthenticated ? 'logged-in' : ''}`}
              title={isAuthenticated ? 'Account menu' : 'Login with OAuth'}
              onClick={() =>
                isAuthenticated
                  ? setShowAccountMenu((prev) => !prev)
                  : setShowAccountModal(true)
              }
            >
              <span className="account-icon">
                {isAuthenticated
                  ? (user.name || user.displayName || 'User')[0]?.toUpperCase()
                  : '👤'}
              </span>
            </button>
          </div>

          {showAccountMenu && isAuthenticated && (
            <div
              className="account-overlay"
              role="presentation"
              onClick={() => setShowAccountMenu(false)}
            >
              <div
                className="account-dropdown glass-panel open compact"
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-menu-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="account-dropdown-header">
                  <div className="title-row">
                    <span className="dropdown-title" id="account-menu-title">
                      Signed in
                    </span>
                    <div className="title-note">
                      {user.displayName || user.name || 'Adventurer'}
                    </div>
                  </div>
                  <button
                    className="account-close"
                    onClick={() => setShowAccountMenu(false)}
                    aria-label="Close account menu"
                  >
                    ×
                  </button>
                </div>

                <div className="account-menu-actions">
                  <button
                    className="account-option wide"
                    onClick={() => {
                      setShowAccountMenu(false);
                      navigate('/dashboard');
                    }}
                  >
                    <span className="option-text">Go to dashboard</span>
                  </button>
                  <button
                    className="account-option wide"
                    onClick={async () => {
                      await logout();
                      setShowAccountMenu(false);
                      navigate('/lobby');
                    }}
                  >
                    <span className="option-text">Log out</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {showAccountModal && (
            <div
              className="account-overlay"
              role="presentation"
              onClick={() => setShowAccountModal(false)}
            >
              <div
                className="account-dropdown glass-panel open"
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-modal-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="account-dropdown-header">
                  <div className="title-row">
                    <span className="dropdown-title" id="account-modal-title">
                      {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </span>
                    <div className="title-note">
                      {authMode === 'signin'
                        ? 'Use your Nexus account'
                        : 'Create a Nexus account'}
                    </div>
                  </div>
                  <button
                    className="account-close"
                    onClick={() => setShowAccountModal(false)}
                    aria-label="Close account modal"
                  >
                    ×
                  </button>
                </div>

                <div className="account-form">
                  <label className="account-label" htmlFor="account-email">
                    Email
                  </label>
                  <input
                    id="account-email"
                    ref={emailInputRef}
                    type="email"
                    className="glass-input"
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    disabled={authLoading}
                  />

                  {authMode === 'signup' && (
                    <>
                      <label className="account-label" htmlFor="account-display-name">
                        Display name (optional)
                      </label>
                      <input
                        id="account-display-name"
                        type="text"
                        className="glass-input"
                        placeholder="Your name in Nexus"
                        value={authDisplayName}
                        onChange={(e) => setAuthDisplayName(e.target.value)}
                        disabled={authLoading}
                      />
                    </>
                  )}

                  <label className="account-label" htmlFor="account-password">
                    Password
                  </label>
                  <input
                    id="account-password"
                    type="password"
                    className="glass-input"
                    placeholder="Enter your password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    disabled={authLoading}
                  />
                  {authMode === 'signup' && (
                    <div className="helper-text">
                      Use 8+ characters. We hash everything client-to-server.
                    </div>
                  )}

                  <button
                    className="action-btn glass-button primary"
                    disabled={!authEmail || !authPassword || authLoading}
                    onClick={() => handleLocalAuth(authMode)}
                  >
                    {authLoading
                      ? 'Please wait...'
                      : authMode === 'signin'
                        ? 'Sign In'
                        : 'Create Account'}
                  </button>
                  {authError && (
                    <div className="feedback error-message compact">
                      <span className="feedback-icon">⚠️</span>
                      {authError}
                    </div>
                  )}
                  {authSuccess && (
                    <div className="feedback success-message compact">
                      <span className="feedback-icon">✅</span>
                      {authSuccess}
                    </div>
                  )}
                  <button
                    className="account-text-toggle"
                    onClick={() =>
                      setAuthMode(authMode === 'signin' ? 'signup' : 'signin')
                    }
                  >
                    {authMode === 'signin'
                      ? "Don't have an account? Create one"
                      : 'Have an account? Sign in'}
                  </button>
                </div>

                <div className="account-divider">or continue with</div>

                <div className="oauth-block">
                  <a href="/auth/google" className="account-option wide">
                    <span className="option-icon google-icon">G</span>
                    <span className="option-text">Google</span>
                  </a>
                  <a href="/auth/discord" className="account-option wide">
                    <span className="option-icon discord-icon">D</span>
                    <span className="option-text">Discord</span>
                  </a>
                </div>
                <div className="account-dropdown-footer">
                  <span className="dropdown-hint">
                    Accounts sync characters & campaigns. Guests can migrate later.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Brand Section */}
          <div className="brand-section">
            {hasCustomLogo ? (
              <NexusLogo size="xl" className="welcome-logo" />
            ) : (
              <div className="brand-logo">
                <div className="logo-icon">🎲</div>
                <h1 className="brand-title">Nexus VTT</h1>
              </div>
            )}
            <p className="brand-tagline">Your gateway to epic adventures</p>
          </div>

          {error && (
            <div className="error-message glass-panel error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Name Input */}
          <div className="form-section">
            <div className="input-group">
              <label htmlFor="adventurerName">Enter Your Name</label>
              <div className="glass-input-wrapper">
                <span className="input-icon">👤</span>
                <input
                  id="adventurerName"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your adventurer name"
                  className="glass-input"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="role-selection">
              <label>Choose Your Adventure</label>
              <div className="role-cards">
                {/* Player Options */}
                <div className="role-card-group">
                  <div
                    className={`role-card glass-panel ${selectedRole === 'player' ? 'selected' : ''}`}
                    onClick={() => handleRoleSelection('player')}
                  >
                    <div className="role-icon">⚔️</div>
                    <div className="role-info">
                      <h3>Player</h3>
                      <p>Join adventures as a hero</p>
                    </div>
                    <div className="selection-indicator">
                      {selectedRole === 'player' && <span>✓</span>}
                    </div>
                  </div>

                  {/* Player Action Buttons */}
                  {selectedRole === 'player' && (
                    <div className="player-actions">
                      {/* Character Selection for Authenticated Users */}
                      {isAuthenticated && (
                        <div className="campaign-selection">
                          <label
                            htmlFor="character-select"
                            className="campaign-label"
                          >
                            Select Character (Optional)
                          </label>
                          {charactersLoading ? (
                            <div className="loading-state">
                              <span className="loading-spinner"></span>
                              Loading characters...
                            </div>
                          ) : characters.length > 0 ? (
                            <select
                              id="character-select"
                              value={selectedCharacter}
                              onChange={(e) =>
                                setSelectedCharacter(e.target.value)
                              }
                              className="glass-input campaign-dropdown"
                              disabled={loading}
                            >
                              <option value="">
                                -- Select a character or create new --
                              </option>
                              {characters.map((character) => (
                                <option key={character.id} value={character.id}>
                                  {character.name}
                                  {character.data?.class
                                    ? ` (${character.data.class})`
                                    : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="no-campaigns-hint">
                              No saved characters yet. You can create one from
                              the{' '}
                              <a href="/dashboard" className="dashboard-link">
                                dashboard
                              </a>{' '}
                              or continue as a new character.
                            </p>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handlePlayerSetup}
                        disabled={!playerName.trim() || loading}
                        className="action-btn glass-button primary"
                      >
                        <span>🎭</span>
                        Character Setup
                      </button>

                        <div className="quick-join-section">
                          <div className="divider-small">
                            <span>or</span>
                          </div>
                          <div className="quick-join-form">
                            <div className="quick-join-controls">
                              <div className="quick-join-mode">
                                <button
                                  type="button"
                                  className={`glass-button ${quickJoinMode === 'player' ? 'primary' : 'secondary'}`}
                                  onClick={() => setQuickJoinMode('player')}
                                >
                                  🎮 Player
                                </button>
                                <button
                                  type="button"
                                  className={`glass-button ${quickJoinMode === 'spectator' ? 'primary' : 'secondary'}`}
                                  onClick={() => setQuickJoinMode('spectator')}
                                >
                                  👁️ Spectator
                                </button>
                              </div>
                              {quickJoinMode === 'player' && (
                                <div className="quick-join-token">
                                  <label htmlFor="quick-join-token-upload">
                                    Token image (optional)
                                  </label>
                                  <input
                                    id="quick-join-token-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleQuickJoinTokenUpload}
                                    disabled={loading}
                                  />
                                  <small>
                                    We’ll create a default token with your name if you
                                    skip this.
                                  </small>
                                  {quickJoinTokenImage && (
                                    <div className="quick-join-token-preview">
                                      <img
                                        src={quickJoinTokenImage}
                                        alt="Token preview"
                                      />
                                      <span>{quickJoinTokenFileName}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="quick-join-row">
                              <div className="glass-input-wrapper room-input">
                                <span className="input-icon">🗝️</span>
                                <input
                                  type="text"
                                  value={roomCode}
                                  onChange={(e) =>
                                    setRoomCode(e.target.value.toUpperCase())
                                  }
                                  placeholder="Room Code"
                                  maxLength={4}
                                  className="glass-input room-code-input"
                                  disabled={loading}
                                />
                              </div>
                              <button
                                onClick={handleQuickJoin}
                                disabled={
                                  !playerName.trim() || !roomCode.trim() || loading
                                }
                                className="action-btn glass-button primary"
                              >
                                {loading ? (
                                  <>
                                    <span className="loading-spinner"></span>
                                    Joining...
                                  </>
                                ) : (
                                  <>
                                    <span>🚀</span>
                                    Quick Join
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                    </div>
                  )}
                </div>

                {/* DM Options */}
                <div className="role-card-group">
                  <div
                    className={`role-card glass-panel ${selectedRole === 'dm' ? 'selected' : ''}`}
                    onClick={() => handleRoleSelection('dm')}
                  >
                    <div className="role-icon">👑</div>
                    <div className="role-info">
                      <h3>Dungeon Master</h3>
                      <p>Guide the story and control the world</p>
                    </div>
                    <div className="selection-indicator">
                      {selectedRole === 'dm' && <span>✓</span>}
                    </div>
                  </div>

                  {/* DM Action Button */}
                  {selectedRole === 'dm' && (
                    <div className="dm-actions">
                      {/* Campaign Selection for Authenticated Users */}
                      {isAuthenticated && (
                        <div className="campaign-selection">
                          <label
                            htmlFor="campaign-select"
                            className="campaign-label"
                          >
                            Select Campaign
                          </label>
                          {campaignsLoading ? (
                            <div className="loading-state">
                              <span className="loading-spinner"></span>
                              Loading campaigns...
                            </div>
                          ) : campaigns.length > 0 ? (
                            <select
                              id="campaign-select"
                              value={selectedCampaign}
                              onChange={(e) =>
                                setSelectedCampaign(e.target.value)
                              }
                              className="glass-input campaign-dropdown"
                              disabled={loading}
                            >
                              <option value="">-- Select a campaign --</option>
                              {campaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="no-campaigns-hint">
                              No campaigns yet. Create one from the{' '}
                              <a href="/dashboard" className="dashboard-link">
                                dashboard
                              </a>
                              .
                            </p>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handleDMSetup}
                        disabled={
                          !playerName.trim() ||
                          loading ||
                          (isAuthenticated && !selectedCampaign)
                        }
                        className="action-btn glass-button primary"
                      >
                        <span>🎲</span>
                        Create Game
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Development Tools - Only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="dev-tools">
              <hr className="dev-divider" />
              <h4 className="dev-title">⚡ Development Tools</h4>
              <div className="dev-buttons">
                <button
                  onClick={() => dev_quickDM()}
                  className="dev-btn glass-button secondary small"
                  title="Start as DM in offline mode - prepare game, then go online"
                >
                  🎮 Quick DM
                </button>
                <button
                  onClick={() => dev_quickPlayer()}
                  className="dev-btn glass-button secondary small"
                  title="Create test character and go to offline game"
                >
                  👤 Quick Player
                </button>
                <button
                  onClick={() => {
                    navigate('/admin');
                  }}
                  className="dev-btn glass-button secondary small"
                  title="Access admin panel for character generation data"
                >
                  ⚙️ Admin Panel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

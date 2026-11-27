import React, { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CompanionLaunches } from '@/components/CompanionLaunches';
import { useGameStore } from '@/stores/gameStore';
import { useQuickStart } from '@/hooks/useQuickStart';
import { PopoverMenu } from './PopoverMenu';
import { AboutModal, AboutTriggerButton } from './AboutModal';
import { useShallow } from 'zustand/react/shallow';
import DnDTeamBackground from '@/assets/DnDTeamPosing.webp';
import styles from './LinearWelcomePage.module.css';
import { isDevMode } from '@/utils/devMode';
import { useDevToolsEnabled } from '@/utils/devToolsFlag';
import {
  getCampaignStudioUrl,
  getCharacterForgeUrl,
} from '@/utils/productUrls';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export const LinearWelcomePage: React.FC = () => {
  // Select only what we need — prevents re-renders on unrelated store changes.
  // State values that actually affect this page's output:
  const { isAuthenticated, session, user } = useGameStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      session: s.session,
      user: s.user,
    })),
  );
  // Actions are stable references; pulling them separately avoids the
  // shallow-compare overhead on every render.
  const setUser = useGameStore((s) => s.setUser);
  const joinRoomWithCode = useGameStore((s) => s.joinRoomWithCode);
  const dev_quickDM = useGameStore((s) => s.dev_quickDM);
  const dev_quickPlayer = useGameStore((s) => s.dev_quickPlayer);
  const autoPlacePlayerToken = useGameStore((s) => s.autoPlacePlayerToken);
  const login = useGameStore((s) => s.login);
  const logout = useGameStore((s) => s.logout);
  const navigate = useNavigate();
  const quickStartDev = useQuickStart();
  // Server-reported: whether the /api/dev/* seeding routes actually exist.
  const devToolsEnabled = useDevToolsEnabled();
  const [searchParams] = useSearchParams();
  const [hosting, setHosting] = useState(
    () => searchParams.get('mode') === 'host',
  );
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const accountPopoverId = useId();
  const [quickJoinMode, setQuickJoinMode] = useState<'player' | 'spectator'>(
    'player',
  );
  const [quickJoinTokenImage, setQuickJoinTokenImage] = useState<string | null>(
    null,
  );
  const [quickJoinTokenFileName, setQuickJoinTokenFileName] = useState('');
  const [error, setError] = useState('');
  const [hostError, setHostError] = useState('');
  const [loading, setLoading] = useState(false);

  // Campaign selection state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [characters, setCharacters] = useState<
    {
      id: string;
      name: string;
      data: {
        race?: string;
        class?: string;
        level?: number;
        portrait?: string;
        [key: string]: unknown;
      };
    }[]
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
  const emailInputRef = React.useRef<HTMLInputElement | null>(null);
  const buildVersion = import.meta.env.VITE_BUILD_VERSION ?? 'dev';
  const [showAboutModal, setShowAboutModal] = useState(false);

  const configuredHubUrl =
    import.meta.env.VITE_GENERATOR_HUB_URL ||
    (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
  const generatorsUrl =
    typeof window === 'undefined'
      ? configuredHubUrl
      : new URL(configuredHubUrl, window.location.href).toString();

  const campaignStudioUrl = getCampaignStudioUrl();
  const characterForgeUrl = getCharacterForgeUrl();

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
    if (
      isAuthenticated &&
      isOAuthRedirect &&
      !localStorage.getItem('nexus-auth-complete')
    ) {
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
  // Navigate to game once session recovery (handled by Providers/useSessionPersistence)
  // sets a roomCode in the store. We do NOT attempt recovery here — that would duplicate
  // the attempt already made by useSessionPersistence and trigger a second WS reconnect loop.
  React.useEffect(() => {
    if (isOAuthRedirect) return;
    if (localStorage.getItem('nexus-auth-complete')) return;
    if (session?.roomCode) {
      console.log(
        '🔄 Found existing session, navigating to game:',
        session.roomCode,
      );
      navigate(`/lobby/game/${session.roomCode}`);
    }
  }, [session?.roomCode, navigate, isOAuthRedirect]);

  /**
   * Fetch saved campaigns when a signed-in user opens the host form
   */
  React.useEffect(() => {
    const fetchCampaigns = async () => {
      if (!hosting || !isAuthenticated) {
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
        setHostError('Failed to load campaigns');
      } finally {
        setCampaignsLoading(false);
      }
    };

    fetchCampaigns();
  }, [hosting, isAuthenticated]);

  /**
   * Fetch saved characters for signed-in users
   */
  React.useEffect(() => {
    const fetchCharacters = async () => {
      if (!isAuthenticated) {
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
  }, [isAuthenticated]);

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
          ? {
              email: authEmail.trim(),
              password: authPassword,
              displayName: authDisplayName.trim() || undefined,
            }
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
      navigate('/campaign-home');
    } catch (err) {
      console.error('Local auth failed:', err);
      setAuthError(
        err instanceof Error ? err.message : 'Authentication failed',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Handles quick join - creates guest user and joins room directly
   */
  const handleQuickJoin = async () => {
    const quickJoinPlayerName = playerName.trim();
    if (!quickJoinPlayerName) {
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
          body: JSON.stringify({ name: quickJoinPlayerName }),
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
          name: quickJoinPlayerName,
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
            quickJoinPlayerName,
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
      setHostError('Please enter your name');
      return;
    }

    const { isAuthenticated } = useGameStore.getState();

    // Check if authenticated user has selected a campaign
    if (isAuthenticated && !selectedCampaign) {
      setHostError('Please select a campaign or create a new one');
      return;
    }

    setLoading(true);
    setHostError('');

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

      navigate('/lobby/dm-setup', {
        state: isAuthenticated ? { campaignId: selectedCampaign } : null,
      });
    } catch (err) {
      console.error('Failed to create game:', err);
      setHostError('Failed to set up game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>
          <img
            src={`${import.meta.env.BASE_URL}nexus-icon.svg`}
            alt=""
            width="36"
            height="36"
          />
          Nexus VTT
        </h1>
        <div className={styles.headerActions}>
          {isAuthenticated && <Link to="/campaign-home">Campaign Home</Link>}
          <div>
            <PopoverMenu
              id={accountPopoverId}
              focusOnOpen={isAuthenticated ? undefined : '#account-email'}
              trigger={
                <span className="account-trigger">
                  <span className="account-avatar">
                    {isAuthenticated
                      ? (user.name ||
                          user.displayName ||
                          'User')[0]?.toUpperCase()
                      : '👤'}
                  </span>
                  <span className="account-trigger-label">
                    {isAuthenticated
                      ? user.displayName || user.name || 'Account'
                      : 'Sign In'}
                  </span>
                </span>
              }
              triggerClassName={`account-bubble glass-panel ${isAuthenticated ? 'logged-in' : ''}`}
            >
              <div className="account-dropdown glass-panel">
                <div className="account-dropdown-header">
                  <div className="title-row">
                    <span className="dropdown-title">
                      {isAuthenticated
                        ? 'Signed in'
                        : authMode === 'signin'
                          ? 'Sign In'
                          : 'Create Account'}
                    </span>
                    <div className="title-note">
                      {isAuthenticated
                        ? user.displayName || user.name || 'Adventurer'
                        : authMode === 'signin'
                          ? 'Use your Nexus account'
                          : 'Create a Nexus account'}
                    </div>
                  </div>
                </div>

                {isAuthenticated ? (
                  <div className="account-menu-actions">
                    <button
                      className="account-option wide"
                      onClick={() => navigate('/campaign-home')}
                    >
                      <span className="option-text">Campaign Home</span>
                    </button>
                    <button
                      className="account-option wide"
                      onClick={async () => {
                        await logout();
                        navigate('/lobby');
                      }}
                    >
                      <span className="option-text">Log out</span>
                    </button>
                  </div>
                ) : (
                  <>
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
                          <label
                            className="account-label"
                            htmlFor="account-display-name"
                          >
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

                      <label
                        className="account-label"
                        htmlFor="account-password"
                      >
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
                          Use 8+ characters. We hash everything
                          client-to-server.
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
                      <div aria-live="polite" aria-atomic="true">
                        {authError && (
                          <div className="feedback error-message compact">
                            <span className="feedback-icon">⚠️</span>
                            {authError}
                          </div>
                        )}
                      </div>
                      {authSuccess && (
                        <div className="feedback success-message compact">
                          <span className="feedback-icon">✅</span>
                          {authSuccess}
                        </div>
                      )}
                      <button
                        className="account-text-toggle"
                        onClick={() =>
                          setAuthMode(
                            authMode === 'signin' ? 'signup' : 'signin',
                          )
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
                  </>
                )}
                <div className="account-dropdown-footer">
                  <span className="dropdown-hint">
                    Accounts sync characters & campaigns. Guests can migrate
                    later.
                  </span>
                </div>
              </div>
            </PopoverMenu>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <img
          className={styles.art}
          src={DnDTeamBackground}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
        <div className={styles.entry}>
          <section className={styles.card} aria-labelledby="join-heading">
            <h2 id="join-heading">Join a game</h2>
            <p>Enter the four-character room code from your GM.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleQuickJoin();
              }}
            >
              <label htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase())
                }
                maxLength={4}
                placeholder="ABCD"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                disabled={loading}
              />
              <label htmlFor="adventurer-name">Display name</label>
              <input
                id="adventurer-name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Your adventurer name"
                autoComplete="nickname"
                disabled={loading}
              />
              <details className={styles.options}>
                <summary>Join options</summary>
                <fieldset>
                  <legend>Join as</legend>
                  <label>
                    <input
                      type="radio"
                      name="join-mode"
                      checked={quickJoinMode === 'player'}
                      disabled={loading}
                      onChange={() => setQuickJoinMode('player')}
                    />
                    Player
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="join-mode"
                      checked={quickJoinMode === 'spectator'}
                      disabled={loading}
                      onChange={() => setQuickJoinMode('spectator')}
                    />
                    Spectator
                  </label>
                </fieldset>
                {quickJoinMode === 'player' && (
                  <>
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
                    {quickJoinTokenImage && (
                      <div className="quick-join-token-preview">
                        <img src={quickJoinTokenImage} alt="Token preview" />
                        <span>{quickJoinTokenFileName}</span>
                      </div>
                    )}
                  </>
                )}
              </details>
              <button
                className={`unstyled ${styles.primary}`}
                type="submit"
                disabled={
                  !playerName.trim() || roomCode.trim().length !== 4 || loading
                }
              >
                Join game
              </button>
              {isAuthenticated && (
                <div>
                  <label htmlFor="character-select">
                    Character for setup (optional)
                  </label>
                  <select
                    id="character-select"
                    value={selectedCharacter}
                    onChange={(event) =>
                      setSelectedCharacter(event.target.value)
                    }
                    disabled={loading || charactersLoading}
                  >
                    <option value="">
                      {charactersLoading
                        ? 'Loading characters…'
                        : 'New character'}
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
                </div>
              )}
              <button
                className={`unstyled ${styles.secondary}`}
                type="button"
                onClick={() => void handlePlayerSetup()}
                disabled={!playerName.trim() || loading}
              >
                Character setup
              </button>
            </form>
            <div aria-live="polite">
              {error && <p className={styles.error}>{error}</p>}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.returning}`}
            aria-labelledby="host-heading"
          >
            <h2 id="host-heading">Host or open a saved table</h2>
            <button
              className={`unstyled ${styles.secondary}`}
              type="button"
              aria-expanded={hosting}
              aria-controls="host-game-form"
              onClick={() => {
                setHosting(!hosting);
                setHostError('');
              }}
              disabled={loading}
            >
              Host a game
            </button>
            <form
              id="host-game-form"
              hidden={!hosting}
              onSubmit={(event) => {
                event.preventDefault();
                void handleDMSetup();
              }}
            >
              <label htmlFor="host-display-name">Host display name</label>
              <input
                id="host-display-name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                autoComplete="nickname"
                disabled={loading}
              />
              {isAuthenticated && (
                <>
                  <label htmlFor="campaign-select">Select campaign</label>
                  <select
                    id="campaign-select"
                    value={selectedCampaign}
                    onChange={(event) =>
                      setSelectedCampaign(event.target.value)
                    }
                    disabled={loading || campaignsLoading}
                  >
                    <option value="">
                      {campaignsLoading
                        ? 'Loading campaigns…'
                        : 'Select a campaign'}
                    </option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                  {!campaignsLoading && campaigns.length === 0 && (
                    <p>
                      No campaigns yet.{' '}
                      <Link to="/campaign-home">
                        Create one in Campaign Home.
                      </Link>
                    </p>
                  )}
                </>
              )}
              <button
                type="submit"
                className={`unstyled ${styles.primary}`}
                disabled={
                  !playerName.trim() ||
                  loading ||
                  (isAuthenticated && !selectedCampaign)
                }
              >
                Create game
              </button>
            </form>
            {isAuthenticated ? (
              <Link className={styles.textLink} to="/campaign-home">
                Find your saved tables
              </Link>
            ) : (
              <button
                className={`unstyled ${styles.textLink}`}
                type="button"
                popoverTarget={accountPopoverId}
                popoverTargetAction="show"
              >
                Sign in to find your saved tables
              </button>
            )}
            <div aria-live="polite">
              {hostError && <p className={styles.error}>{hostError}</p>}
            </div>
          </section>
        </div>
      </main>

      <footer className={styles.footer}>
        <CompanionLaunches
          campaignStudioUrl={campaignStudioUrl}
          characterForgeUrl={characterForgeUrl}
        />
        {/* Development Tools.
              Shown in a local dev build (isDevMode), or wherever the backend
              reports DEV_MODE on -- the latter is what makes the block visible
              on a deployed server, where a production bundle has isDevMode()
              false and VITE_DEV_MODE baked in at build time. */}
        {(isDevMode() || devToolsEnabled) && (
          <div className="dev-tools">
            <hr className="dev-divider" />
            <h4 className="dev-title">⚡ Development Tools</h4>
            <div className="dev-buttons">
              {/* Quick Start calls /api/dev/*, so it appears only when the
                    backend confirms those routes are registered. The buttons
                    beside it are client-only and need no such check. */}
              {devToolsEnabled && (
                <button
                  onClick={() => void quickStartDev.start()}
                  disabled={quickStartDev.isSeeding}
                  className="dev-btn glass-button primary small"
                  title="Seed a campaign, character, room, scene and token, then jump straight to the canvas"
                >
                  {quickStartDev.isSeeding
                    ? `⏳ ${quickStartDev.phase ?? 'starting'}...`
                    : '⚡ Quick Start'}
                </button>
              )}
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
              <a
                href={generatorsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dev-btn glass-button secondary small"
                title="Open Map Generators in a new tab"
              >
                🗺️ Generators
              </a>
            </div>
            {quickStartDev.error && (
              <div className="error-message glass-panel error" role="alert">
                <span className="error-icon">⚠️</span>
                {quickStartDev.error}
              </div>
            )}
          </div>
        )}
        <div className={styles.build}>
          <button type="button" onClick={() => setShowAboutModal(true)}>
            Build {buildVersion}
          </button>
          <AboutTriggerButton onClick={() => setShowAboutModal(true)} />
        </div>
      </footer>
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </div>
  );
};

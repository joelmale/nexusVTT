import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinearWelcomePage } from '@/components/LinearWelcomePage';
import { useGameStore } from '@/stores/gameStore';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
}));

const mockQuickStart = vi.hoisted(() => ({
  start: vi.fn(),
  isSeeding: false,
  phase: null as string | null,
  error: null as string | null,
}));
vi.mock('@/hooks/useQuickStart', () => ({
  useQuickStart: () => mockQuickStart,
}));

const devToolsEnabledRef = vi.hoisted(() => ({ value: false }));
vi.mock('@/utils/devToolsFlag', () => ({
  useDevToolsEnabled: () => devToolsEnabledRef.value,
}));

const devModeRef = vi.hoisted(() => ({ value: false }));
vi.mock('@/utils/devMode', () => ({
  isDevMode: () => devModeRef.value,
}));

vi.mock('@/assets/DnDTeamPosing.webp', () => ({ default: 'team.webp' }));

interface MockState {
  isAuthenticated: boolean;
  session: { roomCode?: string } | null;
  user: { name?: string; displayName?: string };
  setUser: ReturnType<typeof vi.fn>;
  joinRoomWithCode: ReturnType<typeof vi.fn>;
  dev_quickDM: ReturnType<typeof vi.fn>;
  dev_quickPlayer: ReturnType<typeof vi.fn>;
  autoPlacePlayerToken: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
}

function defaultState(overrides: Partial<MockState> = {}): MockState {
  return {
    isAuthenticated: false,
    session: null,
    user: {},
    setUser: vi.fn(),
    joinRoomWithCode: vi.fn().mockResolvedValue('ABCD'),
    dev_quickDM: vi.fn(),
    dev_quickPlayer: vi.fn(),
    autoPlacePlayerToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockStore(state: MockState) {
  const impl = ((selector?: (s: MockState) => unknown) =>
    selector ? selector(state) : state) as unknown as typeof useGameStore;
  vi.mocked(useGameStore).mockImplementation(impl);
  (useGameStore as unknown as { getState: () => MockState }).getState = () => state;
}

const mockFetch = vi.fn();

describe('LinearWelcomePage', () => {
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    devToolsEnabledRef.value = false;
    devModeRef.value = false;
    mockQuickStart.start.mockReset();
    mockQuickStart.isSeeding = false;
    mockQuickStart.phase = null;
    mockQuickStart.error = null;
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the role selection with no role chosen by default', () => {
    mockStore(defaultState());
    render(<LinearWelcomePage />);
    expect(screen.getByText('Nexus VTT')).toBeInTheDocument();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('Dungeon Master')).toBeInTheDocument();
    expect(screen.queryByText('🗝️ Have a room code?')).not.toBeInTheDocument();
  });

  it('reveals the quick-join form when the player role is selected', () => {
    mockStore(defaultState());
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Player'));
    expect(screen.getByText('🗝️ Have a room code?')).toBeInTheDocument();
    expect(screen.getByText('Character Setup')).toBeInTheDocument();
  });

  it('reveals the campaign action when the DM role is selected', () => {
    mockStore(defaultState());
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Dungeon Master'));
    expect(screen.getByText('Create Game')).toBeInTheDocument();
  });

  it('rejects quick join with an empty name', () => {
    mockStore(defaultState());
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Player'));
    const roomInput = screen.getByPlaceholderText('Room Code');
    fireEvent.change(roomInput, { target: { value: 'ABCD' } });
    const quickJoinButton = screen.getByRole('button', { name: /Quick Join/i });
    expect(quickJoinButton).toBeDisabled();
  });

  it('quick joins a room as a guest and navigates into the game', async () => {
    const joinRoomWithCode = vi.fn().mockResolvedValue('ABCD');
    mockStore(defaultState({ joinRoomWithCode }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'guest-1', name: 'Aria' }),
    });
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Player'));
    fireEvent.change(screen.getByPlaceholderText('Your adventurer name'), {
      target: { value: 'Aria' },
    });
    fireEvent.change(screen.getByPlaceholderText('Room Code'), {
      target: { value: 'abcd' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Quick Join/i }));

    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledWith('ABCD'));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/guest-users',
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/lobby/game/ABCD'),
    );
  });

  it('shows an error when quick join guest creation fails', async () => {
    mockStore(defaultState());
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Player'));
    fireEvent.change(screen.getByPlaceholderText('Your adventurer name'), {
      target: { value: 'Aria' },
    });
    fireEvent.change(screen.getByPlaceholderText('Room Code'), {
      target: { value: 'ABCD' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Quick Join/i }));

    expect(
      await screen.findByText('Failed to create guest user'),
    ).toBeInTheDocument();
  });

  it('quick joins directly for an authenticated user without creating a guest', async () => {
    const joinRoomWithCode = vi.fn().mockResolvedValue('WXYZ');
    mockStore(
      defaultState({
        isAuthenticated: true,
        user: { name: 'Bram' },
        joinRoomWithCode,
      }),
    );
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Player'));
    fireEvent.change(screen.getByPlaceholderText('Your adventurer name'), {
      target: { value: 'Bram' },
    });
    fireEvent.change(screen.getByPlaceholderText('Room Code'), {
      target: { value: 'wxyz' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Quick Join/i }));

    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledWith('WXYZ'));
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/guest-users',
      expect.anything(),
    );
  });

  it('sets up a player as a guest via Character Setup', async () => {
    const setUser = vi.fn();
    mockStore(defaultState({ setUser }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'guest-2', name: 'Finn' }),
    });
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Player'));
    fireEvent.change(screen.getByPlaceholderText('Your adventurer name'), {
      target: { value: 'Finn' },
    });
    fireEvent.click(screen.getByText('Character Setup'));

    await waitFor(() =>
      expect(setUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'player' }),
      ),
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/lobby/player-setup'),
    );
  });

  it('requires a campaign selection before an authenticated DM can create a game', async () => {
    mockStore(defaultState({ isAuthenticated: true, user: { name: 'DM' } }));
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { container } = render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Dungeon Master'));
    fireEvent.change(screen.getByPlaceholderText('Your adventurer name'), {
      target: { value: 'DM' },
    });
    await screen.findByText(/No campaigns yet/);
    // The "Create Game" button is disabled while a campaign is unselected
    // (see the `disabled` expression in LinearWelcomePage), so this submits
    // the form directly -- e.g. pressing Enter in the name field -- to reach
    // handleDMSetup's own redundant validation instead of the disabled button.
    fireEvent.submit(container.querySelector('form.form-section')!);
    expect(
      await screen.findByText('Please select a campaign or create a new one'),
    ).toBeInTheDocument();
  });

  it('creates a game as a guest DM without requiring a campaign', async () => {
    const setUser = vi.fn();
    mockStore(defaultState({ setUser }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'guest-3', name: 'Hostly' }),
    });
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Dungeon Master'));
    fireEvent.change(screen.getByPlaceholderText('Your adventurer name'), {
      target: { value: 'Hostly' },
    });
    fireEvent.click(screen.getByText('Create Game'));

    await waitFor(() =>
      expect(setUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'host' }),
      ),
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/lobby/dm-setup'),
    );
  });

  it('populates the campaign dropdown for an authenticated DM', async () => {
    mockStore(defaultState({ isAuthenticated: true, user: { name: 'DM' } }));
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/campaigns')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'c1', name: 'Curse of Strahd' }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Dungeon Master'));
    expect(await screen.findByText('Curse of Strahd')).toBeInTheDocument();
  });

  it('shows a load error when fetching campaigns fails', async () => {
    mockStore(defaultState({ isAuthenticated: true, user: { name: 'DM' } }));
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Dungeon Master'));
    expect(await screen.findByText('Failed to load campaigns')).toBeInTheDocument();
  });

  it('populates the character dropdown for an authenticated player', async () => {
    mockStore(defaultState({ isAuthenticated: true, user: { name: 'Reader' } }));
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/characters')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'ch1', name: 'Elowen', data: { class: 'Ranger' } },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Player', { selector: 'h3' }));
    expect(await screen.findByText('Elowen (Ranger)')).toBeInTheDocument();
  });

  it('signs in with local credentials and navigates to the dashboard', async () => {
    const login = vi.fn();
    mockStore(defaultState({ login }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.test', displayName: 'A' }),
    });
    const { container } = render(<LinearWelcomePage />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'a@b.test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password1' },
    });
    // The account form lives inside a native <div popover>. testing-library's
    // getByRole excludes it from the accessibility tree until its
    // declarative invoker button opens it (jsdom itself has no Popover API,
    // so it never actually hides the content) -- query by DOM structure
    // instead of role to reach the real submit button.
    fireEvent.click(container.querySelector('.account-form button.action-btn')!);

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'player', connected: true }),
      ),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      '/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a server-provided error message when sign-in fails', async () => {
    mockStore(defaultState());
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    });
    const { container } = render(<LinearWelcomePage />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'a@b.test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(container.querySelector('.account-form button.action-btn')!);

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('reports an unreachable server distinctly from an auth failure', async () => {
    mockStore(defaultState());
    mockFetch.mockRejectedValue(new Error('network down'));
    const { container } = render(<LinearWelcomePage />);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'a@b.test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'x' },
    });
    fireEvent.click(container.querySelector('.account-form button.action-btn')!);

    expect(
      await screen.findByText(/Unable to reach the server/),
    ).toBeInTheDocument();
  });

  it('toggles between sign-in and create-account mode', () => {
    mockStore(defaultState());
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText("Don't have an account? Create one"));
    expect(screen.getByText('Create Account', { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your name in Nexus')).toBeInTheDocument();
  });

  it('shows account actions and logs out an authenticated user', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockStore(
      defaultState({ isAuthenticated: true, user: { name: 'Signed Player' }, logout }),
    );
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText('Log out'));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/lobby'));
  });

  it('navigates to an existing session room on mount', () => {
    mockStore(defaultState({ session: { roomCode: 'EXIS' } }));
    render(<LinearWelcomePage />);
    expect(mockNavigate).toHaveBeenCalledWith('/lobby/game/EXIS');
  });

  it('opens the About modal from the build badge', () => {
    mockStore(defaultState());
    render(<LinearWelcomePage />);
    fireEvent.click(screen.getByText(/Build /));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('development tools', () => {
    it('stays hidden when neither dev mode nor the server flag is on', () => {
      devModeRef.value = false;
      devToolsEnabledRef.value = false;
      mockStore(defaultState());
      render(<LinearWelcomePage />);
      expect(screen.queryByText('⚡ Development Tools')).not.toBeInTheDocument();
    });

    it('exposes Quick DM and Quick Player but no admin entry points in dev mode', () => {
      devModeRef.value = true;
      mockStore(defaultState());
      render(<LinearWelcomePage />);
      expect(screen.getByText('⚡ Development Tools')).toBeInTheDocument();
      fireEvent.click(screen.getByText('🎮 Quick DM'));
      fireEvent.click(screen.getByText('👤 Quick Player'));
      expect(screen.queryByText(/Admin Panel/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Codex Admin UI/)).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalledWith('/admin');
    });

    it('runs the server-gated Quick Start seeding flow', () => {
      devModeRef.value = true;
      devToolsEnabledRef.value = true;
      mockStore(defaultState());
      render(<LinearWelcomePage />);
      fireEvent.click(screen.getByText('⚡ Quick Start'));
      expect(mockQuickStart.start).toHaveBeenCalled();
    });

    it('surfaces a quick-start seeding error', () => {
      devModeRef.value = true;
      devToolsEnabledRef.value = true;
      mockQuickStart.error = 'Quick start failed during seeding: boom';
      mockStore(defaultState());
      render(<LinearWelcomePage />);
      expect(
        screen.getByText('Quick start failed during seeding: boom'),
      ).toBeInTheDocument();
    });
  });
});

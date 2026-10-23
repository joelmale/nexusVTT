import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleJoinPage } from '@/components/simple-player/SimpleJoinPage';
import { useGameStore } from '@/stores/gameStore';
import { UI_MODE_STORAGE_KEY } from '@/utils/simplePlayerMode';

const mockNavigate = vi.hoisted(() => vi.fn());
const routeParams = vi.hoisted(() => ({ roomCode: 'abcd' }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeParams,
}));

vi.mock('@/stores/gameStore', () => ({
  useGameStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));

interface MockState {
  isAuthenticated: boolean;
  setUser: ReturnType<typeof vi.fn>;
  joinRoomWithCode: ReturnType<typeof vi.fn>;
  autoPlacePlayerToken: ReturnType<typeof vi.fn>;
}

function mockStore(overrides: Partial<MockState> = {}): MockState {
  const state: MockState = {
    isAuthenticated: false,
    setUser: vi.fn(),
    joinRoomWithCode: vi.fn().mockResolvedValue('ABCD'),
    autoPlacePlayerToken: vi.fn(),
    ...overrides,
  };
  vi.mocked(useGameStore).mockImplementation(((
    selector: (s: MockState) => unknown,
  ) => selector(state)) as unknown as typeof useGameStore);
  vi.mocked(useGameStore.getState).mockReturnValue(
    state as unknown as ReturnType<typeof useGameStore.getState>,
  );
  return state;
}

function typeName(value: string) {
  fireEvent.change(screen.getByLabelText('Your name'), {
    target: { value },
  });
}

describe('SimpleJoinPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    routeParams.roomCode = 'abcd';
    mockNavigate.mockReset();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'g1', name: 'Mia' }),
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the room code from the link', () => {
    mockStore();
    render(<SimpleJoinPage />);
    expect(screen.getByRole('heading', { name: 'ABCD' })).toBeInTheDocument();
  });

  it('joins as a guest, stores simple mode, places a token and navigates', async () => {
    const state = mockStore();
    render(<SimpleJoinPage />);
    typeName('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Join game' }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/lobby/game/ABCD'),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/guest-users',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(state.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'g1', type: 'player', isSpectator: false }),
    );
    expect(state.joinRoomWithCode).toHaveBeenCalledWith('ABCD');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('simple');

    vi.advanceTimersByTime(500);
    expect(state.autoPlacePlayerToken).toHaveBeenCalledWith('Mia');
  });

  it('joins as a spectator without placing a token', async () => {
    const state = mockStore({ isAuthenticated: true });
    render(<SimpleJoinPage />);
    typeName('Dad');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Just watching' }));
    fireEvent.click(screen.getByRole('button', { name: 'Join game' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
    expect(state.setUser).toHaveBeenCalledWith({
      name: 'Dad',
      type: 'player',
      isSpectator: true,
    });
    vi.advanceTimersByTime(500);
    expect(state.autoPlacePlayerToken).not.toHaveBeenCalled();
  });

  it('requires a name', () => {
    const state = mockStore();
    render(<SimpleJoinPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Join game' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please enter your name',
    );
    expect(state.joinRoomWithCode).not.toHaveBeenCalled();
  });

  it('explains when the room is not running', async () => {
    mockStore({
      joinRoomWithCode: vi.fn().mockRejectedValue(new Error('Room not found')),
    });
    render(<SimpleJoinPage />);
    typeName('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This game isn't running right now",
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('reports a guest-user failure the same way', async () => {
    mockStore();
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    render(<SimpleJoinPage />);
    typeName('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Join game' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('rejects a malformed link', () => {
    routeParams.roomCode = 'not-a-code';
    mockStore();
    render(<SimpleJoinPage />);
    expect(
      screen.getByRole('heading', { name: 'Link not recognised' }),
    ).toBeInTheDocument();
  });
});

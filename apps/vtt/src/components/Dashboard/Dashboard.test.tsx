import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { joinRoomWithCode, createGameRoom, navigate } = vi.hoisted(() => ({
  joinRoomWithCode: vi.fn(),
  createGameRoom: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/stores/gameStore', () => {
  const state = {
    user: { id: 'u1', name: 'Joel' },
    isAuthenticated: true,
    authChecked: true,
    joinRoomWithCode,
    createGameRoom,
  };
  return {
    useGameStore: (selector: (s: typeof state) => unknown) => selector(state),
  };
});

vi.mock('@/hooks', () => ({
  useCharacterCreationLauncher: () => ({
    startCharacterCreation: vi.fn(),
    LauncherComponent: null,
  }),
}));
vi.mock('@/services/devSeed', () => ({ clearAll: vi.fn(), seedData: vi.fn() }));
vi.mock('@/utils/devToolsFlag', () => ({ useDevToolsEnabled: () => false }));
vi.mock('./organisms/DocumentSidebar', () => ({
  DocumentSidebar: () => <div data-testid="sidebar" />,
}));
vi.mock('@/components/DocumentViewer', () => ({
  DocumentViewer: () => null,
}));

import { Dashboard } from '../Dashboard';
import { formatRelative } from '@/utils/formatRelative';
import { WaxSeal } from './atoms/WaxSeal';
import { TableCard } from './molecules/TableCard';
import { getPrepLine } from './tableAction';
import { JoinTableModal } from './organisms/JoinTableModal';
import type { TableRecord } from './types';
import type {
  DashboardSummary,
  TableSummary,
} from '../../../shared/dashboard';

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const table = (overrides: Partial<TableSummary>): TableSummary => ({
  id: 't',
  name: 'Table',
  description: null,
  role: 'dm',
  dmName: 'Joel',
  roomCode: null,
  status: 'never',
  lastPlayedAt: null,
  roster: [],
  ...overrides,
});

const runStrahd = table({
  id: 'run-1',
  name: 'Curse of Strahd',
  description: 'Dark tidings gather over Barovia.',
  role: 'dm',
  roomCode: 'ABCD',
  status: 'open',
  lastPlayedAt: daysAgo(3),
  roster: [
    { userName: 'Alice Archer', characterName: 'Brienne', online: true },
    { userName: 'Bob', online: true },
    { userName: 'Carol', online: false },
  ],
  prep: { npcs: 4, encounters: 2, nextSession: 'The Amber Temple' },
});

const runIdle = table({
  id: 'run-2',
  name: 'Old Table',
  role: 'dm',
  status: 'never',
});

const joinedOpen = table({
  id: 'j-open',
  name: 'Waterdeep Heist',
  description: 'A daring caper.',
  role: 'player',
  dmName: 'Dana',
  roomCode: 'WXYZ',
  status: 'open',
  lastPlayedAt: daysAgo(1),
  myCharacterId: 'ch-2',
  roster: [{ userName: 'Dana', online: true }],
});

const joinedResting = table({
  id: 'j-rest',
  name: 'Sunken Citadel',
  role: 'player',
  dmName: 'Evan',
  roomCode: 'QRST',
  status: 'resting',
  lastPlayedAt: daysAgo(10),
  myCharacterId: 'ch-1',
});

const heroes: DashboardSummary['heroes'] = [
  {
    id: 'ch-1',
    name: 'Nameless One',
    data: { level: 3 },
    boundCampaignId: null,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ch-2',
    name: 'Brienne',
    data: {
      level: 5,
      race: 'Elf',
      class: 'Wizard',
      stats: {
        strength: 8,
        dexterity: 14,
        constitution: 12,
        intelligence: 17,
        wisdom: 10,
        charisma: 11,
      },
    },
    boundCampaignId: 'j-open',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ch-3',
    name: 'Shielded',
    data: {
      level: 2,
      class: 'Fighter',
      armorClass: 17,
      passivePerception: 14,
      hp: { current: 18, max: 20 },
    },
    boundCampaignId: null,
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const fullSummary: DashboardSummary = {
  runs: [runStrahd, runIdle],
  joined: [joinedOpen, joinedResting],
  heroes,
  lastTable: { campaignId: 'run-1', role: 'dm' },
};

const emptySummary: DashboardSummary = { runs: [], joined: [], heroes: [] };

const mockFetch = (summary: DashboardSummary) => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => summary,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

const cardFor = (name: string): HTMLElement => {
  const card = screen
    .getByRole('heading', { name, level: 3 })
    .closest('article');
  if (!card) throw new Error(`No card for ${name}`);
  return card;
};

const stubMatchMedia = (reduce: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  joinRoomWithCode.mockReset().mockResolvedValue(undefined);
  createGameRoom.mockReset().mockResolvedValue('ABCD');
  navigate.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Dashboard data and honesty', () => {
  it('loads /api/dashboard instead of the two list endpoints', async () => {
    const fetchMock = mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne' });
    const urls = (fetchMock.mock.calls as unknown as Array<[string]>).map(
      (c) => c[0],
    );
    expect(urls).toContain('/api/dashboard');
    expect(urls).not.toContain('/api/campaigns');
    expect(urls).not.toContain('/api/characters');
  });

  it('does not invent race, class or an Active Hero block', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Nameless One' });
    expect(screen.queryByText(/Human/)).toBeNull();
    expect(screen.queryByText(/Active Hero/)).toBeNull();
    expect(within(cardFor('Nameless One')).getByText('Lvl 3')).toBeVisible();
    expect(screen.getByText('Lvl 5 Elf Wizard')).toBeInTheDocument();
  });

  it('labels the hero action "Play as {name}" and hides stub actions', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne' });
    expect(
      screen.getByRole('button', { name: /Play as Brienne/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Start Session')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Import/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull();
  });

  it('uses the new header copy without count badges', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    expect(
      await screen.findByText('The Table Awaits, Joel'),
    ).toBeInTheDocument();
    expect(screen.getByText('Your tables & heroes')).toBeInTheDocument();
    expect(screen.queryByText(/Beta/)).toBeNull();
    expect(screen.queryByText('Campaigns')).toBeNull();
    expect(screen.queryByText('Characters')).toBeNull();
  });
});

describe('TableCard by role and status', () => {
  it('shows prep, roster and Open Table for a DM, and opens the table', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Curse of Strahd', level: 3 });
    const card = within(cardFor('Curse of Strahd'));

    expect(card.getByText('Dungeon Master')).toBeInTheDocument();
    expect(card.getByText('Table open')).toBeInTheDocument();
    expect(
      card.getByText('4 NPCs · 2 encounters · Next: The Amber Temple'),
    ).toBeInTheDocument();
    expect(card.getByText(/^Played 3 days ago$/)).toBeInTheDocument();
    expect(
      card.getByLabelText('Alice Archer as Brienne, online'),
    ).toBeInTheDocument();
    expect(card.getByLabelText('Carol, offline')).toBeInTheDocument();

    fireEvent.click(card.getByRole('button', { name: 'Open Table' }));
    await waitFor(() => expect(createGameRoom).toHaveBeenCalledTimes(1));
    expect(createGameRoom.mock.calls[0][0]).toMatchObject({
      campaignId: 'run-1',
      preferredRoomCode: 'ABCD',
    });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/lobby/game/ABCD'),
    );
    expect(joinRoomWithCode).not.toHaveBeenCalled();
  });

  it('offers Delete to DMs only, in the overflow menu', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Waterdeep Heist', level: 3 });
    expect(
      within(cardFor('Waterdeep Heist')).queryByRole('button', {
        name: /More actions/,
      }),
    ).toBeNull();
    fireEvent.click(
      within(cardFor('Curse of Strahd')).getByRole('button', {
        name: 'More actions for Curse of Strahd',
      }),
    );
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('renames a DM table through the overflow menu', async () => {
    const fetchMock = mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Curse of Strahd', level: 3 });
    fireEvent.click(
      within(cardFor('Curse of Strahd')).getByRole('button', {
        name: 'More actions for Curse of Strahd',
      }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const dialog = within(screen.getByRole('dialog'));
    const nameInput = dialog.getByLabelText('Campaign Name');
    expect(nameInput).toHaveValue('Curse of Strahd');
    fireEvent.change(nameInput, { target: { value: 'Curse of Strahd II' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const put = (
      fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>
    ).find(([, init]) => init?.method === 'PUT');
    expect(put?.[0]).toBe('/api/campaigns/run-1');
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
      name: 'Curse of Strahd II',
    });
  });

  it('rejoins an open player table with the bound hero', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Waterdeep Heist', level: 3 });
    const card = within(cardFor('Waterdeep Heist'));
    expect(card.getByText('Adventurer')).toBeInTheDocument();
    expect(card.getByText('Run by Dana')).toBeInTheDocument();
    expect(card.getByText('Playing')).toBeInTheDocument();

    fireEvent.click(card.getByRole('button', { name: 'Rejoin' }));
    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledTimes(1));
    expect(joinRoomWithCode.mock.calls[0][0]).toBe('WXYZ');
    expect(joinRoomWithCode.mock.calls[0][1]).toMatchObject({ id: 'ch-2' });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/lobby/game/WXYZ'),
    );
    expect(createGameRoom).not.toHaveBeenCalled();
  });

  it('disables a resting player table with "Waiting for the DM"', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Sunken Citadel', level: 3 });
    const card = within(cardFor('Sunken Citadel'));
    expect(card.getByText('Resting')).toBeInTheDocument();
    const button = card.getByRole('button', { name: 'Waiting for the DM' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(joinRoomWithCode).not.toHaveBeenCalled();
  });

  it('opens the hero picker with the code prefilled when no hero is known', async () => {
    const orphan = { ...joinedOpen, myCharacterId: undefined };
    mockFetch({ ...fullSummary, joined: [orphan] });
    renderDashboard();
    await screen.findByRole('heading', { name: 'Waterdeep Heist', level: 3 });
    fireEvent.click(
      within(cardFor('Waterdeep Heist')).getByRole('button', { name: 'Rejoin' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Who is joining table WXYZ?')).toBeVisible();
    expect(joinRoomWithCode).not.toHaveBeenCalled();
  });

  it('shows at most five roster avatars then +N, and a drop-cap description', () => {
    const record: TableRecord = {
      id: 'x',
      name: 'Crowded',
      subtitle: 'Many hands.',
      role: 'dm',
      dmName: 'Joel',
      roomCode: 'ABCD',
      status: 'open',
      lastPlayedAt: null,
      roster: Array.from({ length: 7 }, (_, i) => ({
        userName: `Player ${i}`,
        online: i % 2 === 0,
      })),
    };
    render(<TableCard table={record} onAction={vi.fn()} />);
    const list = screen.getByRole('list', { name: 'At the table' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(within(list).getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('Never played')).toBeInTheDocument();
    expect(screen.getByText('Many hands.').className).toContain(
      'first-letter:',
    );
  });

  it('builds the prep line from the parts that exist', () => {
    const base = { ...(runStrahd as unknown as TableRecord) };
    expect(
      getPrepLine({ ...base, prep: { npcs: 0, encounters: 1 } }),
    ).toBe('1 encounter');
    expect(getPrepLine({ ...base, prep: { npcs: 0, encounters: 0 } })).toBe('');
    expect(getPrepLine({ ...base, prep: undefined })).toBe('');
  });
});

describe('WaxSeal', () => {
  it('spells the status out in text', () => {
    const { rerender, container } = render(<WaxSeal status="open" />);
    expect(screen.getByText('Table open')).toBeVisible();
    rerender(<WaxSeal status="resting" />);
    expect(screen.getByText('Resting')).toBeVisible();
    rerender(<WaxSeal status="never" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ContinueBand', () => {
  const stubClipboard = () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    return writeText;
  };

  it('shows the last table with role, seal, code and head count', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    await band.findByText('Curse of Strahd');
    expect(band.getByText('Dungeon Master')).toBeInTheDocument();
    expect(band.getByText('Table open')).toBeInTheDocument();
    expect(band.getByText('Played 3 days ago')).toBeInTheDocument();
    expect(band.getByTestId('band-room-code')).toHaveTextContent('ABCD');
    expect(band.getByText('2 at the table')).toBeInTheDocument();
  });

  it('copies the room code and announces it', async () => {
    const writeText = stubClipboard();
    mockFetch(fullSummary);
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    fireEvent.click(await band.findByRole('button', { name: 'Copy room code ABCD' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ABCD'));
    expect(await band.findByText('Copied')).toBeInTheDocument();
    expect(band.getByRole('status')).toHaveTextContent('Copied');
  });

  it('resumes a DM table with the same handler as the card', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    fireEvent.click(await band.findByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(createGameRoom).toHaveBeenCalledTimes(1));
    expect(createGameRoom.mock.calls[0][0]).toMatchObject({
      campaignId: 'run-1',
      preferredRoomCode: 'ABCD',
    });
  });

  it('rejoins a player table', async () => {
    mockFetch({
      ...fullSummary,
      lastTable: { campaignId: 'j-open', role: 'player' },
    });
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    expect(await band.findByText('Adventurer')).toBeInTheDocument();
    fireEvent.click(band.getByRole('button', { name: 'Rejoin' }));
    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledTimes(1));
    expect(joinRoomWithCode.mock.calls[0][1]).toMatchObject({ id: 'ch-2' });
  });

  it('disables Rejoin while the DM has not opened the table', async () => {
    mockFetch({
      ...fullSummary,
      lastTable: { campaignId: 'j-rest', role: 'player' },
    });
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    expect(
      await band.findByRole('button', { name: 'Waiting for the DM' }),
    ).toBeDisabled();
  });

  it('shows a welcome and the join slots when there is no last table', async () => {
    mockFetch({ ...fullSummary, lastTable: undefined });
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    expect(band.getByText('Welcome, traveler')).toBeInTheDocument();
    expect(band.getByRole('group', { name: 'Room code' })).toBeInTheDocument();
    expect(band.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('opens the join modal at the hero step with the typed code', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    const find = band.getByRole('button', { name: 'Find table' });
    expect(find).toBeDisabled();
    fireEvent.change(band.getByLabelText('Room code character 1 of 4'), {
      target: { value: 'ab12' },
    });
    expect(band.getByLabelText('Room code character 4 of 4')).toHaveValue('2');
    fireEvent.click(find);

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Who is joining table AB12?')).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: /^Brienne/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Join as Brienne' }));
    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledTimes(1));
    expect(joinRoomWithCode.mock.calls[0][0]).toBe('AB12');
    expect(joinRoomWithCode.mock.calls[0][1]).toMatchObject({ id: 'ch-2' });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/lobby/game/AB12'),
    );
  });

  it('joins straight away when there are no heroes to choose from', async () => {
    mockFetch({ ...fullSummary, heroes: [], lastTable: undefined });
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    fireEvent.change(band.getByLabelText('Room code character 1 of 4'), {
      target: { value: 'ab12' },
    });
    fireEvent.click(band.getByRole('button', { name: 'Find table' }));

    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledTimes(1));
    expect(joinRoomWithCode.mock.calls[0][0]).toBe('AB12');
    expect(joinRoomWithCode.mock.calls[0][1]).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/lobby/game/AB12'),
    );
  });
});

describe('HeroCard', () => {
  it('hides missing AC and passive Perception, and shows them when present', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Shielded', level: 3 });
    const brienne = within(cardFor('Brienne'));
    expect(brienne.queryByText(/^AC /)).toBeNull();
    expect(brienne.queryByText(/^PP /)).toBeNull();
    const shielded = within(cardFor('Shielded'));
    expect(shielded.getByText('AC 17')).toBeInTheDocument();
    expect(shielded.getByText('PP 14')).toBeInTheDocument();
    expect(shielded.getByText('HP 18/20')).toBeInTheDocument();
  });

  it('names the bound table, or says the hero is not at one', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne', level: 3 });
    expect(within(cardFor('Brienne')).getByText('Waterdeep Heist')).toBeVisible();
    expect(
      within(cardFor('Nameless One')).getByText('Not at a table'),
    ).toBeVisible();
  });

  it('reveals the ability grid behind a disclosure, only when stats exist', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne', level: 3 });
    const brienne = within(cardFor('Brienne'));
    const toggle = brienne.getByRole('button', { name: 'Show abilities' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(brienne.queryByText('STR')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(brienne.getByText('STR')).toBeVisible();
    expect(brienne.getByText('-1')).toBeVisible();

    expect(
      within(cardFor('Nameless One')).queryByRole('button', {
        name: /abilities/,
      }),
    ).toBeNull();
  });
});

describe('Sections', () => {
  it('hides "Tables You\'ve Joined" when there are none', async () => {
    mockFetch({ ...fullSummary, joined: [] });
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne', level: 3 });
    expect(
      screen.getByRole('region', { name: 'Tables You Run' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: "Tables You've Joined" }),
    ).toBeNull();
  });

  it('keeps "Tables You Run" reachable for a hero-only account', async () => {
    mockFetch({ ...emptySummary, heroes });
    renderDashboard();
    const region = within(
      await screen.findByRole('region', { name: 'Tables You Run' }),
    );
    expect(region.getByText(/No tables yet/)).toBeInTheDocument();
    fireEvent.click(region.getByRole('button', { name: /New Campaign/ }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('New Campaign');
  });

  it('shows the first-run chooser when there is nothing yet', async () => {
    mockFetch(emptySummary);
    renderDashboard();
    expect(await screen.findByText("I'm here to play")).toBeInTheDocument();
    expect(screen.getByText("I'm running a game")).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tables You Run' })).toBeNull();
  });
});

describe('JoinTableModal flow', () => {
  it('sanitises the typed code and enters the lobby without heroes', async () => {
    mockFetch(emptySummary);
    renderDashboard();
    fireEvent.click(await screen.findByRole('button', { name: /Join a table/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Join a Table');

    const input = within(screen.getByRole('dialog')).getByLabelText('Room code');
    expect(input).toHaveAttribute('maxLength', '4');
    fireEvent.change(input, { target: { value: 'ab12xyz' } });
    expect(input).toHaveValue('AB12');
    fireEvent.click(screen.getByRole('button', { name: 'Enter Lobby' }));
    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledTimes(1));
    expect(joinRoomWithCode.mock.calls[0][0]).toBe('AB12');
    expect(joinRoomWithCode.mock.calls[0][1]).toBeNull();
  });

  it('allows joining without a hero from the hero step', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    const band = within(await screen.findByRole('region', { name: 'Continue' }));
    fireEvent.change(await band.findByLabelText('Room code character 1 of 4'), {
      target: { value: 'WXYZ' },
    });
    fireEvent.click(band.getByRole('button', { name: 'Find table' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Join without a hero' }),
    );
    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledTimes(1));
    expect(joinRoomWithCode.mock.calls[0][0]).toBe('WXYZ');
    expect(joinRoomWithCode.mock.calls[0][1]).toBeNull();
  });

  it('skips the hero step when opened via Play as and closes on Escape', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne', level: 3 });
    fireEvent.click(screen.getByRole('button', { name: /Play as Brienne/ }));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Room code'), {
      target: { value: 'QRST' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter Lobby' }));
    await waitFor(() => expect(joinRoomWithCode).toHaveBeenCalledTimes(1));
    expect(joinRoomWithCode.mock.calls[0][1]).toMatchObject({ id: 'ch-2' });

    fireEvent.click(screen.getByRole('button', { name: /Play as Brienne/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the New Campaign dialog and closes it on Escape', async () => {
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne', level: 3 });
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/ }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('New Campaign');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  const modalHeroes = [
    { id: 'h1', name: 'Brienne', level: 5, updatedAt: '' },
  ];

  it('starts at the hero step for a full prefilled code', () => {
    render(
      <JoinTableModal
        characters={modalHeroes}
        initialRoomCode="abcd"
        onJoin={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Who is joining table ABCD?')).toBeVisible();
  });

  it('keeps the code step, prefilled, when there is no hero to pick', () => {
    render(
      <JoinTableModal
        characters={[]}
        initialRoomCode="abcd"
        onJoin={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(within(screen.getByRole('dialog')).getByLabelText('Room code')).toHaveValue('ABCD');
  });
});

describe('Reduced motion', () => {
  it('renders embers normally, in the continue band only', async () => {
    stubMatchMedia(false);
    mockFetch(fullSummary);
    renderDashboard();
    const band = await screen.findByRole('region', { name: 'Continue' });
    await screen.findByRole('heading', { name: 'Brienne', level: 3 });
    const embers = screen.getAllByTestId('ember');
    expect(embers.length).toBeGreaterThan(0);
    embers.forEach((ember) => expect(band).toContainElement(ember));
  });

  it('renders no embers under prefers-reduced-motion', async () => {
    stubMatchMedia(true);
    mockFetch(fullSummary);
    renderDashboard();
    await screen.findByRole('heading', { name: 'Brienne', level: 3 });
    expect(screen.queryAllByTestId('ember')).toHaveLength(0);
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-10-22T00:00:00Z');
  it('formats common spans', () => {
    expect(formatRelative('2026-10-19T00:00:00Z', now)).toBe('3 days ago');
    expect(formatRelative('2026-10-08T00:00:00Z', now)).toBe('2 weeks ago');
    expect(formatRelative('2026-10-21T23:59:50Z', now)).toBe('just now');
    expect(formatRelative(null, now)).toBe('');
    expect(formatRelative('nope', now)).toBe('');
  });
});

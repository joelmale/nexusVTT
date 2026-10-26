import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';
import type { UseSimplePlayerModeReturn } from '@/hooks/useSimplePlayerMode';
import type { SimplePlayerSession } from '@/components/simple-player/useSimplePlayerSession';

const sessionRef = vi.hoisted(() => ({
  current: undefined as unknown as SimplePlayerSession,
}));
vi.mock('@/components/simple-player/useSimplePlayerSession', () => ({
  useSimplePlayerSession: () => sessionRef.current,
}));
vi.mock('@/components/simple-player/SimpleMapViewport', () => ({
  SimpleMapViewport: () => <div data-testid="map-viewport" />,
}));
const creator = vi.hoisted(() => ({
  complete: undefined as
    ((id: string, character?: Character) => void) | undefined,
  cancel: undefined as (() => void) | undefined,
}));
vi.mock('@/components/SharedCharacterCreator', () => ({
  SharedCharacterCreator: (props: {
    onComplete: (id: string, character?: Character) => void;
    onCancel: () => void;
  }) => {
    creator.complete = props.onComplete;
    creator.cancel = props.onCancel;
    return <div data-testid="character-creator" />;
  },
}));
vi.mock('@/hooks/useTheme', () => ({ useThemeSync: vi.fn() }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotionSync: vi.fn() }));
vi.mock('@/utils/colorSchemes', () => ({ applyColorScheme: vi.fn() }));
vi.mock('@/services/themeManager', () => ({ switchTheme: vi.fn() }));
vi.mock('@/stores/gameStore', () => ({
  useSettings: () => ({ enableGlassmorphism: true }),
  useColorScheme: () => 'default',
}));
const setActiveCharacter = vi.hoisted(() => vi.fn());
vi.mock('@/stores/characterStore', () => ({
  useCharacterStore: { getState: () => ({ setActiveCharacter }) },
}));

import { SimplePlayerShell } from '@/components/simple-player/SimplePlayerShell';

const aria = {
  id: 'c1',
  name: 'Aria',
  hitPoints: 20,
  maxHitPoints: 30,
  playerId: 'p1',
  abilities: {},
  skills: {},
} as unknown as Character;

function session(
  overrides: Partial<SimplePlayerSession> = {},
): SimplePlayerSession {
  return {
    userId: 'p1',
    userName: 'Mia',
    isSpectator: false,
    scene: { id: 's1' } as SimplePlayerSession['scene'],
    myCharacter: aria,
    sessionCharacters: [aria],
    ownedCharacterIds: new Set(['c1']),
    combat: {
      isInCombat: false,
      round: 0,
      combatants: [],
      isMyTurn: false,
    },
    connectionState: 'connected',
    visibleRolls: [],
    handouts: [],
    spotlight: undefined,
    weapons: [],
    pendingIntent: undefined,
    hostAway: false,
    adjustHp: vi.fn().mockResolvedValue(undefined),
    endTurn: vi.fn().mockResolvedValue(undefined),
    deathSave: vi.fn().mockResolvedValue(undefined),
    claimCharacter: vi
      .fn()
      .mockResolvedValue({ intentId: 'i', status: 'applied' }),
    submitCharacter: vi
      .fn()
      .mockResolvedValue({ intentId: 'i', status: 'applied' }),
    roll: vi.fn(),
    openHandout: vi.fn(),
    dismissSpotlight: vi.fn(),
    leave: vi.fn(),
    ...overrides,
  };
}

function mode(
  overrides: Partial<UseSimplePlayerModeReturn> = {},
): UseSimplePlayerModeReturn {
  return {
    uiMode: 'simple',
    isSimpleMode: true,
    isTabletSplitView: false,
    canSplitView: false,
    activeTab: 'map',
    setActiveTab: vi.fn(),
    setUiMode: vi.fn(),
    toggleUiMode: vi.fn(),
    toggleTabletSplitView: vi.fn(),
    buildSimpleInviteUrl: (code) => `/play/${code}`,
    ...overrides,
  };
}

describe('SimplePlayerShell', () => {
  beforeEach(() => {
    sessionRef.current = session();
    setActiveCharacter.mockReset();
  });

  it('shows the map with a bottom tab bar on phones', () => {
    const m = mode();
    render(<SimplePlayerShell mode={m} />);
    expect(screen.getByTestId('map-viewport')).toBeVisible();
    expect(screen.getByText('Aria')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'My Hero' }));
    expect(m.setActiveTab).toHaveBeenCalledWith('hero');
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the map mounted while another tab is open', () => {
    render(<SimplePlayerShell mode={mode({ activeTab: 'hero' })} />);
    expect(screen.getByTestId('map-viewport')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Aria character sheet' }),
    ).toBeInTheDocument();
  });

  it('shows the dice drawer on the Rolls tab and rolls through the session', () => {
    render(<SimplePlayerShell mode={mode({ activeTab: 'rolls' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add d20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll 1d20' }));
    expect(sessionRef.current.roll).toHaveBeenCalledWith('1d20', 'none');
  });

  it('renders map and side panel together in tablet split view', () => {
    const m = mode({
      isTabletSplitView: true,
      canSplitView: true,
      activeTab: 'hero',
    });
    render(<SimplePlayerShell mode={m} />);
    expect(screen.getByTestId('map-viewport')).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: 'Side panel' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Rolls' }));
    expect(m.setActiveTab).toHaveBeenCalledWith('rolls');
  });

  it('waits for the DM when no scene is active', () => {
    sessionRef.current = session({ scene: null });
    render(<SimplePlayerShell mode={mode()} />);
    expect(screen.getByText(/Waiting for the DM/)).toBeInTheDocument();
  });

  it('offers mode, split view, character and leave controls in settings', () => {
    const m = mode({ canSplitView: true });
    render(<SimplePlayerShell mode={m} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Tablet Split-Screen' }),
    );
    expect(m.toggleTabletSplitView).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Full VTT' }));
    expect(m.setUiMode).toHaveBeenCalledWith('full');
    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }));
    expect(sessionRef.current.leave).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Switch Character' }));
    expect(
      screen.getByRole('dialog', { name: 'Choose your character' }),
    ).toBeInTheDocument();
  });

  it('closes the settings sheet', () => {
    render(<SimplePlayerShell mode={mode()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(
      screen.queryByRole('button', { name: 'Tablet Split-Screen' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      screen.queryByRole('dialog', { name: 'Settings' }),
    ).not.toBeInTheDocument();
  });

  it('asks a player without a character to claim one, then creates one', async () => {
    sessionRef.current = session({
      myCharacter: undefined,
      sessionCharacters: [],
    });
    render(<SimplePlayerShell mode={mode()} />);
    expect(
      screen.getByRole('dialog', { name: 'Choose your character' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Create New Character' }),
    );
    expect(await screen.findByTestId('character-creator')).toBeInTheDocument();

    creator.complete?.('new-1', { ...aria, id: 'new-1' } as Character);
    await waitFor(() =>
      expect(setActiveCharacter).toHaveBeenCalledWith('new-1'),
    );
    // SharedCharacterCreator has already completed the durable host handshake.
    expect(sessionRef.current.submitCharacter).not.toHaveBeenCalled();
    expect(screen.queryByTestId('character-creator')).not.toBeInTheDocument();
  });

  it('can cancel creation without adopting or submitting a character', async () => {
    sessionRef.current = session({
      myCharacter: undefined,
    });
    render(<SimplePlayerShell mode={mode()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Create New Character' }),
    );
    await screen.findByTestId('character-creator');
    creator.cancel?.();
    await waitFor(() =>
      expect(screen.queryByTestId('character-creator')).not.toBeInTheDocument(),
    );
    expect(setActiveCharacter).not.toHaveBeenCalled();
    expect(sessionRef.current.submitCharacter).not.toHaveBeenCalled();
  });

  it('gives spectators no hero tab, character prompt or HP controls', () => {
    sessionRef.current = session({ isSpectator: true, myCharacter: undefined });
    render(<SimplePlayerShell mode={mode({ activeTab: 'hero' })} />);
    expect(
      screen.queryByRole('button', { name: 'My Hero' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Choose your character' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Watching')).toBeInTheDocument();
    // A stale "hero" tab falls back to the dice drawer.
    expect(
      screen.getByRole('region', { name: 'Dice and rolls' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(
      screen.queryByRole('button', { name: 'Switch Character' }),
    ).not.toBeInTheDocument();
  });

  it('spotlights a revealed handout', () => {
    sessionRef.current = session({
      spotlight: { id: 'h', title: 'Harbor Map', url: '/x.png', revealedAt: 0 },
    });
    render(<SimplePlayerShell mode={mode()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close handout' }));
    expect(sessionRef.current.dismissSpotlight).toHaveBeenCalled();
  });

  it('wires death saves and character selection from the hero tab', () => {
    sessionRef.current = session({
      myCharacter: { ...aria, hitPoints: 0 } as Character,
    });
    render(<SimplePlayerShell mode={mode({ activeTab: 'hero' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Success' }));
    expect(sessionRef.current.deathSave).toHaveBeenCalledWith('success');
  });

  it('opens the claim modal from an empty hero tab', () => {
    sessionRef.current = session({ myCharacter: undefined });
    render(<SimplePlayerShell mode={mode({ activeTab: 'hero' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Select or Create Your Character' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Choose your character' }),
    ).toBeInTheDocument();
  });
});

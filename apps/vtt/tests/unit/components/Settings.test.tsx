import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from '@/components/Settings';
import { useGameStore } from '@/stores/gameStore';
import { switchTheme } from '@/services/themeManager';
import { defaultColorSchemes } from '@/utils/colorSchemes';
import type { UserSettings } from '@/types/game';

vi.mock('@/services/themeManager', () => ({
  switchTheme: vi.fn().mockResolvedValue(undefined),
}));

const mockStorage = vi.hoisted(() => ({
  getStats: vi.fn(() => ({
    entities: 12,
    relationships: 3,
    lastSaved: '2026-01-01T00:00:00.000Z',
    isDirty: false,
  })),
  downloadBackup: vi.fn(),
  uploadBackup: vi.fn().mockResolvedValue(undefined),
  forceSave: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/linearFlowStorage', () => ({
  getLinearFlowStorage: () => mockStorage,
}));

function defaultSettings(): UserSettings {
  return {
    colorScheme: defaultColorSchemes[0],
    theme: 'auto',
    enableGlassmorphism: false,
    persistOpenPanels: true,
    reducedMotion: false,
    fontSize: 'medium',
    panelLayout: 'original',
    enableSounds: true,
    diceRollSounds: true,
    notificationSounds: true,
    masterVolume: 50,
    autoRollInitiative: false,
    showOtherPlayersRolls: true,
    highlightActivePlayer: true,
    snapToGridByDefault: true,
    defaultGridSize: 60,
    diceDisappearTime: 3000,
    allowSpectators: true,
    shareCharacterSheets: false,
    logGameSessions: false,
    hpSync: true,
    maxTokensPerScene: 100,
    imageQuality: 'medium',
    enableAnimations: true,
    highContrast: false,
    screenReaderMode: false,
    keyboardNavigation: false,
    floatingToolbar: false,
  };
}

interface MockStoreState {
  settings: UserSettings;
  colorScheme: UserSettings['colorScheme'];
  updateSettings: ReturnType<typeof vi.fn>;
  setColorScheme: ReturnType<typeof vi.fn>;
  setEnableGlassmorphism: ReturnType<typeof vi.fn>;
  setPersistOpenPanels: ReturnType<typeof vi.fn>;
  resetSettings: ReturnType<typeof vi.fn>;
}

vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useSettings: vi.fn(),
  useColorScheme: vi.fn(),
}));

function mockStore(overrides: Partial<MockStoreState> = {}) {
  const state: MockStoreState = {
    settings: defaultSettings(),
    colorScheme: defaultColorSchemes[0],
    updateSettings: vi.fn(),
    setColorScheme: vi.fn(),
    setEnableGlassmorphism: vi.fn(),
    setPersistOpenPanels: vi.fn(),
    resetSettings: vi.fn(),
    ...overrides,
  };
  vi.mocked(useGameStore).mockImplementation(((
    selector?: (s: MockStoreState) => unknown,
  ) => (selector ? selector(state) : state)) as unknown as typeof useGameStore);
  return state;
}

describe('Settings', () => {
  beforeEach(async () => {
    const { useSettings, useColorScheme } = await import('@/stores/gameStore');
    vi.mocked(useSettings).mockReturnValue(defaultSettings());
    vi.mocked(useColorScheme).mockReturnValue(defaultColorSchemes[0]);
    mockStorage.getStats.mockReturnValue({
      entities: 12,
      relationships: 3,
      lastSaved: '2026-01-01T00:00:00.000Z',
      isDirty: false,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn(), href: '' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function renderSettings(overrides: Partial<MockStoreState> = {}) {
    const settings = overrides.settings ?? defaultSettings();
    const colorScheme = overrides.colorScheme ?? defaultColorSchemes[0];
    const { useSettings, useColorScheme } = await import('@/stores/gameStore');
    vi.mocked(useSettings).mockReturnValue(settings);
    vi.mocked(useColorScheme).mockReturnValue(colorScheme);
    const state = mockStore(overrides);
    const utils = render(<Settings />);
    return { ...utils, state };
  }

  it('renders every settings section', async () => {
    await renderSettings();
    expect(screen.getByText('Display')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Gameplay')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Sharing')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Experimental')).toBeInTheDocument();
    expect(screen.getByText('📦 Campaign Data')).toBeInTheDocument();
    expect(screen.getByText('📜 Credits')).toBeInTheDocument();
    // The developer-only section is gated on process.env.NODE_ENV ===
    // 'development'; the test runner sets NODE_ENV='test' (tests/setup.ts),
    // so it's never rendered here.
    expect(screen.queryByText('Developer')).not.toBeInTheDocument();
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
  });

  it('toggles glassmorphism, switches the theme, and reveals unsaved changes', async () => {
    const setEnableGlassmorphism = vi.fn();
    const { container } = await renderSettings({ setEnableGlassmorphism });
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(setEnableGlassmorphism).toHaveBeenCalledWith(true);
    await waitFor(() => expect(switchTheme).toHaveBeenCalledWith('glass'));
    expect(await screen.findByText('Save Changes')).toBeInTheDocument();
  });

  it('changes the theme mode select and updates a setting generically', async () => {
    const updateSettings = vi.fn();
    await renderSettings({ updateSettings });
    fireEvent.change(screen.getByDisplayValue('Auto (System)'), {
      target: { value: 'dark' },
    });
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark' });
    expect(await screen.findByText('Save Changes')).toBeInTheDocument();
  });

  it('parses number inputs before updating settings', async () => {
    const updateSettings = vi.fn();
    await renderSettings({ updateSettings });
    const gridSizeInput = screen.getByDisplayValue('60') as HTMLInputElement;
    fireEvent.change(gridSizeInput, { target: { value: '80' } });
    expect(updateSettings).toHaveBeenCalledWith({ defaultGridSize: 80 });
  });

  it('converts the dice-disappear-time input from seconds to milliseconds', async () => {
    const updateSettings = vi.fn();
    // diceDisappearTime is rendered as seconds (3000ms / 1000 = "3").
    await renderSettings({ updateSettings });
    const seconds = screen.getByDisplayValue('3') as HTMLInputElement;
    fireEvent.change(seconds, { target: { value: '5' } });
    expect(updateSettings).toHaveBeenCalledWith({ diceDisappearTime: 5000 });
  });

  it('disables dice-roll-sounds and the volume slider once sound is off', async () => {
    const { container } = await renderSettings({
      settings: { ...defaultSettings(), enableSounds: false },
    });
    // Both dice-roll-sounds and the master-volume slider are disabled by the
    // same `!settings.enableSounds` condition.
    const volumeSlider = container.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    expect(volumeSlider).toBeDisabled();
    // Checkbox order: Enable Glassmorphism, Reduced Motion, Enable Sounds,
    // Dice Roll Sounds, Remember Open Panels, ...
    const diceRollSoundsCheckbox = container.querySelectorAll(
      'input[type="checkbox"]',
    )[3] as HTMLInputElement;
    expect(diceRollSoundsCheckbox).toBeDisabled();
  });

  it('saves settings to localStorage after a change', async () => {
    const updateSettings = vi.fn();
    await renderSettings({ updateSettings });
    fireEvent.change(screen.getByDisplayValue('Auto (System)'), {
      target: { value: 'dark' },
    });
    fireEvent.click(await screen.findByText('Save Changes'));
    expect(localStorage.getItem('nexus-settings')).toEqual(
      expect.any(String),
    );
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
  });

  it('resets settings to defaults only after confirmation', async () => {
    const resetSettings = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    await renderSettings({ resetSettings });
    fireEvent.click(screen.getByText('Reset to Defaults'));
    expect(resetSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Reset to Defaults'));
    expect(resetSettings).toHaveBeenCalled();
  });

  it('opens the color scheme dropdown and selects a preset palette', async () => {
    const setColorScheme = vi.fn();
    await renderSettings({ setColorScheme });
    fireEvent.click(screen.getByText('Choose Palette'));
    const preset = defaultColorSchemes[1];
    fireEvent.click(screen.getAllByText(preset.name)[0]);
    expect(setColorScheme).toHaveBeenCalledWith(
      expect.objectContaining({ id: preset.id }),
    );
  });

  it('generates a random palette and adds it to custom palette history', async () => {
    const setColorScheme = vi.fn();
    await renderSettings({ setColorScheme });
    fireEvent.click(screen.getByText('Choose Palette'));
    fireEvent.click(screen.getByText('Generate Random Palette'));
    expect(setColorScheme).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Choose Palette'));
    expect(screen.getByText('Custom Palettes')).toBeInTheDocument();
  });

  it('closes the color scheme dropdown on an outside click', async () => {
    await renderSettings();
    fireEvent.click(screen.getByText('Choose Palette'));
    expect(screen.getByText('Preset Palettes')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Preset Palettes')).not.toBeInTheDocument();
  });

  it('resets the UI layout after confirmation, clearing nexus_ui_ keys', async () => {
    localStorage.setItem('nexus_ui_panel', 'x');
    localStorage.setItem('nexus-ui-other', 'y');
    localStorage.setItem('unrelated-key', 'z');
    await renderSettings();
    fireEvent.click(screen.getByText('Reset UI Layout'));
    expect(localStorage.getItem('nexus_ui_panel')).toBeNull();
    expect(localStorage.getItem('nexus-ui-other')).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('z');
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('does not touch storage when the UI layout reset is declined', async () => {
    localStorage.setItem('nexus_ui_panel', 'x');
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    await renderSettings();
    fireEvent.click(screen.getByText('Reset UI Layout'));
    expect(localStorage.getItem('nexus_ui_panel')).toBe('x');
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  describe('campaign backup', () => {
    it('shows campaign statistics from storage', async () => {
      await renderSettings();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('flags unsaved campaign changes', async () => {
      mockStorage.getStats.mockReturnValue({
        entities: 1,
        relationships: 0,
        lastSaved: null,
        isDirty: true,
      });
      await renderSettings();
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('exports a campaign backup', async () => {
      await renderSettings();
      fireEvent.click(screen.getByText('📥 Export Campaign'));
      await waitFor(() => expect(mockStorage.downloadBackup).toHaveBeenCalled());
    });

    it('imports a campaign backup and refreshes stats', async () => {
      await renderSettings();
      fireEvent.click(screen.getByText('📤 Import Campaign'));
      await waitFor(() => expect(mockStorage.uploadBackup).toHaveBeenCalled());
      await waitFor(() =>
        expect(mockStorage.getStats).toHaveBeenCalledTimes(2),
      );
    });

    it('force-saves immediately', async () => {
      await renderSettings();
      fireEvent.click(screen.getByText('💾 Force Save'));
      expect(mockStorage.forceSave).toHaveBeenCalled();
    });
  });
});

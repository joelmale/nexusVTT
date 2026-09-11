import React from 'react';
import { render, screen } from '@testing-library/react';
import { ContextPanel } from '../../../src/components/ContextPanel';

// Mock the game store hooks
vi.mock('../../../src/stores/gameStore', () => ({
  useGameStore: () => ({
    updateSettings: vi.fn(),
    setColorScheme: vi.fn(),
    setEnableGlassmorphism: vi.fn(),
    resetSettings: vi.fn(),
    sceneState: { scenes: [], activeSceneId: null },
  }),
  useSettings: () => ({
    enableGlassmorphism: true,
    theme: 'dark',
    fontSize: 'medium',
    reducedMotion: false,
    enableSounds: true,
    diceRollSounds: true,
    masterVolume: 50,
    autoRollInitiative: false,
    showOtherPlayersRolls: true,
    snapToGridByDefault: true,
    defaultGridSize: 50,
    allowSpectators: true,
    shareCharacterSheets: false,
    logGameSessions: true,
    maxTokensPerScene: 100,
    imageQuality: 'medium',
    enableAnimations: true,
    highContrast: false,
    screenReaderMode: false,
    keyboardNavigation: false,
    useMockData: false,
  }),
  useColorScheme: () => ({ id: 'default', name: 'Default', colors: [] }),
  useSceneState: () => ({ scenes: [], activeSceneId: null }),
}));

// Mock the Settings component to control its content for overflow testing
vi.mock('../../../src/components/Settings', () => ({
  Settings: () => (
    <div data-testid="mock-settings-content" style={{ height: '1000px' }}>
      {/* Simulate overflowing content */}
      {Array.from({ length: 50 }).map((_, i) => (
        <p key={i}>Setting item {i + 1}</p>
      ))}
    </div>
  ),
}));

describe('ContextPanel scrolling', () => {
  it('should display a scrollbar for overflowing content in the Settings panel', () => {
    render(
      <ContextPanel
        activePanel="settings"
        onPanelChange={vi.fn()}
        expanded={true}
        onToggleExpanded={vi.fn()}
        onContentWidthChange={vi.fn()}
      />
    );

    const panelBody = screen.getByTestId('panel-body');
    // In a real browser, we would check:
    // expect(panelContent.scrollHeight).toBeGreaterThan(panelContent.clientHeight);
    // However, in JSDOM, these values are often 0 or don't reflect actual layout.
    // The current setup implies that if panelContent has overflow-y: auto, and its child is tall,
    // it *should* scroll. The CSS check is the most direct assertion for JSDOM.
    expect(panelBody).toHaveStyle('overflow-y: auto');
  });
});

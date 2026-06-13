import React, { useState, useRef, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom'; // Not used yet
import { useGameStore, useSettings, useColorScheme } from '@/stores/gameStore';
import { switchTheme } from '@/services/themeManager';
import '@/styles/settings-optimized.css';
import {
  defaultColorSchemes,
  generateRandomColorScheme,
  applyColorScheme,
  getColorSchemePreview,
} from '@/utils/colorSchemes';
import { getLinearFlowStorage } from '@/services/linearFlowStorage';
import { RefreshIcon, SaveIcon } from './Icons';
import type { ColorScheme, UserSettings } from '@/types/game';

/**
 * @file Settings.tsx
 * @description This component renders the main settings panel for the application.
 * It allows users to customize display, audio, gameplay, and other preferences.
 */

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * A reusable component to group related settings under a common heading.
 */
const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
}) => (
  <div className="settings-section">
    <div className="settings-section-header">
      <h3>{title}</h3>
      {description && <p className="settings-description">{description}</p>}
    </div>
    <div className="settings-section-content">{children}</div>
  </div>
);

interface SettingItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * A reusable component for a single setting row, providing consistent layout for a label and its control.
 */
const SettingItem: React.FC<SettingItemProps> = ({
  label,
  description,
  children,
}) => (
  <div className="setting-item">
    <div className="setting-label">
      <span className="setting-name">{label}</span>
      {description && <span className="setting-desc">{description}</span>}
    </div>
    <div className="setting-control">{children}</div>
  </div>
);

interface ColorSchemePickerProps {
  currentScheme: ColorScheme;
  onSchemeChange: (scheme: ColorScheme) => void;
}

/**
 * A sophisticated UI component for selecting, previewing, and generating color schemes.
 */
const ColorSchemePicker: React.FC<ColorSchemePickerProps> = ({
  currentScheme,
  onSchemeChange,
}) => {
  const [customSchemes, setCustomSchemes] = useState<ColorScheme[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Effect to close the dropdown when the user clicks outside of it.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Generates a new random color scheme and adds it to the list of custom schemes.
  const handleGenerateRandom = () => {
    const randomScheme = generateRandomColorScheme();
    setCustomSchemes((prev) => [randomScheme, ...prev.slice(0, 4)]); // Keep a history of the last 5 custom schemes
    onSchemeChange(randomScheme);
    setIsDropdownOpen(false);
  };

  // Handles the selection of a new scheme from the dropdown.
  const handleSchemeSelect = (scheme: ColorScheme) => {
    onSchemeChange(scheme);
    applyColorScheme(scheme);
    setIsDropdownOpen(false);
  };

  // Helper function to format the color string for display.
  const getHexColor = (color: string): string => {
    return color.toUpperCase();
  };

  const currentColors = getColorSchemePreview(currentScheme);

  return (
    <div className="color-scheme-picker-modern">
      {/* Current Color Palette Display */}
      <div className="current-palette">
        <div className="palette-swatches">
          {currentColors.map((color, index) => {
            const hexColor = getHexColor(color);
            return (
              <div key={index} className="color-swatch-modern">
                <div
                  className="swatch-color"
                  style={{ backgroundColor: color }}
                ></div>
                <span className="color-code">{hexColor}</span>
              </div>
            );
          })}
        </div>

        <div className="palette-name">{currentScheme.name}</div>
      </div>

      {/* Scheme Selector Dropdown */}
      <div className="scheme-selector">
        <div className="dropdown-container" ref={dropdownRef}>
          <button
            className="dropdown-trigger"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            type="button"
          >
            Choose Palette
            <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>
              ▼
            </span>
          </button>

          {isDropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-section">
                <span className="section-title">Preset Palettes</span>
                {defaultColorSchemes.map((scheme) => (
                  <button
                    key={scheme.id}
                    className={`dropdown-item ${scheme.id === currentScheme.id ? 'active' : ''}`}
                    onClick={() => handleSchemeSelect(scheme)}
                  >
                    <div className="mini-palette">
                      {getColorSchemePreview(scheme).map((color, index) => (
                        <div
                          key={index}
                          className="mini-swatch"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="scheme-label">{scheme.name}</span>
                  </button>
                ))}
              </div>

              {customSchemes.length > 0 && (
                <div className="dropdown-section">
                  <span className="section-title">Custom Palettes</span>
                  {customSchemes.map((scheme) => (
                    <button
                      key={scheme.id}
                      className={`dropdown-item ${scheme.id === currentScheme.id ? 'active' : ''}`}
                      onClick={() => handleSchemeSelect(scheme)}
                    >
                      <div className="mini-palette">
                        {getColorSchemePreview(scheme).map((color, index) => (
                          <div
                            key={index}
                            className="mini-swatch"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="scheme-label">{scheme.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="dropdown-section">
                <button
                  className="dropdown-item generate-random"
                  onClick={handleGenerateRandom}
                >
                  <RefreshIcon size={16} />
                  <span className="scheme-label">Generate Random Palette</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * The main settings component. It aggregates all setting sections and handles
 * state management, saving, and resetting of user preferences.
 */
export const Settings: React.FC = () => {
  // const navigate = useNavigate(); // Not used yet
  const {
    updateSettings,
    setColorScheme,
    setEnableGlassmorphism,
    resetSettings,
  } = useGameStore();
  const settings = useSettings();
  const currentColorScheme = useColorScheme();
  // Local state to track if there are unsaved changes, prompting the user to save.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Apply the current color scheme on mount and when it changes
  useEffect(() => {
    applyColorScheme(currentColorScheme);
  }, [currentColorScheme]);

  // Generic handler for updating any setting in the global store.
  const handleSettingChange = (
    key: keyof UserSettings,
    value: UserSettings[keyof UserSettings],
  ) => {
    updateSettings({ [key]: value });
    setHasUnsavedChanges(true);
  };

  // Specific handler for color scheme changes.
  const handleColorSchemeChange = (scheme: ColorScheme) => {
    setColorScheme(scheme);
    setHasUnsavedChanges(true);
  };

  // Persists the current settings to localStorage.
  const handleSave = () => {
    // TODO: Integrate with a more robust persistence layer (e.g., user account on a server).
    localStorage.setItem('nexus-settings', JSON.stringify(settings));
    setHasUnsavedChanges(false);
  };

  // Resets all settings to their default values defined in the store.
  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      resetSettings();
      applyColorScheme(defaultColorSchemes[0]);
      setHasUnsavedChanges(false);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
        <div className="settings-actions">
          {hasUnsavedChanges && (
            <button className="btn btn-primary btn-small" onClick={handleSave}>
              <SaveIcon size={16} />
              Save Changes
            </button>
          )}
          <button className="btn btn-secondary btn-small" onClick={handleReset}>
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="settings-content">
        {/* Display Settings */}
        <SettingsSection
          title="Display"
          description="Customize the appearance and theme of the application"
        >
          <SettingItem
            label="Color Scheme"
            description="Choose a color palette that suits your style"
          >
            <ColorSchemePicker
              currentScheme={currentColorScheme}
              onSchemeChange={handleColorSchemeChange}
            />
          </SettingItem>

          <SettingItem
            label="Enable Glassmorphism"
            description="Use translucent glass effect (may impact performance)"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.enableGlassmorphism}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setEnableGlassmorphism(enabled);
                  // Immediately switch theme for better UX
                  await switchTheme(enabled ? 'glass' : 'solid');
                  setHasUnsavedChanges(true);
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Theme Mode"
            description="Set the overall appearance theme"
          >
            <select
              value={settings.theme}
              onChange={(e) =>
                handleSettingChange(
                  'theme',
                  e.target.value as UserSettings['theme'],
                )
              }
              className="setting-select"
            >
              <option value="auto">Auto (System)</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </SettingItem>

          <SettingItem
            label="Font Size"
            description="Adjust text size for better readability"
          >
            <select
              value={settings.fontSize}
              onChange={(e) =>
                handleSettingChange(
                  'fontSize',
                  e.target.value as UserSettings['fontSize'],
                )
              }
              className="setting-select"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </SettingItem>

          <SettingItem
            label="Reduced Motion"
            description="Minimize animations for better performance or accessibility"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) =>
                  handleSettingChange('reducedMotion', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>
        </SettingsSection>

        {/* Audio Settings */}
        <SettingsSection
          title="Audio"
          description="Configure sound effects and notifications"
        >
          <SettingItem
            label="Enable Sounds"
            description="Master control for all audio effects"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.enableSounds}
                onChange={(e) =>
                  handleSettingChange('enableSounds', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Dice Roll Sounds"
            description="Play sound effects when dice are rolled"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.diceRollSounds}
                onChange={(e) =>
                  handleSettingChange('diceRollSounds', e.target.checked)
                }
                disabled={!settings.enableSounds}
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Master Volume"
            description="Overall volume level for all sounds"
          >
            <div className="volume-control">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.masterVolume}
                onChange={(e) =>
                  handleSettingChange('masterVolume', parseInt(e.target.value))
                }
                className="volume-slider"
                disabled={!settings.enableSounds}
              />
              <span className="volume-value">{settings.masterVolume}%</span>
            </div>
          </SettingItem>
        </SettingsSection>

        {/* Gameplay Settings */}
        <SettingsSection
          title="Gameplay"
          description="Configure game mechanics and behavior"
        >
          <SettingItem
            label="Auto-roll Initiative"
            description="Automatically roll initiative for combat"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.autoRollInitiative}
                onChange={(e) =>
                  handleSettingChange('autoRollInitiative', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Show Other Players' Rolls"
            description="Display dice roll results from other players"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.showOtherPlayersRolls}
                onChange={(e) =>
                  handleSettingChange('showOtherPlayersRolls', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Snap to Grid by Default"
            description="Enable grid snapping when creating new scenes"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.snapToGridByDefault}
                onChange={(e) =>
                  handleSettingChange('snapToGridByDefault', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Default Grid Size"
            description="Default grid cell size for new scenes (pixels)"
          >
            <input
              type="number"
              min="10"
              max="200"
              step="5"
              value={settings.defaultGridSize}
              onChange={(e) =>
                handleSettingChange('defaultGridSize', parseInt(e.target.value))
              }
              className="setting-input"
            />
          </SettingItem>

          <SettingItem
            label="Dice Disappear Time"
            description="Time in seconds before dice auto-clear from screen"
          >
            <input
              type="number"
              min="1"
              max="30"
              step="0.5"
              value={settings.diceDisappearTime / 1000}
              onChange={(e) =>
                handleSettingChange(
                  'diceDisappearTime',
                  parseFloat(e.target.value) * 1000,
                )
              }
              className="setting-input"
            />
          </SettingItem>
        </SettingsSection>

        {/* Privacy Settings */}
        <SettingsSection
          title="Privacy & Sharing"
          description="Control what information is shared with other players"
        >
          <SettingItem
            label="Allow Spectators"
            description="Let non-players observe the game"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.allowSpectators}
                onChange={(e) =>
                  handleSettingChange('allowSpectators', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Share Character Sheets"
            description="Allow other players to view your character information"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.shareCharacterSheets}
                onChange={(e) =>
                  handleSettingChange('shareCharacterSheets', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Log Game Sessions"
            description="Keep a local record of game events and chat"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.logGameSessions}
                onChange={(e) =>
                  handleSettingChange('logGameSessions', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>
        </SettingsSection>

        {/* Performance Settings */}
        <SettingsSection
          title="Performance"
          description="Optimize the application for your device"
        >
          <SettingItem
            label="Max Tokens Per Scene"
            description="Limit tokens to improve performance"
          >
            <input
              type="number"
              min="10"
              max="500"
              step="10"
              value={settings.maxTokensPerScene}
              onChange={(e) =>
                handleSettingChange(
                  'maxTokensPerScene',
                  parseInt(e.target.value),
                )
              }
              className="setting-input"
            />
          </SettingItem>

          <SettingItem
            label="Image Quality"
            description="Balance between visual quality and performance"
          >
            <select
              value={settings.imageQuality}
              onChange={(e) =>
                handleSettingChange(
                  'imageQuality',
                  e.target.value as UserSettings['imageQuality'],
                )
              }
              className="setting-select"
            >
              <option value="low">Low (Faster)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Best Quality)</option>
            </select>
          </SettingItem>

          <SettingItem
            label="Enable Animations"
            description="Show smooth transitions and effects"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.enableAnimations}
                onChange={(e) =>
                  handleSettingChange('enableAnimations', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>
        </SettingsSection>

        {/* Accessibility Settings */}
        <SettingsSection
          title="Accessibility"
          description="Make the application more accessible for all users"
        >
          <SettingItem
            label="High Contrast Mode"
            description="Increase contrast for better visibility"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(e) =>
                  handleSettingChange('highContrast', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Screen Reader Mode"
            description="Optimize for screen reader compatibility"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.screenReaderMode}
                onChange={(e) =>
                  handleSettingChange('screenReaderMode', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>

          <SettingItem
            label="Keyboard Navigation"
            description="Enable enhanced keyboard shortcuts and navigation"
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.keyboardNavigation}
                onChange={(e) =>
                  handleSettingChange('keyboardNavigation', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>
        </SettingsSection>

        {/* Experimental Settings */}
        <SettingsSection
          title="Experimental"
          description="Try out new features that are still in development"
        >
          <SettingItem
            label="Floating Toolbar"
            description="Make the toolbar draggable and floating. When disabled (default), toolbar is docked at the bottom."
          >
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.floatingToolbar ?? false}
                onChange={(e) =>
                  handleSettingChange('floatingToolbar', e.target.checked)
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </SettingItem>
        </SettingsSection>

        {/* Developer Settings - only show in development environment */}
        {process.env.NODE_ENV === 'development' && (
          <SettingsSection
            title="Developer"
            description="Settings for development and testing purposes"
          >
            <SettingItem
              label="Clear & Reset All"
              description="Clear all game data, disconnect from room, and return to welcome screen"
            >
              <button
                onClick={async () => {
                  if (
                    confirm(
                      '⚠️  This will:\n• Clear all game data (scenes, characters, etc.)\n• Disconnect from room\n• Reset to welcome screen\n\nThis cannot be undone. Continue?',
                    )
                  ) {
                    try {
                      // 1. Clear IndexedDB storage (scenes, characters, etc.)
                      const { getLinearFlowStorage } = await import(
                        '@/services/linearFlowStorage'
                      );
                      const storage = getLinearFlowStorage();
                      await storage.clearGameData();

                      // 2. Clear game stores
                      useGameStore.getState().reset();

                      // 3. Disconnect WebSocket and reset game store
                      const gameStore = useGameStore.getState();
                      await gameStore.leaveRoom(); // This calls resetToWelcome internally

                      // 4. Clear all localStorage
                      try {
                        localStorage.removeItem('nexus_ws_port');
                        localStorage.removeItem('nexus_dice_theme');
                        localStorage.removeItem('nexus-active-session');
                        localStorage.removeItem('nexus-characters');
                        localStorage.removeItem('nexus-settings');
                        localStorage.removeItem('nexus-game-state');
                        localStorage.removeItem('nexus-session');
                      } catch (e) {
                        console.warn('Failed to clear localStorage:', e);
                      }

                      // 5. Force reload to ensure completely clean state
                      window.location.href = '/lobby';
                    } catch (error) {
                      console.error('❌ Reset failed:', error);
                      alert(
                        'Failed to reset. Please refresh the page manually.',
                      );
                    }
                  }
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                🧹 Clear & Reset
              </button>
            </SettingItem>
          </SettingsSection>
        )}

        {/* Campaign Data Section */}
        <SettingsSection
          title="📦 Campaign Data"
          description="Backup and restore your campaign data"
        >
          <CampaignBackupSection />
        </SettingsSection>
      </div>
    </div>
  );
};

// Campaign Backup Section Component
const CampaignBackupSection: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  const storage = getLinearFlowStorage();

  // Load stats on mount
  useEffect(() => {
    setStats(storage.getStats());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      storage.downloadBackup();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await storage.uploadBackup();
      setStats(storage.getStats()); // Refresh stats
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <SettingItem
        label="Campaign Statistics"
        description="Current data stored in your campaign"
      >
        {stats && (
          <div className="backup-stats">
            <div className="stat-item">
              <span className="stat-label">Entities:</span>
              <span className="stat-value">{String(stats.entities ?? 0)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Relationships:</span>
              <span className="stat-value">
                {String(stats.relationships ?? 0)}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Last Saved:</span>
              <span className="stat-value">
                {stats.lastSaved &&
                (typeof stats.lastSaved === 'string' ||
                  typeof stats.lastSaved === 'number')
                  ? new Date(stats.lastSaved).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Status:</span>
              <span
                className={`stat-value ${stats.isDirty ? 'dirty' : 'clean'}`}
              >
                {stats.isDirty ? 'Unsaved Changes' : 'Saved'}
              </span>
            </div>
          </div>
        )}
      </SettingItem>

      <SettingItem
        label="Export Campaign"
        description="Download a backup file containing all your campaign data (scenes, characters, settings)"
      >
        <button
          className="setting-button primary"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <span className="loading-spinner"></span>
              Exporting...
            </>
          ) : (
            <>📥 Export Campaign</>
          )}
        </button>
      </SettingItem>

      <SettingItem
        label="Import Campaign"
        description="Restore from a backup file (will replace current campaign data)"
      >
        <button
          className="setting-button secondary"
          onClick={handleImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <>
              <span className="loading-spinner"></span>
              Importing...
            </>
          ) : (
            <>📤 Import Campaign</>
          )}
        </button>
      </SettingItem>

      <SettingItem
        label="Force Save"
        description="Immediately save all pending changes to IndexedDB"
      >
        <button
          className="setting-button tertiary"
          onClick={() => storage.forceSave()}
        >
          💾 Force Save
        </button>
      </SettingItem>
    </>
  );
};

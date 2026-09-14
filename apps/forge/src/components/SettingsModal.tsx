import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../hooks';
import { ThemeType, getThemeDisplayName, getThemeDescription } from '../services/themeService';
import { APP_VERSION } from '../version';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();

  const themes: ThemeType[] = ['dark-colorful', 'light', 'paper'];

  if (!isOpen) return null;

  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary rounded-xl shadow-theme-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-secondary">
          <h2 className="text-xl font-bold text-theme-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-theme-secondary text-lg">Theme</h3>
            <div className="space-y-3">
              {themes.map((themeOption) => (
                <label
                  key={themeOption}
                  className="flex items-start gap-3 p-4 rounded-lg border-2 border-theme-primary hover:bg-theme-tertiary\/20 transition-colors cursor-pointer"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={themeOption}
                    checked={theme === themeOption}
                    onChange={() => handleThemeChange(themeOption)}
                    className="mt-1 w-4 h-4 accent-accent-purple"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-theme-primary">
                      {getThemeDisplayName(themeOption)}
                    </div>
                    <div className="text-sm text-theme-muted mt-1">
                      {getThemeDescription(themeOption)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-theme-secondary">
          <div className="text-sm text-theme-muted">
            Version {APP_VERSION}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-theme-aware font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

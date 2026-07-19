import { useCallback, useEffect, useState } from 'react';
import type { UserPreferences } from '@/types/account';

interface UseUserPreferencesResult {
  preferences: UserPreferences;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updatePreferences: (updates: UserPreferences) => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  allowSpectators: false,
  shareCharacterSheets: false,
  logSessions: false,
};

export const useUserPreferences = (): UseUserPreferencesResult => {
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/preferences', {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) {
          setPreferences(defaultPreferences);
          return;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load preferences');
      }
      const data = (await response.json()) as UserPreferences;
      setPreferences({ ...defaultPreferences, ...data });
    } catch (err) {
      console.error('Failed to fetch preferences', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load preferences',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (updates: UserPreferences) => {
    setError(null);
    try {
      const response = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update preferences');
      }
      const data = (await response.json()) as UserPreferences;
      setPreferences({ ...defaultPreferences, ...data });
    } catch (err) {
      console.error('Failed to update preferences', err);
      setError(
        err instanceof Error ? err.message : 'Failed to update preferences',
      );
      throw err;
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPreferences();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    refresh: fetchPreferences,
    updatePreferences,
  };
};

import { useEffect, useState, useCallback } from 'react';
import type { UserProfile } from '@/types/account';

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (
    updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'avatarUrl'>>,
  ) => Promise<void>;
}

export const useUserProfile = (): UseUserProfileResult => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/profile', {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) {
          setProfile(null);
          return;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load profile');
      }
      const data = (await response.json()) as UserProfile;
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (
      updates: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'avatarUrl'>>,
    ) => {
      setError(null);
      try {
        const response = await fetch('/api/users/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update profile');
        }
        const data = (await response.json()) as UserProfile;
        setProfile(data);
      } catch (err) {
        console.error('Failed to update profile', err);
        setError(
          err instanceof Error ? err.message : 'Failed to update profile',
        );
        throw err;
      }
    },
    [],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchProfile();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
    updateProfile,
  };
};

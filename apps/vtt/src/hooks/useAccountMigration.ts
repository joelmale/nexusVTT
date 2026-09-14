import { useState, useCallback } from 'react';

interface MigrationResult {
  success: boolean;
  error: string | null;
  loading: boolean;
  migrate: () => Promise<void>;
}

export const useAccountMigration = (): MigrationResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const migrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch('/api/users/migrate-guest', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Migration failed');
      }
      setSuccess(true);
    } catch (err) {
      console.error('Guest migration failed', err);
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { success, error, loading, migrate };
};

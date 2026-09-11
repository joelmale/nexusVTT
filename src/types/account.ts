export interface UserProfile {
  id: string;
  email: string | null;
  name: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  provider: string;
  preferences: UserPreferences;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
  stats?: {
    characters: number;
    campaigns: number;
    sessions: number;
  };
}

export interface UserPreferences {
  allowSpectators?: boolean;
  shareCharacterSheets?: boolean;
  logSessions?: boolean;
  hpSync?: boolean;
  [key: string]: unknown;
}

import { describe, it, expect } from 'vitest';
import { toPublicUser, toPublicProfile, toAuthResponse } from '../../../../server/utils/publicUser';

describe('publicUser DTO utilities', () => {
  const mockDbUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed_super_secret',
    name: 'TestUser',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
    bio: 'Hello world',
    provider: 'local',
    preferences: { theme: 'dark' },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('toPublicUser', () => {
    it('returns null for invalid input', () => {
      expect(toPublicUser(null)).toBeNull();
      expect(toPublicUser({})).toBeNull();
    });

    it('strips sensitive fields', () => {
      const result = toPublicUser(mockDbUser);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('provider');
      expect(result).toEqual({
        id: 'user-123',
        name: 'TestUser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Hello world',
      });
    });
  });

  describe('toPublicProfile', () => {
    it('includes public profile fields but strips sensitive data', () => {
      const result = toPublicProfile(mockDbUser);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('provider');
      expect(result).toEqual({
        id: 'user-123',
        name: 'TestUser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Hello world',
        preferences: { theme: 'dark' },
        isActive: true,
      });
    });
  });

  describe('toAuthResponse', () => {
    it('includes authenticated user fields but strips secrets', () => {
      const result = toAuthResponse(mockDbUser);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toEqual({
        id: 'user-123',
        name: 'TestUser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Hello world',
        preferences: { theme: 'dark' },
        isActive: true,
        email: 'test@example.com',
        provider: 'local',
      });
    });
  });
});

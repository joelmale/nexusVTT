import fs from 'fs';
import path from 'path';
import type express from 'express';
import type { Session } from 'express-session';
import type { DatabaseService } from '../database.js';
import { sanitizeLog } from '../sanitizeLog.js';
import {
  generateRandomCampaign,
  generateRandomCharacter,
} from '../utils/mockGenerator.js';
import { isDevMode } from '../utils/devMode.js';

interface ApiSession extends Session {
  guestUser?: { id: string; name: string; provider: string };
}

type CharacterRecord = {
  id: string;
  name: string;
  ownerId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function normalizeCharacterPayload(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function normalizeForHash(value: unknown): unknown {
  const normalized = normalizeCharacterPayload(value);
  if (
    normalized === null ||
    normalized === undefined ||
    typeof normalized !== 'object'
  )
    return normalized;
  if (Array.isArray(normalized))
    return normalized.map((item) => normalizeForHash(item) ?? null);
  const record = normalized as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const omittedKeys = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'playerId',
    'version',
    'name',
  ]);
  Object.keys(record)
    .sort()
    .forEach((key) => {
      if (omittedKeys.has(key)) return;
      const normalizedValue = normalizeForHash(record[key]);
      if (normalizedValue !== undefined) sanitized[key] = normalizedValue;
    });
  return sanitized;
}

function buildCharacterKey(name: string, data: unknown): string {
  return `${name.trim().toLowerCase()}::${stableStringify(normalizeForHash(data))}`;
}

function dedupeCharacters(characters: CharacterRecord[]): {
  unique: CharacterRecord[];
  duplicateIds: string[];
} {
  const sorted = [...characters].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const seen = new Set<string>();
  const unique: CharacterRecord[] = [];
  const duplicateIds: string[] = [];
  for (const character of sorted) {
    const key = buildCharacterKey(character.name, character.data);
    if (seen.has(key)) duplicateIds.push(character.id);
    else {
      seen.add(key);
      unique.push(character);
    }
  }
  return { unique, duplicateIds };
}

export function registerApiRoutes(
  app: express.Application,
  db: DatabaseService,
  assetsPath: string,
): void {
  // ============================================================================
  // USER ACCOUNT ROUTES
  // ============================================================================
  app.get('/api/users/profile', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user as { id: string };
      const profile = await db.getUserProfile(user.id);

      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        displayName: profile.displayName || profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        provider: profile.provider,
        preferences: profile.preferences || {},
        isActive: profile.isActive,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        lastLogin: profile.lastLogin,
        stats: profile.stats,
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  app.put('/api/users/profile', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { displayName, bio, avatarUrl } = req.body || {};

      if (displayName !== undefined) {
        if (typeof displayName !== 'string') {
          return res
            .status(400)
            .json({ error: 'displayName must be a string' });
        }
        if (
          displayName.trim().length === 0 ||
          displayName.trim().length > 100
        ) {
          return res.status(400).json({
            error: 'displayName must be between 1 and 100 characters',
          });
        }
      }

      if (bio !== undefined && typeof bio !== 'string') {
        return res.status(400).json({ error: 'bio must be a string' });
      }
      if (typeof bio === 'string' && bio.length > 1000) {
        return res
          .status(400)
          .json({ error: 'bio must be 1000 characters or less' });
      }

      if (avatarUrl !== undefined && typeof avatarUrl !== 'string') {
        return res.status(400).json({ error: 'avatarUrl must be a string' });
      }
      if (typeof avatarUrl === 'string' && avatarUrl.length > 2000) {
        return res.status(400).json({ error: 'avatarUrl is too long' });
      }

      const user = req.user as { id: string };
      const updated = await db.updateUserProfile(user.id, {
        displayName: displayName?.trim() ?? undefined,
        bio: bio ?? undefined,
        avatarUrl: avatarUrl ?? undefined,
      });

      res.json({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        displayName: updated.displayName || updated.name,
        bio: updated.bio,
        avatarUrl: updated.avatarUrl,
        provider: updated.provider,
        preferences: updated.preferences || {},
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        lastLogin: updated.lastLogin,
      });
    } catch (error) {
      console.error('Failed to update user profile:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  });

  app.get('/api/users/preferences', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const user = req.user as { id: string };
      const preferences = await db.getUserPreferences(user.id);
      res.json(preferences);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  app.put('/api/users/preferences', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { allowSpectators, shareCharacterSheets, logSessions, ...rest } =
        req.body || {};

      const invalid =
        (allowSpectators !== undefined &&
          typeof allowSpectators !== 'boolean') ||
        (shareCharacterSheets !== undefined &&
          typeof shareCharacterSheets !== 'boolean') ||
        (logSessions !== undefined && typeof logSessions !== 'boolean');

      if (invalid) {
        return res
          .status(400)
          .json({ error: 'Preference values must be boolean' });
      }

      const user = req.user as { id: string };
      const currentPrefs = await db.getUserPreferences(user.id);
      const mergedPrefs = {
        ...currentPrefs,
        ...(allowSpectators !== undefined ? { allowSpectators } : {}),
        ...(shareCharacterSheets !== undefined ? { shareCharacterSheets } : {}),
        ...(logSessions !== undefined ? { logSessions } : {}),
        ...rest,
      };

      const updated = await db.updateUserPreferences(user.id, mergedPrefs);
      res.json(updated);
    } catch (error) {
      console.error('Failed to update preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  app.post('/api/users/migrate-guest', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const guest = (req.session as ApiSession).guestUser;
      if (!guest) {
        return res.status(400).json({ error: 'No guest session to migrate' });
      }

      const user = req.user as { id: string };
      await db.migrateGuestToUser(guest.id, user.id);

      delete (req.session as ApiSession).guestUser;

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to migrate guest data:', error);
      res.status(500).json({ error: 'Failed to migrate guest data' });
    }
  });

  app.delete('/api/users/account', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user as { id: string };
      await db.deactivateUser(user.id);

      req.logout((err) => {
        if (err) {
          console.error('Logout after deactivate failed:', err);
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to deactivate account:', error);
      res.status(500).json({ error: 'Failed to deactivate account' });
    }
  });

  // ============================================================================
  // GUEST USER ROUTES
  // ============================================================================

  /**
   * POST /api/guest-users
   * Creates a new guest user for non-authenticated gameplay
   * Body: { name: string }
   */
  app.post('/api/guest-users', async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }

      if (name.trim().length > 50) {
        return res
          .status(400)
          .json({ error: 'Name must be 50 characters or less' });
      }

      // A browser session owns one stable guest identity. Re-entering the
      // welcome flow after a disconnect must not create a new UUID, otherwise
      // token ownership, permissions, and reconnect membership all drift.
      const session = req.session as ApiSession;
      if (session.guestUser) {
        return res.status(200).json(session.guestUser);
      }

      // Create guest user in database
      const guestUser = await db.createGuestUser(name.trim());

      // Create a session for the guest user (without using passport)
      session.guestUser = {
        id: guestUser.id,
        name: guestUser.name,
        provider: 'guest',
      };

      res.status(201).json({
        id: guestUser.id,
        name: guestUser.name,
        provider: 'guest',
      });
    } catch (error) {
      console.error('Failed to create guest user:', error);
      res.status(500).json({ error: 'Failed to create guest user' });
    }
  });

  /**
   * GET /api/guest-me
   * Gets current guest user from session
   */
  app.get('/api/guest-me', (req, res) => {
    const guestUser = (req.session as ApiSession).guestUser;
    if (guestUser) {
      res.json(guestUser);
    } else {
      res.status(401).json({ message: 'Not a guest user' });
    }
  });

  /**
   * POST /api/dev/populate-mock-data
   * Dev-only endpoint to populate mock campaigns and characters.
   * Gated by the unified dev-mode flag (DEV_MODE, default NODE_ENV!==production).
   */
  if (isDevMode()) {
    app.post('/api/dev/populate-mock-data', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = req.user as { id: string };

        // Configurable counts (default 3 campaigns / 4 characters), clamped to
        // a sane range so a bad request can't ask for thousands of inserts.
        const clamp = (v: unknown, def: number) =>
          Math.min(Math.max(Math.floor(Number(v) || def), 0), 25);
        const campaignCount = clamp(req.body?.campaigns, 3);
        const characterCount = clamp(req.body?.characters, 4);

        console.log(
          `🛠️ Dev seeding requested for user ${user.id}: ${campaignCount} campaigns, ${characterCount} characters`,
        );

        // Each insert is isolated so one failure can't abort the whole batch;
        // we report partial success instead of 500-ing everything.
        const createdCampaigns = [];
        const createdCharacters = [];
        const errors: string[] = [];

        for (let i = 0; i < campaignCount; i++) {
          try {
            const campData = generateRandomCampaign(user.id);
            const campaign = await db.createCampaign(
              user.id,
              campData.name,
              campData.description ?? undefined,
            );
            createdCampaigns.push(campaign);
          } catch (err) {
            console.error(`Seed campaign ${i} failed:`, err);
            errors.push(`campaign ${i}: ${(err as Error).message}`);
          }
        }

        for (let i = 0; i < characterCount; i++) {
          try {
            const charData = generateRandomCharacter(user.id);
            const character = await db.createCharacter(
              user.id,
              charData.name,
              charData.data,
            );
            createdCharacters.push(character);
          } catch (err) {
            console.error(`Seed character ${i} failed:`, err);
            errors.push(`character ${i}: ${(err as Error).message}`);
          }
        }

        res.json({
          success: errors.length === 0,
          campaigns: createdCampaigns,
          characters: createdCharacters,
          requested: { campaigns: campaignCount, characters: characterCount },
          errors,
        });
      } catch (error) {
        console.error('Failed to populate mock data:', error);
        res.status(500).json({ error: 'Failed to populate mock data' });
      }
    });
  }

  // ============================================================================
  // CAMPAIGN ROUTES
  // ============================================================================

  /**
   * GET /api/campaigns
   * Gets all campaigns for the authenticated user
   * Requires authentication
   */
  app.get('/api/campaigns', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user as { id: string };
      const campaigns = await db.getCampaignsByUser(user.id);

      res.json(campaigns);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  /**
   * POST /api/campaigns
   * Creates a new campaign
   * Requires authentication
   * Body: { name: string, description?: string }
   */
  app.post('/api/campaigns', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { name, description } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Campaign name is required' });
      }

      if (name.trim().length > 255) {
        return res
          .status(400)
          .json({ error: 'Campaign name must be 255 characters or less' });
      }

      const user = req.user as { id: string };
      const campaign = await db.createCampaign(
        user.id,
        name.trim(),
        description?.trim() || undefined,
      );

      res.status(201).json(campaign);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  });

  /**
   * PUT /api/campaigns/:id
   * Updates a campaign
   * Requires authentication and ownership
   * Body: { name?: string, description?: string, scenes?: unknown }
   */
  app.put('/api/campaigns/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const campaignId = req.params.id;
      const updates = req.body;

      const user = req.user as { id: string };
      const campaign = await db.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      if (campaign.dmId !== user.id) {
        return res
          .status(403)
          .json({ error: 'Access denied: not campaign owner' });
      }

      // Validate updates
      if (updates.name !== undefined) {
        if (
          typeof updates.name !== 'string' ||
          updates.name.trim().length === 0
        ) {
          return res
            .status(400)
            .json({ error: 'Campaign name cannot be empty' });
        }
        if (updates.name.trim().length > 255) {
          return res
            .status(400)
            .json({ error: 'Campaign name must be 255 characters or less' });
        }
        updates.name = updates.name.trim();
      }

      if (
        updates.description !== undefined &&
        typeof updates.description === 'string'
      ) {
        updates.description = updates.description.trim();
      }

      await db.updateCampaign(campaignId, updates);

      res.json({ success: true, message: 'Campaign updated successfully' });
    } catch (error) {
      console.error('Failed to update campaign:', error);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  });

  /**
   * DELETE /api/campaigns/:id
   * Deletes a campaign (and cascades to its sessions via ON DELETE CASCADE)
   * Requires authentication and ownership
   */
  app.delete('/api/campaigns/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const campaignId = req.params.id;

      // Verify ownership
      const campaign = await db.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const user = req.user as { id: string };
      if (campaign.dmId !== user.id) {
        return res
          .status(403)
          .json({ error: 'Access denied: not campaign owner' });
      }

      await db.deleteCampaign(campaignId);

      res.json({ success: true, message: 'Campaign deleted successfully' });
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  });

  /**
   * GET /api/characters
   * Retrieves all characters owned by the authenticated user
   * Requires authentication
   */
  app.get('/api/characters', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user as { id: string };
      const characters = await db.getCharactersByUser(user.id);
      const { unique, duplicateIds } = dedupeCharacters(characters);

      if (duplicateIds.length > 0) {
        await db.deleteCharactersByIds(duplicateIds);
      }

      res.json(unique);
    } catch (error) {
      console.error('Failed to fetch characters:', error);
      res.status(500).json({ error: 'Failed to fetch characters' });
    }
  });

  /**
   * GET /api/characters/:id
   * Retrieves a specific character by ID
   * Requires authentication and ownership
   */
  app.get('/api/characters/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const characterId = req.params.id;
      const character = await db.getCharacterById(characterId);

      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      // Verify ownership
      const user = req.user as { id: string };
      if (character.ownerId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(character);
    } catch (error) {
      console.error('Failed to fetch character:', error);
      res.status(500).json({ error: 'Failed to fetch character' });
    }
  });

  /**
   * POST /api/characters
   * Creates a new character
   * Requires authentication
   * Body: { name: string, data?: object }
   */
  app.post('/api/characters', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { name, data } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Character name is required' });
      }

      if (name.trim().length > 255) {
        return res
          .status(400)
          .json({ error: 'Character name must be 255 characters or less' });
      }

      const user = req.user as { id: string };
      const existingCharacters = await db.getCharactersByUser(user.id);
      const incomingKey = buildCharacterKey(name.trim(), data || {});
      const match = existingCharacters
        .map((character) => ({
          character,
          key: buildCharacterKey(character.name, character.data),
        }))
        .filter(({ key }) => key === incomingKey)
        .sort(
          (a, b) =>
            new Date(b.character.updatedAt).getTime() -
            new Date(a.character.updatedAt).getTime(),
        )[0]?.character;

      if (match) {
        return res.status(200).json(match);
      }

      const character = await db.createCharacter(
        user.id,
        name.trim(),
        data || {},
      );

      res.status(201).json(character);
    } catch (error) {
      console.error('Failed to create character:', error);
      res.status(500).json({ error: 'Failed to create character' });
    }
  });

  /**
   * PUT /api/characters/:id
   * Updates a character
   * Requires authentication and ownership
   * Body: { name?: string, data?: object }
   */
  app.put('/api/characters/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const characterId = req.params.id;
      const updates = req.body;

      // Verify ownership
      const character = await db.getCharacterById(characterId);
      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      const user = req.user as { id: string };
      if (character.ownerId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Validate updates
      if (updates.name !== undefined) {
        if (
          typeof updates.name !== 'string' ||
          updates.name.trim().length === 0
        ) {
          return res
            .status(400)
            .json({ error: 'Character name cannot be empty' });
        }
        if (updates.name.trim().length > 255) {
          return res
            .status(400)
            .json({ error: 'Character name must be 255 characters or less' });
        }
        updates.name = updates.name.trim();
      }

      await db.updateCharacter(characterId, updates);

      res.json({ success: true, message: 'Character updated successfully' });
    } catch (error) {
      console.error('Failed to update character:', error);
      res.status(500).json({ error: 'Failed to update character' });
    }
  });

  /**
   * DELETE /api/characters/:id
   * Deletes a character
   * Requires authentication and ownership
   */
  app.delete('/api/characters/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const characterId = req.params.id;

      // Verify ownership
      const character = await db.getCharacterById(characterId);
      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      const user = req.user as { id: string };
      if (character.ownerId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await db.deleteCharacter(characterId);

      res.json({ success: true, message: 'Character deleted successfully' });
    } catch (error) {
      console.error('Failed to delete character:', error);
      res.status(500).json({ error: 'Failed to delete character' });
    }
  });

  /**
   * DELETE /api/characters
   * Deletes all characters owned by the authenticated user
   */
  app.delete('/api/characters', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user as { id: string };
      const deletedCount = await db.deleteCharactersByUser(user.id);

      res.json({
        success: true,
        deletedCount,
      });
    } catch (error) {
      console.error('Failed to delete all characters:', error);
      res.status(500).json({ error: 'Failed to delete characters' });
    }
  });

  /**
   * POST /api/tokens/save
   * Saves a customized token image to the server
   * Body: { tokenId: string, imageData: string (base64), name: string }
   */
  app.post('/api/tokens/save', async (req, res) => {
    try {
      const { tokenId, imageData, name } = req.body;

      if (!tokenId || !imageData || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate that imageData is a base64 PNG
      if (!imageData.startsWith('data:image/png;base64,')) {
        return res.status(400).json({ error: 'Invalid image format' });
      }

      // Extract base64 data
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Create custom tokens directory if it doesn't exist
      // Save to ASSETS_PATH/assets/tokens/custom to match the static serve path
      const customTokensDir = path.join(
        assetsPath,
        'assets',
        'tokens',
        'custom',
      );
      if (!fs.existsSync(customTokensDir)) {
        fs.mkdirSync(customTokensDir, { recursive: true });
      }

      // Generate filename from tokenId
      const sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const sanitizedId = String(tokenId).replace(/[^a-z0-9]/gi, '_');
      const filename = `${sanitizedName}_${sanitizedId}.png`;
      const filepath = path.join(customTokensDir, filename);

      // Reject if resolved path escapes the tokens directory
      if (!filepath.startsWith(path.resolve(customTokensDir) + path.sep)) {
        return res.status(400).json({ error: 'Invalid token path' });
      }

      // Write the file
      fs.writeFileSync(filepath, buffer);

      // Return the server path
      const serverPath = `/assets/tokens/custom/${filename}`;

      console.log(`💾 Saved custom token: ${sanitizeLog(serverPath)}`);
      res.json({
        success: true,
        path: serverPath,
        message: 'Token saved successfully',
      });
    } catch (error) {
      console.error('Failed to save token:', error);
      res.status(500).json({ error: 'Failed to save token' });
    }
  });
}

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import { useCharacterStore } from '@/stores/characterStore';
import type { Scene } from '@/types/game';
import { CharacterManager } from './CharacterManager';
import { CharacterImportModal } from './CharacterImportModal';
import { CharacterSelectionModal } from './CharacterSelectionModal';
import { useCharacterCreationLauncher } from '@/hooks';
import { DocumentLibrary } from './DocumentLibrary';
import type { Character } from '@/types/character';
import { CHARACTER_CLASSES, createEmptyCharacter } from '@/types/character';
import type { PlayerCharacter } from '@/types/game';
import {
  applyCampaignBackupAssets,
  buildCampaignBackup,
  buildCampaignBackupFilename,
  downloadCampaignBackup,
  parseCampaignBackup,
} from '@/services/campaignBackup';
import { tokenAssetManager } from '@/services/tokenAssets';
import { propAssetManager } from '@/services/propAssets';
import '@/styles/dashboard.css';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
};

const normalizeCharacterPayload = (value: unknown): unknown => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const normalizeForHash = (value: unknown): unknown => {
  const normalized = normalizeCharacterPayload(value);
  if (
    normalized === null ||
    normalized === undefined ||
    typeof normalized !== 'object'
  ) {
    return normalized;
  }

  if (Array.isArray(normalized)) {
    return normalized.map((item) => {
      const normalizedItem = normalizeForHash(item);
      return normalizedItem === undefined ? null : normalizedItem;
    });
  }

  const record = normalized as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const omittedKeys = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'playerId',
    'version',
  ]);

  Object.keys(record)
    .sort()
    .forEach((key) => {
      if (omittedKeys.has(key)) return;
      const normalizedValue = normalizeForHash(record[key]);
      if (normalizedValue === undefined) return;
      sanitized[key] = normalizedValue;
    });

  return sanitized;
};

const characterHash = (value: unknown): string =>
  stableStringify(normalizeForHash(value));

const isFullCharacterPayload = (value: unknown): value is Character => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const race = record.race as Record<string, unknown> | undefined;
  const hitPoints = record.hitPoints as Record<string, unknown> | undefined;

  return (
    typeof record.name === 'string' &&
    typeof record.level === 'number' &&
    Array.isArray(record.classes) &&
    !!race &&
    typeof race.name === 'string' &&
    !!hitPoints &&
    typeof hitPoints.maximum === 'number'
  );
};

const buildCharacterFromRecord = (
  record: CharacterRecord,
  fallbackPlayerId: string,
): Character | null => {
  const normalized = normalizeCharacterPayload(record.data);
  if (!normalized || typeof normalized !== 'object') {
    return null;
  }

  if (isFullCharacterPayload(normalized)) {
    const createdAt = Number.isFinite(normalized.createdAt)
      ? normalized.createdAt
      : Date.parse(record.createdAt);
    const updatedAt = Number.isFinite(normalized.updatedAt)
      ? normalized.updatedAt
      : Date.parse(record.updatedAt);

    return {
      ...normalized,
      id: normalized.id || record.id,
      name: normalized.name || record.name,
      playerId: normalized.playerId || record.ownerId || fallbackPlayerId,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
  }

  const data = normalized as Record<string, unknown>;
  const base = createEmptyCharacter(record.ownerId || fallbackPlayerId);
  const level = typeof data.level === 'number' ? data.level : base.level;
  const raceName = typeof data.race === 'string' ? data.race : base.race.name;
  const className = typeof data.class === 'string' ? data.class : '';
  const hitDie =
    CHARACTER_CLASSES.find((entry) => entry.name === className)?.hitDie ?? 'd8';
  const createdAt = Date.parse(record.createdAt);
  const updatedAt = Date.parse(record.updatedAt);

  return {
    ...base,
    id: record.id,
    name: record.name,
    playerId: record.ownerId || base.playerId,
    level,
    race: { ...base.race, name: raceName },
    classes: className ? [{ name: className, level, hitDie }] : base.classes,
    createdAt: Number.isFinite(createdAt) ? createdAt : base.createdAt,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : base.updatedAt,
  };
};

// Convert Character to PlayerCharacter for gameStore compatibility
const convertCharacterToPlayerCharacter = (
  character: Character,
): PlayerCharacter => {
  return {
    id: character.id,
    name: character.name,
    race: character.race.name,
    class: character.classes[0]?.name || '',
    background: character.background.name,
    level: character.level,
    stats: {
      strength: character.abilities.strength.score,
      dexterity: character.abilities.dexterity.score,
      constitution: character.abilities.constitution.score,
      intelligence: character.abilities.intelligence.score,
      wisdom: character.abilities.wisdom.score,
      charisma: character.abilities.charisma.score,
    },
    createdAt: character.createdAt,
    playerId: character.playerId,
  };
};

/**
 * Campaign data structure from API
 * @interface Campaign
 */
interface Campaign {
  /** Unique campaign identifier (UUID) */
  id: string;
  /** Campaign name/title */
  name: string;
  /** Campaign description */
  description: string | null;
  /** User ID of the Dungeon Master */
  dmId: string;
  /** Campaign scenes data (JSONB) */
  scenes: unknown;
  /** Last room code used for this campaign */
  lastRoomCode?: string | null;
  /** Timestamp when last room code was updated */
  lastRoomCodeUpdatedAt?: string | null;
  /** Timestamp when campaign was created */
  createdAt: string;
  /** Timestamp when campaign was last updated */
  updatedAt: string;
  /** Whether this campaign is favorited */
  isFavorite?: boolean;
}

/**
 * Character record from the database
 * @interface CharacterRecord
 */
interface CharacterRecord {
  id: string;
  name: string;
  ownerId: string;
  data: {
    race?: string;
    class?: string;
    level?: number;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  /** Whether this character is favorited */
  isFavorite?: boolean;
}

/**
 * Dashboard component for authenticated users
 * Displays user's campaigns and characters
 * @component
 * @returns {JSX.Element} Dashboard page
 */
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, createGameRoom, joinRoomWithCode } =
    useGameStore();
  const localCharacters = useCharacterStore((state) => state.characters);
  const clearLocalCharacters = useCharacterStore((state) => state.clearCharacters);
  const { startCharacterCreation, LauncherComponent } =
    useCharacterCreationLauncher();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [startingSession, setStartingSession] = useState<string | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<
    CharacterRecord | undefined
  >(undefined);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [campaignBackupExporting, setCampaignBackupExporting] = useState(false);
  const [campaignBackupImporting, setCampaignBackupImporting] = useState(false);
  const [showJoinGameModal, setShowJoinGameModal] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joiningGame, setJoiningGame] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showCharacterSelectionModal, setShowCharacterSelectionModal] = useState(false);
  const [joiningCampaign, setJoiningCampaign] = useState<Campaign | null>(null);
  const syncInFlightRef = React.useRef(false);
  const lastSyncKeyRef = React.useRef<string | null>(null);

  // Check authentication and redirect if not authenticated
  useEffect(() => {
    // Give authentication check time to complete
    const timer = setTimeout(() => {
      setAuthChecking(false);
      if (!isAuthenticated) {
        console.warn('Dashboard: User not authenticated, redirecting to lobby');
        navigate('/lobby');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, navigate]);

  /**
   * Fetches campaigns from API on component mount
   */
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/campaigns', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch campaigns');
        }

        const data = await response.json();
        setCampaigns(data);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setError('Failed to load campaigns. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchCampaigns();
    }
  }, [isAuthenticated]);

  /**
   * Fetches characters from API on component mount
   */
  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        setCharactersLoading(true);
        setError(null);

        const response = await fetch('/api/characters', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch characters');
        }

        const data = await response.json();
        setCharacters(data);
      } catch (err) {
        console.error('Error fetching characters:', err);
        setError('Failed to load characters. Please try again.');
      } finally {
        setCharactersLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchCharacters();
    }
  }, [isAuthenticated]);

  /**
   * Handles creating a new campaign
   */
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      return;
    }

    try {
      setCreatingCampaign(true);
      setError(null);

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          description: newCampaignDescription.trim() || undefined,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      const newCampaign = await response.json();

      // Add new campaign to list
      setCampaigns([newCampaign, ...campaigns]);

      // Reset form and close modal
      setNewCampaignName('');
      setNewCampaignDescription('');
      setShowNewCampaignModal(false);
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create campaign',
      );
    } finally {
      setCreatingCampaign(false);
    }
  };

  /**
   * Handles opening the character creation modal
   */
  const handleCreateCharacter = () => {
    if (user.id) {
      startCharacterCreation(
        user.id,
        'modal',
        (characterId: string, character?: unknown) => {
          // Character saved to database via API, now add to local state
          if (character) {
            handleSaveCharacter(character as CharacterRecord);
          }
        },
        () => {
          console.log('Character creation cancelled');
        },
      );
    }
  };

  /**
   * Handles opening the character edit modal
   */
  const handleEditCharacter = (character: CharacterRecord) => {
    setEditingCharacter(character);
  };

  /**
   * Handles opening the character import modal
   */
  const handleOpenImportModal = () => {
    setShowImportModal(true);
  };

  /**
   * Handles import completion from the modal
   */
  const handleImportComplete = async (result: { successful: number; failed: number }) => {
    console.log(`✅ Import complete: ${result.successful} successful, ${result.failed} failed`);

    // Refresh the characters list from the API
    try {
      const response = await fetch('/api/characters', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCharacters(data);
      }

      setImportMessage(`Imported ${result.successful} character${result.successful !== 1 ? 's' : ''} successfully.`);

      // Clear message after 5 seconds
      setTimeout(() => setImportMessage(null), 5000);
    } catch (err) {
      console.error('Failed to refresh characters after import:', err);
    }
  };

  const handleClearAllCharacters = async () => {
    if (!confirm('This will delete all characters in your account and local cache. Continue?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/characters', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete characters');
      }

      clearLocalCharacters();
      setCharacters([]);
      setImportMessage('All characters cleared.');
      setTimeout(() => setImportMessage(null), 4000);
    } catch (err) {
      console.error('Failed to clear characters:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to clear characters',
      );
    }
  };

  const getCharacterRaceLabel = (character: CharacterRecord): string | null => {
    const raceValue = character.data?.race;
    if (!raceValue) return null;
    if (typeof raceValue === 'string') return raceValue;
    if (typeof raceValue === 'object' && 'name' in raceValue) {
      return String((raceValue as { name?: string }).name || '');
    }
    return null;
  };

  const getCharacterClassLabel = (character: CharacterRecord): string | null => {
    const classValue = character.data?.class;
    if (classValue) {
      if (typeof classValue === 'string') return classValue;
      if (typeof classValue === 'object' && 'name' in classValue) {
        return String((classValue as { name?: string }).name || '');
      }
    }

    const classesValue = character.data?.classes;
    if (Array.isArray(classesValue) && classesValue.length > 0) {
      const firstClass = classesValue[0] as { name?: string };
      if (firstClass?.name) return String(firstClass.name);
    }

    return null;
  };

  const getCharacterLevelLabel = (character: CharacterRecord): number | null => {
    const levelValue = character.data?.level;
    if (typeof levelValue === 'number') return levelValue;
    return null;
  };

  const syncLocalCharactersToServer = React.useCallback(async () => {
    if (!isAuthenticated || charactersLoading) return;
    if (syncInFlightRef.current) return;

    const syncKey = `${localCharacters.length}:${characters.length}`;
    if (lastSyncKeyRef.current === syncKey) return;
    lastSyncKeyRef.current = syncKey;

    syncInFlightRef.current = true;
    try {
      const serverHashes = new Set(
        characters
          .map((character) => characterHash(character.data ?? {}))
          .filter((hash) => hash.length > 0),
      );

      const missing = localCharacters.filter((character) => {
        const hash = characterHash(character);
        return !serverHashes.has(hash);
      });

      if (missing.length === 0) {
        return;
      }

      for (const character of missing) {
        try {
          const response = await fetch('/api/characters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: character.name,
              data: character,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn(
              `Failed to sync character ${character.name}:`,
              errorData.error || response.statusText,
            );
          }
        } catch (error) {
          console.warn(
            `Failed to sync character ${character.name}:`,
            error,
          );
        }
      }

      const refreshed = await fetch('/api/characters', {
        credentials: 'include',
      });
      if (refreshed.ok) {
        const data = await refreshed.json();
        setCharacters(data);
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [isAuthenticated, charactersLoading, localCharacters, characters]);

  useEffect(() => {
    syncLocalCharactersToServer();
  }, [syncLocalCharactersToServer]);

  /**
   * Handles saving a character (create or update)
   */
  const handleSaveCharacter = (character: CharacterRecord) => {
    if (editingCharacter) {
      // Update existing character
      setCharacters(
        characters.map((c) => (c.id === character.id ? character : c)),
      );
    } else {
      // Add new character
      setCharacters([character, ...characters]);
    }
  };

  /**
   * Handles deleting a character
   */
  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('Are you sure you want to delete this character?')) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/characters/${characterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete character');
      }

      setCharacters(characters.filter((c) => c.id !== characterId));
    } catch (err) {
      console.error('Error deleting character:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to delete character',
      );
    }
  };

  /**
   * Handles starting a game session from a campaign
   * @param {string} campaignId - Campaign ID to start session with
   */
  const handleStartSession = async (campaignId: string) => {
    // DMs don't need character selection - they're hosting the game
    try {
      setStartingSession(campaignId);
      setError(null);

      console.log(`🎮 Starting session for campaign: ${campaignId}`);
      const campaign = campaigns.find((item) => item.id === campaignId);

      // Create game room with campaign ID
      const gameConfig = {
        name: 'Quick Session',
        description: 'Session started from dashboard',
        estimatedTime: '2-4 hours',
        campaignType: 'campaign' as const,
        maxPlayers: 6,
        campaignId,
        preferredRoomCode: campaign?.lastRoomCode || undefined,
      };

      const roomCode = await createGameRoom(gameConfig);

      // Navigate to game view
      console.log(
        '✅ Session started successfully, navigating to game room:',
        roomCode,
      );
      navigate(`/lobby/game/${roomCode}`);
    } catch (err) {
      console.error('Error starting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setStartingSession(null);
    }
  };

  const handleCharacterSelected = async (
    character: Character | null,
    joinAsSpectator: boolean,
  ) => {
    if (!joiningCampaign) return;

    try {
      setShowCharacterSelectionModal(false);
      setStartingSession(joiningCampaign.id);
      setError(null);

      console.log(`🎮 Starting session for campaign: ${joiningCampaign.id}`);
      if (character) {
        console.log(`🎭 Joining with character: ${character.name}`);
      } else if (joinAsSpectator) {
        console.log(`👁️ Joining as spectator`);
      }

      // Create game room with campaign ID
      const gameConfig = {
        name: 'Quick Session',
        description: 'Session started from dashboard',
        estimatedTime: '2-4 hours',
        campaignType: 'campaign' as const,
        maxPlayers: 6,
        campaignId: joiningCampaign.id,
        preferredRoomCode: joiningCampaign.lastRoomCode || undefined,
      };

      const roomCode = await createGameRoom(gameConfig);

      // If joining with a character, auto-place their token
      if (character) {
        // Auto-place token will be handled by the game store's auto-placement logic after room is created
        // We'll defer this to after the room is created and we have an active scene
        setTimeout(() => {
          const { autoPlaceCharacterToken } = useGameStore.getState();
          const { sceneState } = useGameStore.getState();
          if (sceneState.activeSceneId) {
            autoPlaceCharacterToken(character.id, sceneState.activeSceneId);
          }
        }, 1000);
      }

      // Navigate to game view
      console.log(
        '✅ Session started successfully, navigating to game room:',
        roomCode,
      );
      navigate(`/lobby/game/${roomCode}`);
    } catch (err) {
      console.error('Error starting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setStartingSession(null);
      setJoiningCampaign(null);
    }
  };

  /**
   * Handles room code entry - shows character selection modal
   */
  const handleJoinGame = () => {
    if (!joinRoomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    // Close room code modal and show character selection
    setShowJoinGameModal(false);
    setShowCharacterSelectionModal(true);
    // joiningCampaign will be null for room code joins
  };

  /**
   * Handles joining with selected character after room code entry
   */
  const handleJoinGameWithCharacter = async (
    character: Character | null,
    joinAsSpectator: boolean,
  ) => {
    if (!joinRoomCode.trim()) {
      setError('Room code is missing');
      return;
    }

    try {
      setJoiningGame(true);
      setShowCharacterSelectionModal(false);
      setError(null);

      console.log(`🎮 Joining game with room code: ${joinRoomCode}`);
      if (character) {
        console.log(`🎭 Joining with character: ${character.name}`);
      } else if (joinAsSpectator) {
        console.log(`👁️ Joining as spectator`);
      }

      const playerCharacter = character
        ? convertCharacterToPlayerCharacter(character)
        : undefined;

      // Join the room - this will connect via WebSocket
      await joinRoomWithCode(joinRoomCode.trim().toUpperCase(), playerCharacter);

      // Navigate to game view
      console.log('✅ Joined game successfully, navigating to game room');
      navigate(`/lobby/game/${joinRoomCode.trim().toUpperCase()}`);

      // Reset
      setJoinRoomCode('');
    } catch (err) {
      console.error('Error joining game:', err);
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setJoiningGame(false);
    }
  };

  const recentCampaigns = [...campaigns]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    ;

  const uniqueCharacters = React.useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...characters].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return ordered.filter((character) => {
      const hash = characterHash(character.data ?? {});
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });
  }, [characters]);

  const recentCharacters = uniqueCharacters;

  const selectableCharacters = React.useMemo(() => {
    return characters
      .map((record) => buildCharacterFromRecord(record, user.id))
      .filter((character): character is Character => !!character);
  }, [characters, user.id]);

  // Show loading while checking authentication
  if (authChecking) {
    return (
      <div className="dashboard-page">
        <div className="auth-check-loading">
          <div className="loading-state">
            <span className="loading-spinner"></span>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === selectedCampaignId,
  );

  const handleExportCampaignBackup = async () => {
    if (!selectedCampaign) {
      setError('Select a campaign to export a backup.');
      return;
    }

    setCampaignBackupExporting(true);
    try {
      const scenes = Array.isArray(selectedCampaign.scenes)
        ? (selectedCampaign.scenes as Scene[])
        : [];

      const backup = buildCampaignBackup({
        scenes,
        campaign: {
          id: selectedCampaign.id,
          name: selectedCampaign.name,
          description: selectedCampaign.description,
        },
      });

      downloadCampaignBackup(
        backup,
        buildCampaignBackupFilename(selectedCampaign.name),
      );
      setError(null);
    } catch (err) {
      console.error('Failed to export campaign backup:', err);
      setError('Failed to export campaign backup. Please try again.');
    } finally {
      setCampaignBackupExporting(false);
    }
  };

  const handleImportCampaignBackup = async () => {
    if (!selectedCampaign) {
      setError('Select a campaign to import a backup.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setCampaignBackupImporting(true);
      try {
        const backup = await parseCampaignBackup(file);
        const confirmImport = confirm(
          'Importing a backup will replace the selected campaign scenes. Continue?',
        );
        if (!confirmImport) {
          return;
        }

        applyCampaignBackupAssets(backup);
        await tokenAssetManager.initialize();
        await tokenAssetManager.refreshCustomizations();
        await propAssetManager.initialize();
        await propAssetManager.refreshCustomLibraries();

        const response = await fetch(
          `/api/campaigns/${selectedCampaign.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ scenes: backup.scenes }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to import backup');
        }

        setCampaigns((prev) =>
          prev.map((campaign) =>
            campaign.id === selectedCampaign.id
              ? {
                  ...campaign,
                  scenes: backup.scenes,
                  updatedAt: new Date().toISOString(),
                }
              : campaign,
          ),
        );
        setError(null);
      } catch (err) {
        console.error('Failed to import campaign backup:', err);
        setError('Failed to import campaign backup. Please try again.');
      } finally {
        setCampaignBackupImporting(false);
      }
    };

    input.click();
  };

  return (
    <>
      <div className="dashboard-page">
        <div className="dashboard-hero glass-panel">
          <div className="hero-left">
            <div className="avatar-circle">{user.name?.[0] || '🧭'}</div>
            <div>
              <p className="eyebrow">Dashboard</p>
              <h1 className="hero-title">
                Welcome, {user.name || user.displayName || 'Adventurer'}!
              </h1>
              <p className="hero-subtitle">
                Jump back into your worlds, manage characters, and start a new
                session.
              </p>
              <div className="hero-actions">
                <button
                  onClick={() => setShowNewCampaignModal(true)}
                  className="action-btn glass-button primary"
                  disabled={loading}
                >
                  <span>✨</span>
                  Create Campaign
                </button>
                <button
                  onClick={handleCreateCharacter}
                  className="action-btn glass-button secondary"
                  disabled={charactersLoading}
                >
                  <span>🎭</span>
                  Create Character
                </button>
                <button
                  onClick={() => setShowJoinGameModal(true)}
                  className="action-btn glass-button tertiary"
                >
                  <span>🎲</span>
                  Join Game
                </button>
              </div>
            </div>
          </div>
          <div className="hero-stats">
            <div className="dashboard-lobby-action">
              <button
                onClick={() => navigate('/lobby')}
                className="dashboard-lobby-button dashboard-lobby-button--3d glass-button secondary"
              >
                <span>🏠</span>
                Return to Lobby
              </button>
            </div>
            <div className="stat-card glass-panel">
              <p className="stat-label">Campaigns</p>
              <p className="stat-value">{campaigns.length}</p>
            </div>
            <div className="stat-card glass-panel">
              <p className="stat-label">Characters</p>
              <p className="stat-value">{characters.length}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message glass-panel error">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="dashboard-grid-layout">
          <div className="dashboard-main">
            {/* Recent Campaigns */}
            <div className="dashboard-section">
              <div className="section-header document-section-header">
                <h2>Recent Campaigns</h2>
                <div className="section-actions">
                  <button
                    onClick={handleImportCampaignBackup}
                    className="action-btn glass-button secondary"
                    disabled={campaignBackupImporting}
                  >
                    <span>📤</span>
                    {campaignBackupImporting ? 'Importing...' : 'Import Backup'}
                  </button>
                  <button
                    onClick={handleExportCampaignBackup}
                    className="action-btn glass-button secondary"
                    disabled={campaignBackupExporting}
                  >
                    <span>📥</span>
                    {campaignBackupExporting ? 'Exporting...' : 'Export Backup'}
                  </button>
                  <button
                    onClick={() => setShowNewCampaignModal(true)}
                    className="action-btn glass-button primary"
                    disabled={loading}
                  >
                    <span>➕</span>
                    New Campaign
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="skeleton-grid">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton-card" />
                  ))}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="empty-state glass-panel">
                  <div className="empty-state-icon">🎲</div>
                  <h3>No campaigns yet</h3>
                  <p>Create your first campaign to start your adventure!</p>
                  <button
                    onClick={() => setShowNewCampaignModal(true)}
                    className="action-btn glass-button primary"
                  >
                    <span>➕</span>
                    Create Campaign
                  </button>
                </div>
              ) : (
                <div className="glass-panel dashboard-card-panel">
                  <div className="card-row">
                    {recentCampaigns.map((campaign) => (
                      <div key={campaign.id} className="card glass-panel">
                        <div className="card-top">
                          <p className="eyebrow">Campaign</p>
                          <div className="card-top-actions">
                            <label className="campaign-select">
                              <input
                                type="radio"
                                name="selected-campaign"
                                checked={selectedCampaignId === campaign.id}
                                onChange={() =>
                                  setSelectedCampaignId(campaign.id)
                                }
                              />
                              <span>Backup</span>
                            </label>
                            <span className="pill">
                              {new Date(campaign.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <h3>{campaign.name}</h3>
                        {campaign.description && (
                          <p className="card-desc">{campaign.description}</p>
                        )}
                        <div className="card-actions">
                          <button
                            className="action-btn glass-button primary small"
                            onClick={() => handleStartSession(campaign.id)}
                            disabled={startingSession !== null}
                          >
                            {startingSession === campaign.id
                              ? 'Starting...'
                              : 'Start Session'}
                          </button>
                          <button className="action-btn glass-button secondary small">
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Characters */}
            <div className="dashboard-section">
                <div className="section-header document-section-header">
                  <h2>Recent Characters</h2>
                  <div className="section-actions">
                    <button
                      onClick={handleOpenImportModal}
                      className="action-btn glass-button primary"
                      disabled={charactersLoading}
                      title="Import characters from 5e Character Forge or other sources"
                    >
                      <span>📥</span>
                      Import
                    </button>
                    <button
                      onClick={handleClearAllCharacters}
                      className="action-btn glass-button danger"
                      disabled={charactersLoading || characters.length === 0}
                      title="Delete all characters"
                    >
                      <span>🗑️</span>
                      Clear All
                    </button>
                    <button
                      onClick={handleCreateCharacter}
                      className="action-btn glass-button primary"
                      disabled={charactersLoading}
                    >
                    <span>➕</span>
                    New Character
                  </button>
                </div>
              </div>

              {charactersLoading ? (
                <div className="skeleton-grid">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton-card" />
                  ))}
                </div>
              ) : characters.length === 0 ? (
                <>
                  {importMessage && (
                    <div className="info-message glass-panel success">
                      {importMessage}
                    </div>
                  )}
                <div className="empty-state glass-panel">
                  <div className="empty-state-icon">⚔️</div>
                  <h3>No characters yet</h3>
                  <p>Create your first character to start adventuring!</p>
                  <button
                    onClick={handleCreateCharacter}
                    className="action-btn glass-button primary"
                  >
                    <span>➕</span>
                    Create Character
                  </button>
                </div>
                </>
              ) : (
                <div className="glass-panel dashboard-card-panel">
                  <div className="card-row">
                    {importMessage && (
                      <div className="info-message glass-panel success">
                        {importMessage}
                      </div>
                    )}
                    {recentCharacters.map((character) => (
                      <div key={character.id} className="card glass-panel">
                        <div className="card-top">
                          <p className="eyebrow">Character</p>
                          <span className="pill">
                            {new Date(character.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3>{character.name}</h3>
                        <div className="card-tags">
                          {getCharacterRaceLabel(character) && (
                            <span>{getCharacterRaceLabel(character)}</span>
                          )}
                          {getCharacterClassLabel(character) && (
                            <span>{getCharacterClassLabel(character)}</span>
                          )}
                          {getCharacterLevelLabel(character) !== null && (
                            <span>Level {getCharacterLevelLabel(character)}</span>
                          )}
                        </div>
                        <div className="card-actions">
                          <button
                            className="action-btn glass-button secondary small"
                            onClick={() => handleEditCharacter(character)}
                          >
                            Edit
                          </button>
                          <button
                            className="action-btn glass-button secondary small"
                            onClick={() => handleDeleteCharacter(character.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Document Library Section */}
            <DocumentLibrary />
          </div>
        </div>

        {/* New Campaign Modal */}
        {showNewCampaignModal && (
          <div
            className="modal-overlay"
            onClick={() => !creatingCampaign && setShowNewCampaignModal(false)}
          >
            <div
              className="modal-content glass-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Create New Campaign</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowNewCampaignModal(false)}
                  disabled={creatingCampaign}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="input-group">
                  <label htmlFor="campaignName">Campaign Name *</label>
                  <div className="glass-input-wrapper">
                    <input
                      id="campaignName"
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="Enter campaign name"
                      className="glass-input"
                      disabled={creatingCampaign}
                      maxLength={255}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="campaignDescription">
                    Description (optional)
                  </label>
                  <div className="glass-input-wrapper">
                    <textarea
                      id="campaignDescription"
                      value={newCampaignDescription}
                      onChange={(e) =>
                        setNewCampaignDescription(e.target.value)
                      }
                      placeholder="Describe your campaign..."
                      className="glass-input"
                      disabled={creatingCampaign}
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="action-btn glass-button secondary"
                  onClick={() => setShowNewCampaignModal(false)}
                  disabled={creatingCampaign}
                >
                  Cancel
                </button>
                <button
                  className="action-btn glass-button primary"
                  onClick={handleCreateCampaign}
                  disabled={!newCampaignName.trim() || creatingCampaign}
                >
                  {creatingCampaign ? (
                    <>
                      <span className="loading-spinner"></span>
                      Creating...
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      Create Campaign
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Character Manager Modal */}
        {showCharacterModal && (
          <CharacterManager
            character={editingCharacter}
            onClose={() => setShowCharacterModal(false)}
            onSave={handleSaveCharacter}
          />
        )}

        {/* Join Game Modal */}
        {showJoinGameModal && (
          <div
            className="modal-overlay"
            onClick={() => !joiningGame && setShowJoinGameModal(false)}
          >
            <div
              className="modal-content glass-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Join Game</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowJoinGameModal(false)}
                  disabled={joiningGame}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <p
                  style={{
                    marginBottom: '1rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Enter the room code provided by your Dungeon Master to join
                  their game.
                </p>

                <div className="input-group">
                  <label htmlFor="roomCode">Room Code *</label>
                  <div className="glass-input-wrapper">
                    <input
                      id="roomCode"
                      type="text"
                      value={joinRoomCode}
                      onChange={(e) =>
                        setJoinRoomCode(e.target.value.toUpperCase())
                      }
                      placeholder="e.g., ABC123"
                      className="glass-input"
                      disabled={joiningGame}
                      maxLength={6}
                      style={{ textTransform: 'uppercase' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && joinRoomCode.trim()) {
                          handleJoinGame();
                        }
                      }}
                    />
                  </div>
                </div>

                {characters.length > 0 && (
                  <div className="input-group">
                    <label>Your Characters</label>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      You have {characters.length} character
                      {characters.length !== 1 ? 's' : ''} available to use in
                      this game.
                    </p>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {characters.map((character) => (
                        <div
                          key={character.id}
                          style={{
                            padding: '0.5rem',
                            marginBottom: '0.25rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                          }}
                        >
                          <strong>{character.name}</strong>
                          {character.data.race && character.data.class && (
                            <span
                              style={{
                                marginLeft: '0.5rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              ({character.data.race} {character.data.class})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="action-btn glass-button secondary"
                  onClick={() => setShowJoinGameModal(false)}
                  disabled={joiningGame}
                >
                  Cancel
                </button>
                <button
                  className="action-btn glass-button primary"
                  onClick={handleJoinGame}
                  disabled={!joinRoomCode.trim() || joiningGame}
                >
                  {joiningGame ? (
                    <>
                      <span className="loading-spinner"></span>
                      Joining...
                    </>
                  ) : (
                    <>
                      <span>🎲</span>
                      Join Game
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Character Selection Modal */}
      <CharacterSelectionModal
        isOpen={showCharacterSelectionModal}
        onClose={() => {
          setShowCharacterSelectionModal(false);
          setJoiningCampaign(null);
          // If closing during room code join, restore the join modal
          if (!joiningCampaign && joinRoomCode.trim()) {
            setShowJoinGameModal(true);
          }
        }}
        onSelect={
          joiningCampaign
            ? handleCharacterSelected
            : handleJoinGameWithCharacter
        }
        availableCharacters={selectableCharacters}
        campaignId={joiningCampaign?.id}
        campaignName={joiningCampaign?.name || (joinRoomCode.trim() ? `Room ${joinRoomCode.trim().toUpperCase()}` : undefined)}
      />

      {/* Character Import Modal */}
      <CharacterImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Character Creation Launcher - rendered via portal to overlay everything */}
      {LauncherComponent && createPortal(LauncherComponent, document.body)}
    </>
  );
};

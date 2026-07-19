/**
 * @file Dashboard.tsx
 * @description Connected production user dashboard using the TTRPG Gothic/Fantasy Atomic Design redesign.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import { useCharacterCreationLauncher } from '@/hooks';
import type { GameConfig, PlayerCharacter } from '@/types/game';

// Import our new Atomic components
import { DashboardLayout } from './Dashboard/templates/DashboardLayout';
import {
  Campaign as LayoutCampaign,
  CharacterRecord as LayoutCharacter,
} from './Dashboard/types';
import { GothicHeader } from './Dashboard/atoms/Typography';
import { Button } from './Dashboard/atoms/Button';

// ─── Local API Types ──────────────────────────────────────────────────────────

interface ApiCampaign {
  id: string;
  name: string;
  description: string | null;
  dmId: string;
  lastRoomCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiCharacter {
  id: string;
  name: string;
  ownerId: string;
  data: {
    race?: string;
    class?: string;
    level?: number;
    xp?: number;
    hp?: { current: number; max: number };
    mana?: { current: number; max: number };
    stats?: {
      strength: number;
      dexterity: number;
      constitution: number;
      intelligence: number;
      wisdom: number;
      charisma: number;
    };
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    authChecked,
    joinRoomWithCode,
    createGameRoom,
  } = useGameStore();
  const { startCharacterCreation, LauncherComponent } =
    useCharacterCreationLauncher();

  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [characters, setCharacters] = useState<ApiCharacter[]>([]);
  const [loading, setLoading] = useState(true);

  // Session Modal State
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionCharacter, setSessionCharacter] = useState<ApiCharacter | null>(
    null,
  );
  const [sessionRoomCode, setSessionRoomCode] = useState('');
  const [sessionJoining, setSessionJoining] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Create Campaign Modal State
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignCreating, setCampaignCreating] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // Auth guard — wait for the initial /auth/me probe to resolve before deciding.
  // Redirect only when auth is confirmed resolved AND the user is not signed in,
  // so a slow auth check can never bounce an authenticated user to the lobby.
  useEffect(() => {
    if (authChecked && !isAuthenticated) navigate('/lobby');
  }, [authChecked, isAuthenticated, navigate]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [campRes, charRes] = await Promise.all([
        fetch('/api/campaigns', { credentials: 'include' }),
        fetch('/api/characters', { credentials: 'include' }),
      ]);
      if (campRes.ok) setCampaigns(await campRes.json());
      if (charRes.ok) setCharacters(await charRes.json());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on mount / auth change
  useEffect(() => {
    if (!isAuthenticated) return;
    const timeoutId = window.setTimeout(() => {
      void fetchDashboardData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchDashboardData, isAuthenticated]);

  // Join game with a character
  const handleModalJoin = async () => {
    if (!sessionRoomCode.trim()) return;
    setSessionJoining(true);
    setSessionError(null);
    try {
      await joinRoomWithCode(
        sessionRoomCode.trim().toUpperCase(),
        sessionCharacter as unknown as PlayerCharacter,
      );
      navigate(`/lobby/game/${sessionRoomCode.trim().toUpperCase()}`);
    } catch (err) {
      setSessionError(
        err instanceof Error ? err.message : 'Failed to join game',
      );
    } finally {
      setSessionJoining(false);
    }
  };

  const handleStartSession = (layoutChar: LayoutCharacter) => {
    // Map layout character back to api character
    const apiChar = characters.find((c) => c.id === layoutChar.id) || null;
    setSessionCharacter(apiChar);
    setSessionRoomCode('');
    setSessionError(null);
    setSessionModalOpen(true);
  };

  const handleEditCharacter = (layoutChar: LayoutCharacter) => {
    alert(`Editing character: ${layoutChar.name}`);
  };

  const handleDeleteCharacter = async (layoutChar: LayoutCharacter) => {
    if (confirm(`Are you sure you want to retire ${layoutChar.name}?`)) {
      try {
        const res = await fetch(`/api/characters/${layoutChar.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          await fetchDashboardData();
        }
      } catch {
        alert('Failed to delete character');
      }
    }
  };

  const handlePlayCampaign = async (layoutCamp: LayoutCampaign) => {
    const apiCamp = campaigns.find((c) => c.id === layoutCamp.id);
    if (!apiCamp) return;

    const gameConfig: GameConfig = {
      name: apiCamp.name,
      description: apiCamp.description || '',
      estimatedTime: '',
      campaignType: 'campaign',
      maxPlayers: 6,
      campaignId: apiCamp.id,
      preferredRoomCode: apiCamp.lastRoomCode?.toUpperCase(),
    };

    try {
      const roomCode = await createGameRoom(gameConfig, false);
      navigate(`/lobby/game/${roomCode}`);
    } catch (error) {
      console.error('Failed to play campaign:', error);
      alert('Failed to open campaign. Please try again.');
    }
  };

  const handleEditCampaign = (layoutCamp: LayoutCampaign) => {
    alert(`Editing campaign settings for: ${layoutCamp.name}`);
  };

  const handleDeleteCampaign = async (layoutCamp: LayoutCampaign) => {
    if (
      confirm(
        `Are you sure you want to delete the campaign: ${layoutCamp.name}?`,
      )
    ) {
      try {
        const res = await fetch(`/api/campaigns/${layoutCamp.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          await fetchDashboardData();
        } else {
          const body = await res.json().catch(() => ({}));
          alert(body.error || `Failed to delete campaign (HTTP ${res.status})`);
        }
      } catch {
        alert('Failed to delete campaign');
      }
    }
  };

  const handleCreateCampaign = () => {
    setCampaignName('');
    setCampaignDescription('');
    setCampaignError(null);
    setCampaignModalOpen(true);
  };

  const handleCampaignSubmit = async () => {
    const name = campaignName.trim();
    if (!name) {
      setCampaignError('Campaign name is required.');
      return;
    }
    setCampaignCreating(true);
    setCampaignError(null);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: campaignDescription.trim() || undefined,
        }),
      });
      if (res.ok) {
        setCampaignModalOpen(false);
        await fetchDashboardData();
      } else {
        const body = await res.json().catch(() => ({}));
        setCampaignError(
          body.error || `Failed to create campaign (HTTP ${res.status})`,
        );
      }
    } catch {
      setCampaignError('Failed to create campaign');
    } finally {
      setCampaignCreating(false);
    }
  };

  const handleCreateCharacter = () => {
    startCharacterCreation(user.id, 'modal', () => {
      // Refresh characters list after wizard completion
      fetch('/api/characters', { credentials: 'include' })
        .then((r) => r.json())
        .then(setCharacters)
        .catch(() => undefined);
    });
  };

  const handleJoinGame = () => {
    setSessionCharacter(null);
    setSessionRoomCode('');
    setSessionError(null);
    setSessionModalOpen(true);
  };

  const handleClearAll = async () => {
    if (confirm('Clear all local game data and sessions?')) {
      try {
        await fetch('/api/dev/clear-all', { method: 'POST' });
        await fetchDashboardData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // MAPPERS: Map API payload to layout structures
  const mappedCampaigns: LayoutCampaign[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: c.description || 'A grand virtual tabletop campaign.',
    characterClass: 'Adventurer',
    characterRace: 'VTT',
    characterLevel: 1,
    updatedAt: c.updatedAt,
  }));

  // Characters arrive in several historical shapes: wizard-created and
  // dashboard-facing records use lowercase `stats` + `hp`/`mana`/`xp`, while
  // test-generated / sheet-style records use `abilities` (STR/DEX…) + `hitPoints`.
  // Normalize defensively so every record renders regardless of origin.
  const DEFAULT_STATS = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  const ABILITY_TO_STAT: Record<string, keyof typeof DEFAULT_STATS> = {
    STR: 'strength',
    DEX: 'dexterity',
    CON: 'constitution',
    INT: 'intelligence',
    WIS: 'wisdom',
    CHA: 'charisma',
  };

  const deriveStats = (data: ApiCharacter['data']) => {
    if (data.stats) return data.stats;
    const abilities = data.abilities as
      Record<string, { score?: number }> | undefined;
    if (abilities) {
      const out = { ...DEFAULT_STATS };
      for (const [abbr, statKey] of Object.entries(ABILITY_TO_STAT)) {
        const score = abilities[abbr]?.score;
        if (typeof score === 'number') out[statKey] = score;
      }
      return out;
    }
    return DEFAULT_STATS;
  };

  const deriveHp = (data: ApiCharacter['data']) => {
    if (data.hp) return data.hp;
    const max = data.maxHitPoints as number | undefined;
    const current = data.hitPoints as number | undefined;
    if (typeof max === 'number') {
      return { current: typeof current === 'number' ? current : max, max };
    }
    return undefined;
  };

  const mappedCharacters: LayoutCharacter[] = characters.map((c) => {
    const data = c.data || ({} as ApiCharacter['data']);
    return {
      id: c.id,
      name: c.name,
      level: data.level ?? 1,
      klass: data.class || 'Adventurer',
      race: data.race || 'Human',
      xp: data.xp,
      hp: deriveHp(data),
      mana: data.mana,
      stats: deriveStats(data),
      updatedAt: c.updatedAt,
    };
  });

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121417] text-[#f1e6d3]">
        <div className="bg-[#252a31] border border-[#8c6b4a]/30 p-8 text-[#cbd5e1]/80 animate-pulse font-serif rounded-sm shadow-md">
          Checking authentication…
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardLayout
        userName={user.name || 'Traveler'}
        campaigns={mappedCampaigns}
        characters={mappedCharacters}
        loading={loading}
        onBack={() => navigate('/lobby')}
        onCreateCharacter={handleCreateCharacter}
        onJoinGame={handleJoinGame}
        onImport={() => alert('Importing JSON sheets...')}
        onExport={() => alert('Exporting sheets...')}
        onClearAll={handleClearAll}
        onPlayCampaign={handlePlayCampaign}
        onCreateCampaign={handleCreateCampaign}
        onEditCampaign={handleEditCampaign}
        onDeleteCampaign={handleDeleteCampaign}
        onStartCharacterSession={handleStartSession}
        onEditCharacter={handleEditCharacter}
        onDeleteCharacter={handleDeleteCharacter}
      />

      {/* Character creation wizard portal hook output */}
      {LauncherComponent}

      {/* Start Session / Join Game Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="
            relative bg-[#252a31] border-4 border-double border-[#8c6b4a]/60
            rounded-sm p-6 w-full max-w-sm shadow-2xl font-sans text-[#f1e6d3]
          "
          >
            {/* Parchment background overlay inside modal */}
            <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              }}
            />

            <GothicHeader
              level={3}
              variant="medieval"
              className="mb-4 border-b border-[#8c6b4a]/30 pb-2"
            >
              {sessionCharacter
                ? `Start Session: ${sessionCharacter.name}`
                : 'Join Game'}
            </GothicHeader>

            <p className="text-xs text-[#cbd5e1]/80 mb-4 font-serif italic">
              {sessionCharacter
                ? "Enter the GM's room code to enter the lobby with this character."
                : "Enter the GM's room code to connect to the lobby."}
            </p>

            <input
              type="text"
              placeholder="ROOM CODE"
              value={sessionRoomCode}
              maxLength={6}
              onChange={(e) => setSessionRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleModalJoin()}
              className="
                w-full px-3 py-2 rounded-sm text-[#f1e6d3] placeholder:text-[#cbd5e1]/30
                bg-[#1c1e22] border border-[#8c6b4a]/40 outline-none
                focus:border-[#d97706] focus:shadow-vtt-amber-glow
                transition-all duration-200 text-sm font-mono uppercase tracking-widest text-center mb-4
              "
              autoFocus
            />

            {sessionError && (
              <p className="text-red-500 text-xs mb-4 font-medium">
                {sessionError}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-[#8c6b4a]/20 pt-3 mt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSessionModalOpen(false);
                  setSessionError(null);
                  setSessionRoomCode('');
                  setSessionCharacter(null);
                }}
                className="!text-[#cbd5e1]/60 hover:!text-[#f1e6d3]"
              >
                Cancel
              </Button>
              <Button
                variant="bronze"
                onClick={handleModalJoin}
                disabled={sessionJoining || !sessionRoomCode.trim()}
              >
                {sessionJoining ? 'Joining…' : 'Enter Lobby'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {campaignModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="
            relative bg-[#252a31] border-4 border-double border-[#8c6b4a]/60
            rounded-sm p-6 w-full max-w-sm shadow-2xl font-sans text-[#f1e6d3]
          "
          >
            {/* Parchment background overlay inside modal */}
            <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              }}
            />

            <GothicHeader
              level={3}
              variant="medieval"
              className="mb-4 border-b border-[#8c6b4a]/30 pb-2"
            >
              New Campaign
            </GothicHeader>

            <p className="text-xs text-[#cbd5e1]/80 mb-4 font-serif italic">
              Name your campaign to begin chronicling a new adventure.
            </p>

            <label className="block text-[10px] uppercase font-bold tracking-widest text-amber-500 mb-1">
              Campaign Name
            </label>
            <input
              type="text"
              placeholder="The Lost Mine of Phandelver"
              value={campaignName}
              maxLength={255}
              onChange={(e) => setCampaignName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCampaignSubmit()}
              className="
                w-full px-3 py-2 rounded-sm text-[#f1e6d3] placeholder:text-[#cbd5e1]/30
                bg-[#1c1e22] border border-[#8c6b4a]/40 outline-none
                focus:border-[#d97706] focus:shadow-vtt-amber-glow
                transition-all duration-200 text-sm mb-4
              "
              autoFocus
            />

            <label className="block text-[10px] uppercase font-bold tracking-widest text-amber-500 mb-1">
              Description{' '}
              <span className="text-[#cbd5e1]/40 normal-case font-normal">
                (optional)
              </span>
            </label>
            <textarea
              placeholder="A short summary of the adventure ahead…"
              value={campaignDescription}
              rows={3}
              onChange={(e) => setCampaignDescription(e.target.value)}
              className="
                w-full px-3 py-2 rounded-sm text-[#f1e6d3] placeholder:text-[#cbd5e1]/30
                bg-[#1c1e22] border border-[#8c6b4a]/40 outline-none resize-none
                focus:border-[#d97706] focus:shadow-vtt-amber-glow
                transition-all duration-200 text-sm font-serif mb-4
              "
            />

            {campaignError && (
              <p className="text-red-500 text-xs mb-4 font-medium">
                {campaignError}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-[#8c6b4a]/20 pt-3 mt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setCampaignModalOpen(false);
                  setCampaignError(null);
                }}
                className="!text-[#cbd5e1]/60 hover:!text-[#f1e6d3]"
              >
                Cancel
              </Button>
              <Button
                variant="bronze"
                onClick={handleCampaignSubmit}
                disabled={campaignCreating || !campaignName.trim()}
              >
                {campaignCreating ? 'Creating…' : 'Create Campaign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

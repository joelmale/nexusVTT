/**
 * @file Dashboard.tsx
 * @description Connected production user dashboard using the TTRPG Gothic/Fantasy Atomic Design redesign.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import { useCharacterCreationLauncher } from '@/hooks';
import type { PlayerCharacter } from '@/types/game';

// Import our new Atomic components
import { DashboardLayout } from './Dashboard/templates/DashboardLayout';
import { Campaign as LayoutCampaign, CharacterRecord as LayoutCharacter } from './Dashboard/types';
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
  const { user, isAuthenticated, joinRoomWithCode } = useGameStore();
  const { startCharacterCreation, LauncherComponent } = useCharacterCreationLauncher();

  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [characters, setCharacters] = useState<ApiCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);

  // Session Modal State
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionCharacter, setSessionCharacter] = useState<ApiCharacter | null>(null);
  const [sessionRoomCode, setSessionRoomCode] = useState('');
  const [sessionJoining, setSessionJoining] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    const t = setTimeout(() => {
      setAuthChecking(false);
      if (!isAuthenticated) navigate('/lobby');
    }, 1000);
    return () => clearTimeout(t);
  }, [isAuthenticated, navigate]);

  const fetchDashboardData = async () => {
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
  };

  // Fetch data on mount / auth change
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDashboardData();
  }, [isAuthenticated]);

  // Join game with a character
  const handleModalJoin = async () => {
    if (!sessionRoomCode.trim()) return;
    setSessionJoining(true);
    setSessionError(null);
    try {
      await joinRoomWithCode(
        sessionRoomCode.trim().toUpperCase(),
        sessionCharacter as unknown as PlayerCharacter
      );
      navigate(`/lobby/game/${sessionRoomCode.trim().toUpperCase()}`);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to join game');
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

    if (apiCamp.lastRoomCode) {
      try {
        await joinRoomWithCode(apiCamp.lastRoomCode);
        navigate(`/lobby/game/${apiCamp.lastRoomCode}`);
      } catch {
        navigate('/lobby');
      }
    } else {
      navigate('/lobby');
    }
  };

  const handleEditCampaign = (layoutCamp: LayoutCampaign) => {
    alert(`Editing campaign settings for: ${layoutCamp.name}`);
  };

  const handleDeleteCampaign = async (layoutCamp: LayoutCampaign) => {
    if (confirm(`Are you sure you want to delete the campaign: ${layoutCamp.name}?`)) {
      try {
        const res = await fetch(`/api/campaigns/${layoutCamp.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          await fetchDashboardData();
        }
      } catch {
        alert('Failed to delete campaign');
      }
    }
  };

  const handleCreateCharacter = () => {
    startCharacterCreation(
      user.id,
      'modal',
      () => {
        // Refresh characters list after wizard completion
        fetch('/api/characters', { credentials: 'include' })
          .then((r) => r.json())
          .then(setCharacters)
          .catch(() => undefined);
      }
    );
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

  const mappedCharacters: LayoutCharacter[] = characters.map((c) => {
    const stats = c.data.stats || {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    return {
      id: c.id,
      name: c.name,
      level: c.data.level ?? 1,
      klass: c.data.class || 'Adventurer',
      race: c.data.race || 'Human',
      xp: c.data.xp,
      hp: c.data.hp,
      mana: c.data.mana,
      stats,
      updatedAt: c.updatedAt,
    };
  });

  if (authChecking) {
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
        onCreateCharacter={handleCreateCharacter}
        onJoinGame={handleJoinGame}
        onImport={() => alert('Importing JSON sheets...')}
        onExport={() => alert('Exporting sheets...')}
        onClearAll={handleClearAll}
        onPlayCampaign={handlePlayCampaign}
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
          <div className="
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

            <GothicHeader level={3} variant="medieval" className="mb-4 border-b border-[#8c6b4a]/30 pb-2">
              {sessionCharacter ? `Start Session: ${sessionCharacter.name}` : 'Join Game'}
            </GothicHeader>

            <p className="text-xs text-[#cbd5e1]/80 mb-4 font-serif italic">
              {sessionCharacter
                ? 'Enter the GM\'s room code to enter the lobby with this character.'
                : 'Enter the GM\'s room code to connect to the lobby.'}
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

            {sessionError && <p className="text-red-500 text-xs mb-4 font-medium">{sessionError}</p>}

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
    </>
  );
};

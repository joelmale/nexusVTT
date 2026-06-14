/**
 * @file DashboardTailwind.tsx
 * @description Redesigned user dashboard built with Tailwind CSS utilities
 * that are mapped to NexusVTT design tokens.
 *
 * This component is only rendered when the `enableTailwindDashboard` feature
 * flag is enabled in Settings.  All Tailwind classes here reference the token
 * aliases defined in tailwind.config.cjs, so it stays in visual sync with
 * the native-CSS components automatically.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, useSettings } from '@/stores/gameStore';
import { useCharacterCreationLauncher } from '@/hooks';
import type { PlayerCharacter } from '@/types/game';

// Direct Lucide path imports (per AGENTS.md guidance)
import Shield from 'lucide-react/dist/esm/icons/shield';
import Sword from 'lucide-react/dist/esm/icons/sword';
import Map from 'lucide-react/dist/esm/icons/map';
import Download from 'lucide-react/dist/esm/icons/download';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Sprout from 'lucide-react/dist/esm/icons/sprout';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import PlusCircle from 'lucide-react/dist/esm/icons/plus-circle';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2';
import Home from 'lucide-react/dist/esm/icons/home';
import Swords from 'lucide-react/dist/esm/icons/swords';
import Users from 'lucide-react/dist/esm/icons/users';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Search from 'lucide-react/dist/esm/icons/search';
import Filter from 'lucide-react/dist/esm/icons/filter';
import PlayCircle from 'lucide-react/dist/esm/icons/play-circle';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  dmId: string;
  lastRoomCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CharacterRecord {
  id: string;
  name: string;
  ownerId: string;
  data: { race?: string; class?: string; level?: number;[key: string]: unknown };
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Cumulative D&D 5e XP required to reach each level (index 0 = level 1).
const DND5E_XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

/**
 * Derives a level-progress bar for a character. If the character has real XP
 * data we show progress toward the next level; otherwise we fall back to its
 * position along the 1→20 journey so the bar is always meaningful.
 */
function levelProgress(char: CharacterRecord): { pct: number; label: string } {
  const level = Math.min(Math.max(char.data.level ?? 1, 1), 20);
  const rawXp = char.data.xp;
  const xp = typeof rawXp === 'number' ? rawXp : null;

  if (xp !== null && level < 20) {
    const cur = DND5E_XP_THRESHOLDS[level - 1];
    const next = DND5E_XP_THRESHOLDS[level];
    const pct = Math.min(100, Math.max(0, ((xp - cur) / (next - cur)) * 100));
    return { pct, label: `${xp.toLocaleString()} XP` };
  }

  return { pct: (level / 20) * 100, label: `Level ${level} / 20` };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  onPlay: (campaign: Campaign) => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onPlay }) => (
  <div className="bg-vtt-parchment text-vtt-parchment-text border border-vtt-bronze/30 rounded-sm shadow-md flex flex-col justify-between hover:shadow-vtt-amber-glow hover:border-vtt-amber-glow transition-all duration-300 font-interface overflow-hidden min-w-0">

    {/* Top Info Section (Padded independently) */}
    <div className="p-4 mb-1">
      <h3 className="font-fantasy text-lg font-bold tracking-tight text-vtt-parchment-text truncate" title={campaign.name}>
        {campaign.name}
      </h3>
      {campaign.description && (
        <p className="text-xs text-vtt-parchment-text/80 truncate mt-0.5">
          {campaign.description}
        </p>
      )}
      <div className="text-right mt-3">
        <span className="text-[10px] text-vtt-parchment-text/60 font-medium">
          {timeAgo(campaign.updatedAt)}
        </span>
      </div>
    </div>

    {/* Action Bar - Darker Parchment Strip */}
    <div className="bg-vtt-bronze/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-vtt-bronze/20 mt-auto">

      <div className="flex items-center gap-3 min-w-0">
        <button className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-vtt-amber-glow transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap">
          <Pencil size={12} className="flex-shrink-0" />
          <span>Edit</span>
        </button>
        <button className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-red-700 transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap">
          <Trash2 size={12} className="flex-shrink-0" />
          <span>Delete</span>
        </button>
      </div>

      <button
        onClick={() => onPlay(campaign)}
        className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text hover:text-vtt-amber-glow transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap"
      >
        <PlayCircle size={12} className="flex-shrink-0" />
        <span>Play</span>
      </button>

    </div>
  </div>
);

interface CharacterBadgeProps {
  character: CharacterRecord;
  onStartSession: (char: CharacterRecord) => void;
  onEdit: (char: CharacterRecord) => void;
  onDelete: (char: CharacterRecord) => void;
}

const CharacterBadge: React.FC<CharacterBadgeProps> = ({ character, onStartSession, onEdit, onDelete }) => (
  <div className="bg-vtt-parchment text-vtt-parchment-text border border-vtt-bronze/30 rounded-sm shadow-md flex flex-col justify-between hover:shadow-vtt-amber-glow hover:border-vtt-amber-glow transition-all duration-300 font-interface overflow-hidden min-w-0">
    
    {/* Top Info Section (Padded independently) */}
    <div className="p-4 mb-1">
      <h4 className="font-fantasy text-lg font-bold tracking-tight truncate text-vtt-parchment-text" title={character.name}>
        {character.name}
      </h4>
      <p className="text-xs text-vtt-parchment-text/80 truncate mt-0.5 capitalize">
        lvl {character.data.level ?? 1} {character.data.class || 'Unknown'}, {character.data.race || 'Unknown'}
      </p>
      <p className="text-[10px] text-vtt-parchment-text/60 mt-2 font-medium">
        {new Date(character.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
    {/* Action Bar - Darker Parchment Strip */}
    <div className="bg-vtt-bronze/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-vtt-bronze/20 mt-auto">

      {/* Left side: Edit and Trashcan */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onEdit(character)}
          className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-vtt-amber-glow transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap"
        >
          <Pencil size={12} className="flex-shrink-0" />
          <span>Edit</span>
        </button>
        <button
          onClick={() => onDelete(character)}
          className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-red-700 transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap"
          title="Delete"
        >
          <Trash2 size={12} className="flex-shrink-0" />
          <span>Delete</span>
        </button>
      </div>

      {/* Right side: Start Session */}
      <button
        onClick={() => onStartSession(character)}
        className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text hover:text-vtt-amber-glow transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap"
      >
        <PlayCircle size={12} className="flex-shrink-0" />
        <span>Start Session</span>
      </button>

    </div>
  </div>
);

// ── Dual-stacked character card (XP progress variant) ─────────────────────────

interface CharacterStackEntryProps {
  character: CharacterRecord;
  onStartSession: (char: CharacterRecord) => void;
}

/** A single character row inside a stacked card: name, subtitle, XP bar. */
const CharacterStackEntry: React.FC<CharacterStackEntryProps> = ({ character, onStartSession }) => {
  const { pct, label } = levelProgress(character);
  return (
    <button
      type="button"
      onClick={() => onStartSession(character)}
      className="group/entry block w-full text-left min-w-0 cursor-pointer focus-visible:outline-none"
      title={`Start session with ${character.name}`}
    >
      <h4 className="font-fantasy text-base font-bold tracking-tight truncate text-vtt-parchment-text group-hover/entry:text-vtt-amber-glow transition-colors">
        {character.name}
      </h4>
      <p className="text-[11px] text-vtt-parchment-text/80 truncate capitalize">
        lvl {character.data.level ?? 1} {character.data.class || 'Unknown'}, {character.data.race || 'Unknown'}
      </p>
      {/* XP / level progress bar */}
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative h-1.5 flex-1 min-w-0 rounded-full bg-vtt-bronze/15 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-vtt-bronze to-vtt-amber-glow"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9px] font-semibold text-vtt-parchment-text/55 flex-shrink-0 whitespace-nowrap tabular-nums">
          {label}
        </span>
      </div>
    </button>
  );
};

interface CharacterStackCardProps {
  primary: CharacterRecord;
  secondary?: CharacterRecord;
  onStartSession: (char: CharacterRecord) => void;
  onEdit: (char: CharacterRecord) => void;
  onDelete: (char: CharacterRecord) => void;
}

const CharacterStackCard: React.FC<CharacterStackCardProps> = ({
  primary,
  secondary,
  onStartSession,
  onEdit,
  onDelete,
}) => (
  <div className="bg-vtt-parchment text-vtt-parchment-text border border-vtt-bronze/30 rounded-sm shadow-md flex flex-col justify-between hover:shadow-vtt-amber-glow hover:border-vtt-amber-glow transition-all duration-300 font-interface overflow-hidden min-w-0">
    <div className="p-4 flex flex-col gap-3">
      <CharacterStackEntry character={primary} onStartSession={onStartSession} />
      {secondary && (
        <>
          <div className="h-px bg-vtt-bronze/20" />
          <CharacterStackEntry character={secondary} onStartSession={onStartSession} />
        </>
      )}
    </div>

    {/* Shared action bar — operates on the primary character */}
    <div className="bg-vtt-bronze/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-vtt-bronze/20 mt-auto">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onEdit(primary)}
          className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-vtt-amber-glow transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap"
        >
          <Pencil size={12} className="flex-shrink-0" />
          <span>Edit</span>
        </button>
        <button
          onClick={() => onDelete(primary)}
          className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-red-700 transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap"
          title="Delete"
        >
          <Trash2 size={12} className="flex-shrink-0" />
          <span>Delete</span>
        </button>
      </div>
      <button
        onClick={() => onStartSession(primary)}
        className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text hover:text-vtt-amber-glow transition-colors cursor-pointer focus-visible:outline-none flex-shrink-0 whitespace-nowrap"
      >
        <PlayCircle size={12} className="flex-shrink-0" />
        <span>Start Session</span>
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, joinRoomWithCode } = useGameStore();
  const settings = useSettings();
  const { startCharacterCreation, LauncherComponent } = useCharacterCreationLauncher();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);

  // Session Modal State
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionCharacter, setSessionCharacter] = useState<CharacterRecord | null>(null);
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
    } catch {
      // Silent – we'll show empty states
    } finally {
      setLoading(false);
    }
  };

  // Fetch data
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDashboardData();
  }, [isAuthenticated]);

  const [populating, setPopulating] = useState(false);

  const handlePopulateMockData = async () => {
    try {
      setPopulating(true);
      const res = await fetch('/api/dev/populate-mock-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to populate mock data:', err);
    } finally {
      setPopulating(false);
    }
  };

  const handleModalJoin = async () => {
    if (!sessionRoomCode.trim() || !sessionCharacter) return;
    setSessionJoining(true);
    setSessionError(null);
    try {
      await joinRoomWithCode(sessionRoomCode.trim().toUpperCase(), sessionCharacter as unknown as PlayerCharacter);
      navigate(`/lobby/game/${sessionRoomCode.trim().toUpperCase()}`);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setSessionJoining(false);
    }
  };

  const handleStartSession = (char: CharacterRecord) => {
    setSessionCharacter(char);
    setSessionRoomCode('');
    setSessionError(null);
    setSessionModalOpen(true);
  };

  const handleEditCharacter = (char: CharacterRecord) => {
    alert('Edit character: ' + char.name);
  };

  const handleDeleteCharacter = (char: CharacterRecord) => {
    alert('Delete character: ' + char.name);
  };

  const handleContinueCampaign = async (campaign: Campaign) => {
    if (campaign.lastRoomCode) {
      try {
        await joinRoomWithCode(campaign.lastRoomCode);
        navigate(`/lobby/game/${campaign.lastRoomCode}`);
      } catch {
        // Fall through to lobby
        navigate('/lobby');
      }
    } else {
      navigate('/lobby');
    }
  };

  const handleCreateCharacter = () => {
    startCharacterCreation(
      user.id,
      'modal',
      () => {
        // Refresh characters after creation
        fetch('/api/characters', { credentials: 'include' })
          .then((r) => r.json())
          .then(setCharacters)
          .catch(() => undefined);
      },
    );
  };

  const recent = [...campaigns]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const recentChars = [...characters]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 12);

  // First row = simple cards; the remainder is shown as dual-stacked XP cards.
  const simpleChars = recentChars.slice(0, 4);
  const stackedChars = recentChars.slice(4);
  const stackedPairs: Array<[CharacterRecord, CharacterRecord?]> = [];
  for (let i = 0; i < stackedChars.length; i += 2) {
    stackedPairs.push([stackedChars[i], stackedChars[i + 1]]);
  }

  if (authChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-vtt-iron-900 text-vtt-parchment">
        <div className="bg-vtt-iron-800 border border-vtt-iron-700 p-8 text-vtt-parchment/80 animate-pulse font-interface rounded-sm shadow-md">
          Checking authentication…
        </div>
      </div>
    );
  }

  return (
    // data-reduced-motion attr lets @layer rules disable transitions for accessibility
    <div
      className="min-h-screen p-4 md:p-6 font-interface bg-vtt-iron-900 text-vtt-parchment"
      data-reduced-motion={settings.reducedMotion ? 'true' : 'false'}
    >
      {/* ── Top nav ─────────────────────────────────────────────── */}
      {/* Added p-6 for breathing room, ensured items-center for vertical alignment */}
      <header className="flex flex-col md:flex-row items-center justify-between bg-vtt-iron-800 border border-vtt-iron-700 p-6 rounded-md shadow-xl mb-6 gap-6">
        <div className="flex items-center gap-2">
          <Swords size={20} className="text-vtt-bronze" />
          <h1 className="font-fantasy text-3xl font-bold tracking-wide text-vtt-parchment">Welcome, {user.name || 'Traveler'}!</h1>
          {settings.enableTailwindDashboard && (
            <span className="text-[10px] bg-vtt-amber-glow text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Beta
            </span>
          )}
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
          {/* Compact HUD stats widget */}
          <div className="hidden md:flex items-center gap-4 bg-vtt-iron-900 border border-vtt-iron-700/60 px-3 py-1.5 rounded-sm text-xs text-vtt-parchment/70 mr-2">
            <div className="flex items-center gap-1.5" title="Active Campaigns">
              <BookOpen size={13} className="text-vtt-bronze" />
              <span className="font-bold text-vtt-parchment">{loading ? '…' : campaigns.length}</span>
            </div>
            <div className="h-3.5 w-px bg-vtt-iron-700" />
            <div className="flex items-center gap-1.5" title="Total Characters">
              <Shield size={13} className="text-vtt-bronze" />
              <span className="font-bold text-vtt-parchment">{loading ? '…' : characters.length}</span>
            </div>
            <div className="h-3.5 w-px bg-vtt-iron-700" />
            <div className="flex items-center gap-1.5" title="Players Online">
              <Users size={13} className="text-vtt-bronze" />
              <span className="font-bold text-vtt-parchment">–</span>
            </div>
            <div className="h-3.5 w-px bg-vtt-iron-700" />
            <div className="flex items-center gap-1.5" title="Game Sessions">
              <Sparkles size={13} className="text-vtt-bronze" />
              <span className="font-bold text-vtt-parchment">–</span>
            </div>
          </div>

          {import.meta.env.DEV && (
            <button
              onClick={handlePopulateMockData}
              disabled={populating}
              className="bg-vtt-bronze hover:bg-vtt-bronze-light disabled:opacity-50 text-vtt-parchment w-9 h-9 flex items-center justify-center rounded-sm border border-vtt-bronze-dark transition-colors duration-200 cursor-pointer flex-shrink-0"
              title="Populate Mock Campaigns & Characters"
              id="dev-populate-btn"
            >
              <Sprout size={16} className={populating ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            onClick={() => navigate('/lobby')}
            className="bg-vtt-iron-900 hover:bg-vtt-iron-700 border border-vtt-iron-700 text-vtt-parchment hover:text-vtt-amber-glow w-9 h-9 flex items-center justify-center rounded-sm cursor-pointer transition-colors duration-200 flex-shrink-0"
            title="Lobby"
            aria-label="Go to lobby"
          >
            <Home size={16} />
          </button>

          <button
            onClick={() => navigate('/lobby')}
            className="bg-vtt-iron-900 hover:bg-vtt-iron-700 border border-vtt-iron-700 text-vtt-parchment hover:text-vtt-amber-glow w-9 h-9 flex items-center justify-center rounded-sm cursor-pointer transition-colors duration-200 flex-shrink-0"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings2 size={16} />
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1 bg-vtt-iron-900 border border-vtt-iron-700 rounded-sm">
            <div className="w-6 h-6 rounded-full bg-vtt-bronze text-vtt-parchment flex items-center justify-center text-[11px] font-bold border border-vtt-parchment-text/10">
              {user.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <span className="text-xs text-vtt-parchment font-semibold hidden sm:block">{user.name}</span>
          </div>
        </div>
      </header>

      {/* ── Action toolbar — single engraved bronze strip ─────────────── */}
      <section className="flex flex-wrap items-center justify-between gap-y-2 mb-6 px-2 py-1.5 rounded-md border border-vtt-bronze-dark bg-gradient-to-b from-vtt-bronze/40 via-vtt-bronze/25 to-vtt-bronze/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-2px_5px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.25)]">
        <div className="flex items-center">
          <button
            onClick={handleCreateCharacter}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold text-vtt-parchment hover:text-vtt-amber-glow hover:bg-vtt-bronze/30 transition-colors cursor-pointer focus-visible:outline-none whitespace-nowrap"
          >
            <Sword className="w-4 h-4 flex-shrink-0" /> Create Character
          </button>
          <div className="h-6 w-px bg-vtt-bronze-dark/60 mx-1.5" aria-hidden="true" />
          <button
            onClick={() => setSessionModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold text-vtt-parchment hover:text-vtt-amber-glow hover:bg-vtt-bronze/30 transition-colors cursor-pointer focus-visible:outline-none whitespace-nowrap"
          >
            <Map className="w-4 h-4 flex-shrink-0" /> Join Game
          </button>
        </div>

        <div className="flex items-center">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold text-vtt-parchment hover:text-vtt-amber-glow hover:bg-vtt-bronze/30 transition-colors cursor-pointer focus-visible:outline-none whitespace-nowrap">
            <Download className="w-4 h-4 flex-shrink-0" /> Import
          </button>
          <div className="h-6 w-px bg-vtt-bronze-dark/60 mx-1.5" aria-hidden="true" />
          <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold text-vtt-parchment hover:text-vtt-amber-glow hover:bg-vtt-bronze/30 transition-colors cursor-pointer focus-visible:outline-none whitespace-nowrap">
            <Upload className="w-4 h-4 flex-shrink-0" /> Export
          </button>
          <div className="h-6 w-px bg-vtt-bronze-dark/60 mx-1.5" aria-hidden="true" />
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-vtt-parchment hover:text-red-300 hover:bg-vtt-bronze/30 transition-colors cursor-pointer focus-visible:outline-none whitespace-nowrap">
            <Trash2 className="w-4 h-4 flex-shrink-0" /> Clear All
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
          </button>
        </div>
      </section>

      {/* ── Main grid layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left column (3/4) — min-w-0 stops the cards from forcing the
            track wider than 3/4 and overlapping the sidebar */}
        <div className="lg:col-span-3 min-w-0 flex flex-col gap-6">



          {/* Recent campaigns */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-vtt-iron-700 pb-3">
              <h2 className="font-fantasy text-xl font-bold italic tracking-wide text-vtt-bronze flex items-center gap-2">
                <BookOpen size={14} /> Recent Campaigns
              </h2>
              <button
                onClick={() => navigate('/lobby')}
                className="text-xs text-vtt-bronze hover:text-vtt-amber-glow font-bold transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap"
              >
                + New Campaign
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="bg-vtt-iron-800 border border-vtt-iron-700/50 p-4 animate-pulse h-28 rounded-sm" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="bg-vtt-iron-800 border border-vtt-iron-700 rounded-sm p-8 text-center text-vtt-parchment/60">
                <BookOpen size={28} className="mx-auto mb-2 text-vtt-bronze opacity-60" />
                <p className="text-sm">No campaigns yet — create one from the lobby!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {recent.map((c) => (
                  <CampaignCard key={c.id} campaign={c} onPlay={handleContinueCampaign} />
                ))}
              </div>
            )}
          </section>

          {/* Recent characters */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-vtt-iron-700 pb-3">
              <h2 className="font-fantasy text-xl font-bold italic tracking-wide text-vtt-bronze flex items-center gap-2">
                <Shield size={14} /> Recent Characters
              </h2>
              <button
                onClick={handleCreateCharacter}
                className="bg-vtt-bronze hover:bg-vtt-bronze-light text-vtt-parchment font-bold text-sm px-4 py-2 rounded-sm border border-vtt-bronze-dark transition-colors duration-200 cursor-pointer flex items-center gap-2 flex-shrink-0 whitespace-nowrap"
                id="tw-new-character-btn"
              >
                <PlusCircle size={10} />
                <span>New</span>
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="bg-vtt-iron-800 border border-vtt-iron-700/50 p-4 animate-pulse h-20 rounded-sm" />
                ))}
              </div>
            ) : recentChars.length === 0 ? (
              <div className="bg-vtt-iron-800 border border-vtt-iron-700 rounded-sm p-8 text-center text-vtt-parchment/60">
                <Shield size={28} className="mx-auto mb-2 text-vtt-bronze opacity-60" />
                <p className="text-sm">No characters yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Row 1 — simple character cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {simpleChars.map((c) => (
                    <CharacterBadge
                      key={c.id}
                      character={c}
                      onStartSession={handleStartSession}
                      onEdit={handleEditCharacter}
                      onDelete={handleDeleteCharacter}
                    />
                  ))}
                </div>

                {/* Row 2+ — dual-stacked XP-progress cards */}
                {stackedPairs.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {stackedPairs.map(([primary, secondary]) => (
                      <CharacterStackCard
                        key={primary.id}
                        primary={primary}
                        secondary={secondary}
                        onStartSession={handleStartSession}
                        onEdit={handleEditCharacter}
                        onDelete={handleDeleteCharacter}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right column (1/4) - Document Library Sidebar */}
        <div className="lg:col-span-1 min-w-0 flex flex-col gap-6">
          <section className="bg-vtt-iron-800 border border-vtt-iron-700 rounded-sm p-4 shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between mb-6 border-b border-vtt-iron-700 pb-4">
              <h2 className="font-fantasy text-xl font-bold italic tracking-wide text-vtt-bronze flex items-center gap-2">
                <BookOpen size={14} /> Document Library
              </h2>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-2.5 text-vtt-parchment/40" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-sm text-vtt-parchment placeholder:text-vtt-parchment/40 bg-vtt-iron-900 border border-vtt-iron-700 outline-none focus:border-vtt-amber-glow transition-all duration-200 text-xs"
                />
              </div>
              <button
                className="bg-vtt-iron-900 hover:bg-vtt-iron-700 border border-vtt-iron-700 text-vtt-parchment hover:text-vtt-amber-glow p-1.5 rounded-sm transition-colors duration-200 cursor-pointer"
                title="Filters"
              >
                <Filter size={13} />
              </button>
            </div>

            {/* Offline warning banner */}
            <div className="bg-vtt-amber-glow/10 border border-vtt-amber-glow/30 text-vtt-amber-glow p-3 rounded-sm text-xs flex items-start gap-2 shadow-inner">
              <span className="text-sm select-none leading-none">⚠️</span>
              <div>
                <p className="font-bold text-xs mb-0.5">Offline Mode Active</p>
                <p className="text-[10px] opacity-85 leading-normal">
                  Cloud documents are currently unavailable. Reconnect to sync changes.
                </p>
              </div>
            </div>

            {/* Grayed-out documents list */}
            <div className="flex flex-col gap-2 opacity-40 select-none">
              {[
                { name: 'Core Rules Reference.pdf', size: '12.4 MB' },
                { name: 'Campaign Settings Map.png', size: '4.8 MB' },
                { name: 'NPC Ledger - Act I.json', size: '142 KB' },
                { name: 'Spell Compendium.pdf', size: '8.1 MB' },
              ].map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-vtt-iron-900 border border-vtt-iron-700/50 rounded-sm text-[11px] text-vtt-parchment/60"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <BookOpen size={13} className="text-vtt-parchment/40 flex-shrink-0" />
                    <span className="truncate max-w-[140px]" title={doc.name}>
                      {doc.name}
                    </span>
                  </div>
                  <span className="text-[9px] text-vtt-parchment/40 flex-shrink-0">{doc.size}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Character creation launcher (portal-rendered by the hook) */}
      {LauncherComponent}

      {/* Start Session / Join Game Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-vtt-iron-800 border border-vtt-iron-700 rounded-sm p-6 w-full max-w-sm shadow-xl font-interface">
            <h3 className="font-fantasy text-xl font-bold text-vtt-parchment mb-4 border-b border-vtt-iron-700 pb-2">
              {sessionCharacter ? `Start Session: ${sessionCharacter.name}` : 'Join Game'}
            </h3>

            <p className="text-sm text-vtt-parchment/80 mb-4">
              {sessionCharacter
                ? 'Enter a room code to join a game with this character.'
                : 'Enter a room code to join a game.'}
            </p>

            <input
              type="text"
              placeholder="Enter room code…"
              value={sessionRoomCode}
              maxLength={6}
              onChange={(e) => setSessionRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleModalJoin()}
              className="w-full px-3 py-2 rounded-sm text-vtt-parchment placeholder:text-vtt-parchment/40 bg-vtt-iron-900 border border-vtt-iron-700 outline-none focus:border-vtt-amber-glow focus:shadow-vtt-amber-glow transition-all duration-200 text-sm font-mono uppercase tracking-widest mb-4"
              autoFocus
            />

            {sessionError && <p className="text-color-error text-xs mb-4 font-medium">{sessionError}</p>}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setSessionModalOpen(false);
                  setSessionError(null);
                  setSessionRoomCode('');
                  setSessionCharacter(null);
                }}
                className="px-4 py-2 text-sm text-vtt-parchment/60 hover:text-vtt-parchment font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleModalJoin}
                disabled={sessionJoining || !sessionRoomCode.trim()}
                className="bg-vtt-bronze hover:bg-vtt-bronze-light disabled:opacity-50 disabled:cursor-not-allowed text-vtt-parchment font-bold text-sm px-4 py-2 rounded-sm border border-vtt-bronze-dark transition-colors duration-200 cursor-pointer flex items-center gap-2"
              >
                {sessionJoining ? 'Joining…' : 'Join Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

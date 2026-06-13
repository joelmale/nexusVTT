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

// Direct Lucide path imports (per AGENTS.md guidance)
import Shield from 'lucide-react/dist/esm/icons/shield';
import Play from 'lucide-react/dist/esm/icons/play';
import PlusCircle from 'lucide-react/dist/esm/icons/plus-circle';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2';
import Home from 'lucide-react/dist/esm/icons/home';
import Swords from 'lucide-react/dist/esm/icons/swords';
import Users from 'lucide-react/dist/esm/icons/users';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Layout from 'lucide-react/dist/esm/icons/layout';

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
  data: { race?: string; class?: string; level?: number; [key: string]: unknown };
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, accent }) => (
  <div
    className="tw-glass flex items-center gap-md p-md"
    style={{ borderLeft: accent ? `3px solid ${accent}` : undefined }}
  >
    <div className="text-color-primary opacity-80 flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-text-muted font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-text-primary">{value}</p>
    </div>
  </div>
);

interface CampaignCardProps {
  campaign: Campaign;
  onPlay: (campaign: Campaign) => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onPlay }) => (
  <div className="tw-glass group relative flex flex-col gap-sm p-md hover:scale-[1.02] transition-transform duration-base">
    <div className="flex items-start justify-between">
      <h3 className="font-semibold text-text-primary truncate max-w-[70%]">{campaign.name}</h3>
      <span className="text-xs text-text-muted">{timeAgo(campaign.updatedAt)}</span>
    </div>
    {campaign.description && (
      <p className="text-sm text-text-secondary line-clamp-2">{campaign.description}</p>
    )}
    <div className="flex items-center justify-between mt-auto pt-sm">
      <span className="text-xs text-text-muted">Last played {timeAgo(campaign.updatedAt)}</span>
      <button
        onClick={() => onPlay(campaign)}
        className="tw-btn-primary text-xs py-1 px-3"
        aria-label={`Continue campaign ${campaign.name}`}
      >
        <Play size={12} />
        <span>Continue</span>
      </button>
    </div>
  </div>
);

interface CharacterBadgeProps {
  character: CharacterRecord;
}

const CharacterBadge: React.FC<CharacterBadgeProps> = ({ character }) => (
  <div className="tw-glass flex items-center gap-sm p-sm cursor-pointer hover:bg-surface-hover transition-colors duration-fast group">
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
      style={{ background: 'var(--gradient-primary)' }}
    >
      {character.name.charAt(0).toUpperCase()}
    </div>
    <div className="overflow-hidden">
      <p className="font-semibold text-text-primary text-sm truncate">{character.name}</p>
      <p className="text-xs text-text-muted truncate">
        {character.data.race} {character.data.class} · Lv {character.data.level ?? 1}
      </p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const DashboardTailwind: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, joinRoomWithCode, setEnableTailwindDashboard } = useGameStore();
  const settings = useSettings();
  const { startCharacterCreation, LauncherComponent } = useCharacterCreationLauncher();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    const t = setTimeout(() => {
      setAuthChecking(false);
      if (!isAuthenticated) navigate('/lobby');
    }, 1000);
    return () => clearTimeout(t);
  }, [isAuthenticated, navigate]);

  // Fetch data
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
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
    })();
  }, [isAuthenticated]);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinRoomWithCode(joinCode.trim().toUpperCase());
      navigate(`/lobby/game/${joinCode.trim().toUpperCase()}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setJoining(false);
    }
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
    .slice(0, 6);

  if (authChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="tw-glass p-xl text-text-secondary animate-pulse">Checking authentication…</div>
      </div>
    );
  }

  return (
    // data-reduced-motion attr lets @layer rules disable transitions for accessibility
    <div
      className="min-h-screen p-md md:p-lg font-sans"
      style={{ background: 'var(--bg-primary)' }}
      data-reduced-motion={settings.reducedMotion ? 'true' : 'false'}
    >
      {/* ── Top nav ─────────────────────────────────────────────── */}
      <header className="tw-glass flex items-center justify-between px-md py-sm mb-lg">
        <div className="flex items-center gap-sm">
          <Swords size={22} className="text-color-primary" />
          <span className="font-bold text-text-primary text-lg tracking-tight">NexusVTT</span>
          {settings.enableTailwindDashboard && (
            <span className="text-xs bg-color-primary text-white px-2 py-0.5 rounded-full font-medium">
              Tailwind Beta
            </span>
          )}
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => navigate('/lobby')}
            className="tw-glass p-2 rounded-token cursor-pointer hover:bg-surface-hover transition-colors duration-fast"
            title="Lobby"
            aria-label="Go to lobby"
          >
            <Home size={18} className="text-text-secondary" />
          </button>
          <button
            onClick={() => setEnableTailwindDashboard(false)}
            className="tw-glass p-2 rounded-token cursor-pointer hover:bg-surface-hover transition-colors duration-fast"
            title="Switch to Legacy Dashboard"
            aria-label="Switch to Legacy Dashboard"
          >
            <Layout size={18} className="text-text-secondary" />
          </button>
          <button
            onClick={() => navigate('/lobby')}
            className="tw-glass p-2 rounded-token cursor-pointer hover:bg-surface-hover transition-colors duration-fast"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings2 size={18} className="text-text-secondary" />
          </button>
          <div className="tw-glass flex items-center gap-sm px-sm py-1 rounded-token">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {user.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <span className="text-sm text-text-primary font-medium hidden sm:block">{user.name}</span>
          </div>
        </div>
      </header>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="dashboard-tw-grid grid grid-cols-2 md:grid-cols-4 gap-md mb-lg">
        <StatCard icon={<BookOpen size={20} />} label="Campaigns" value={loading ? '…' : campaigns.length} accent="var(--color-primary)" />
        <StatCard icon={<Shield size={20} />} label="Characters" value={loading ? '…' : characters.length} accent="var(--color-secondary)" />
        <StatCard icon={<Users size={20} />} label="Online Now" value="–" accent="var(--color-success)" />
        <StatCard icon={<Sparkles size={20} />} label="Sessions" value="–" accent="var(--color-accent)" />
      </div>

      {/* ── Main grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">

        {/* Left column (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-lg">

          {/* Quick join */}
          <section className="tw-glass p-md">
            <h2 className="text-text-primary font-semibold text-base mb-md flex items-center gap-sm">
              <Play size={16} className="text-color-primary" /> Quick Join
            </h2>
            <div className="flex gap-sm">
              <input
                type="text"
                placeholder="Enter room code…"
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="flex-1 px-md py-sm rounded-token text-text-primary placeholder:text-text-muted text-sm font-mono uppercase tracking-widest border border-border-primary outline-none focus:border-color-primary transition-colors duration-fast"
                style={{ background: 'var(--surface-primary)' }}
                id="tw-join-code-input"
                aria-label="Room code"
              />
              <button
                onClick={handleJoin}
                disabled={joining || !joinCode.trim()}
                className="tw-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                id="tw-join-btn"
              >
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
            {joinError && <p className="text-color-error text-xs mt-sm">{joinError}</p>}
          </section>

          {/* Recent campaigns */}
          <section>
            <div className="flex items-center justify-between mb-md">
              <h2 className="text-text-primary font-semibold text-base flex items-center gap-sm">
                <BookOpen size={16} className="text-color-primary" /> Recent Campaigns
              </h2>
              <button
                onClick={() => navigate('/lobby')}
                className="text-xs text-color-primary hover:text-color-primary-hover transition-colors duration-fast"
              >
                + New Campaign
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="tw-glass p-md animate-pulse h-28 rounded-token" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="tw-glass p-xl text-center text-text-muted">
                <BookOpen size={32} className="mx-auto mb-sm opacity-40" />
                <p className="text-sm">No campaigns yet — create one from the lobby!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                {recent.map((c) => (
                  <CampaignCard key={c.id} campaign={c} onPlay={handleContinueCampaign} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column (1/3) */}
        <div className="flex flex-col gap-lg">
          {/* Characters */}
          <section>
            <div className="flex items-center justify-between mb-md">
              <h2 className="text-text-primary font-semibold text-base flex items-center gap-sm">
                <Shield size={16} className="text-color-secondary" /> Characters
              </h2>
              <button
                onClick={handleCreateCharacter}
                className="tw-btn-primary text-xs py-1 px-3"
                id="tw-new-character-btn"
              >
                <PlusCircle size={12} /> New
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col gap-sm">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="tw-glass h-16 animate-pulse rounded-token" />
                ))}
              </div>
            ) : recentChars.length === 0 ? (
              <div className="tw-glass p-lg text-center text-text-muted">
                <Shield size={28} className="mx-auto mb-sm opacity-40" />
                <p className="text-sm">No characters yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {recentChars.map((c) => (
                  <CharacterBadge key={c.id} character={c} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Character creation launcher (portal-rendered by the hook) */}
      {LauncherComponent}
    </div>
  );
};

/**
 * @file Dashboard.tsx
 * @description Connected production user dashboard using the TTRPG Gothic/Fantasy Atomic Design redesign.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import { useCharacterCreationLauncher } from '@/hooks';
import { clearAll, seedData } from '@/services/devSeed';
import { useDevToolsEnabled } from '@/utils/devToolsFlag';
import {
  getCampaignStudioUrl,
  getCharacterForgeUrl,
} from '@/utils/productUrls';
import type { GameConfig, PlayerCharacter } from '@/types/game';

// Import our new Atomic components
import { DashboardLayout } from './Dashboard/templates/DashboardLayout';
import type {
  CharacterRecord as LayoutCharacter,
  CharacterStats,
  TableRecord,
} from './Dashboard/types';
import { JoinTableModal } from './Dashboard/organisms/JoinTableModal';
import { NewCampaignModal } from './Dashboard/organisms/NewCampaignModal';
import type {
  DashboardSummary,
  HeroSummary,
  TableSummary,
} from '../../shared/dashboard';

// ─── Mapping helpers ─────────────────────────────────────────────────────────

const getCharacterLabel = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string') {
      return name.trim() || undefined;
    }
  }

  return undefined;
};

type HeroData = Record<string, unknown>;

const asRecord = (value: unknown): HeroData =>
  value && typeof value === 'object' ? (value as HeroData) : {};

/** A finite number, or the numeric `value`/`total` of an object, else undefined. */
const readNumber = (...candidates: unknown[]): number | undefined => {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (c && typeof c === 'object') {
      const inner = (c as { value?: unknown; total?: unknown });
      const n = inner.value ?? inner.total;
      if (typeof n === 'number' && Number.isFinite(n)) return n;
    }
  }
  return undefined;
};

// Characters arrive in several historical shapes: wizard-created and
// dashboard-facing records use lowercase `stats` + `hp`, while
// test-generated / sheet-style records use `abilities` (STR/DEX…) + `hitPoints`.
// Normalize defensively so every record renders regardless of origin. Fields
// the record does not carry stay undefined; nothing is invented.
const ABILITY_TO_STAT: Record<string, keyof CharacterStats> = {
  STR: 'strength',
  DEX: 'dexterity',
  CON: 'constitution',
  INT: 'intelligence',
  WIS: 'wisdom',
  CHA: 'charisma',
};

const deriveStats = (data: HeroData): CharacterStats | undefined => {
  if (data.stats && typeof data.stats === 'object') {
    return data.stats as CharacterStats;
  }
  const abilities = data.abilities as
    | Record<string, { score?: number }>
    | undefined;
  if (!abilities) return undefined;
  const out: Partial<CharacterStats> = {};
  for (const [abbr, statKey] of Object.entries(ABILITY_TO_STAT)) {
    const score = abilities[abbr]?.score;
    if (typeof score === 'number') out[statKey] = score;
  }
  // A partial block of scores would mislead, so require all six.
  return Object.keys(out).length === 6 ? (out as CharacterStats) : undefined;
};

const deriveHp = (data: HeroData) => {
  const hp = data.hp as { current: number; max: number } | undefined;
  if (hp && typeof hp === 'object') return hp;
  const max = data.maxHitPoints as number | undefined;
  const current = data.hitPoints as number | undefined;
  if (typeof max === 'number') {
    return { current: typeof current === 'number' ? current : max, max };
  }
  return undefined;
};

const toLayoutHero = (hero: HeroSummary): LayoutCharacter => {
  const data = asRecord(hero.data);
  const passive = asRecord(data.passive);
  return {
    id: hero.id,
    name: hero.name,
    level: readNumber(data.level) ?? 1,
    klass: getCharacterLabel(data.class ?? data.characterClass),
    race: getCharacterLabel(data.race ?? data.species),
    hp: deriveHp(data),
    stats: deriveStats(data),
    ac: readNumber(data.armorClass, data.ac),
    passivePerception: readNumber(
      data.passivePerception,
      data.passive_perception,
      passive.perception,
    ),
    boundCampaignId: hero.boundCampaignId,
    updatedAt: hero.updatedAt ?? '',
  };
};

const toLayoutTable = (table: TableSummary): TableRecord => ({
  id: table.id,
  name: table.name,
  subtitle: table.description ?? '',
  role: table.role,
  dmName: table.dmName,
  roomCode: table.roomCode,
  status: table.status,
  lastPlayedAt: table.lastPlayedAt,
  roster: table.roster,
  myCharacterId: table.myCharacterId,
  prep: table.prep,
});

interface JoinModalState {
  /** Hero chosen via "Play as {name}", which skips the hero-picking step. */
  characterId?: string;
  /** Room code to prefill. */
  roomCode?: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  // Narrow selectors: the old `useGameStore()` (no selector) subscribed to the
  // whole store.
  const user = useGameStore((state) => state.user);
  const isAuthenticated = useGameStore((state) => state.isAuthenticated);
  const authChecked = useGameStore((state) => state.authChecked);
  const joinRoomWithCode = useGameStore((state) => state.joinRoomWithCode);
  const createGameRoom = useGameStore((state) => state.createGameRoom);
  const { startCharacterCreation, LauncherComponent } =
    useCharacterCreationLauncher();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  // Both seeding and clear-all call /api/dev/*, so they are hidden unless the
  // backend reports those routes registered.
  const devToolsEnabled = useDevToolsEnabled();

  const [joinModal, setJoinModal] = useState<JoinModalState | null>(null);

  // Create Campaign Modal State
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Auth guard — wait for the initial /auth/me probe to resolve before deciding.
  // Redirect only when auth is confirmed resolved AND the user is not signed in,
  // so a slow auth check can never bounce an authenticated user to the lobby.
  useEffect(() => {
    if (authChecked && !isAuthenticated) navigate('/lobby');
  }, [authChecked, isAuthenticated, navigate]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard', { credentials: 'include' });
      if (res.ok) setSummary((await res.json()) as DashboardSummary);
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

  // Join a room, optionally with a hero. Rejections surface in the modal.
  const handleModalJoin = async (
    roomCode: string,
    layoutChar: LayoutCharacter | null,
  ) => {
    const code = roomCode.trim().toUpperCase();
    const hero = layoutChar
      ? (summary?.heroes.find((h) => h.id === layoutChar.id) ?? null)
      : null;
    await joinRoomWithCode(code, hero as unknown as PlayerCharacter);
    navigate(`/lobby/game/${code}`);
  };

  // "Play as {name}": open the join flow with this hero preselected.
  const handlePlayAs = (layoutChar: LayoutCharacter) => {
    setJoinModal({ characterId: layoutChar.id });
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

  // DM: open (or reopen) the table under its remembered room code.
  const handlePlayCampaign = async (table: TableRecord) => {
    const gameConfig: GameConfig = {
      name: table.name,
      description: table.subtitle,
      estimatedTime: '',
      campaignType: 'campaign',
      maxPlayers: 6,
      campaignId: table.id,
      preferredRoomCode: table.roomCode?.toUpperCase(),
    };

    try {
      const roomCode = await createGameRoom(gameConfig, false);
      navigate(`/lobby/game/${roomCode}`);
    } catch (error) {
      console.error('Failed to play campaign:', error);
      alert('Failed to open campaign. Please try again.');
    }
  };

  // Player: rejoin with the hero bound to this table. With no known hero, fall
  // back to the join modal at the hero step.
  const handleRejoinTable = async (table: TableRecord) => {
    const code = table.roomCode?.toUpperCase();
    if (!code) return;
    const hero = table.myCharacterId
      ? summary?.heroes.find((h) => h.id === table.myCharacterId)
      : undefined;
    if (!hero) {
      setJoinModal({ roomCode: code });
      return;
    }
    try {
      await joinRoomWithCode(code, hero as unknown as PlayerCharacter);
      navigate(`/lobby/game/${code}`);
    } catch (error) {
      console.error('Failed to rejoin table:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to rejoin the table. Please try again.',
      );
    }
  };

  const handleOpenTable = (table: TableRecord) =>
    table.role === 'dm' ? handlePlayCampaign(table) : handleRejoinTable(table);

  const handleDeleteCampaign = async (table: TableRecord) => {
    if (
      confirm(`Are you sure you want to delete the campaign: ${table.name}?`)
    ) {
      try {
        const res = await fetch(`/api/campaigns/${table.id}`, {
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
    setCampaignModalOpen(true);
  };

  const handleCampaignSubmit = async (name: string, description: string) => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body.error || `Failed to create campaign (HTTP ${res.status})`,
      );
    }
    setCampaignModalOpen(false);
    await fetchDashboardData();
  };

  const handleCreateCharacter = () => {
    startCharacterCreation(user.id, 'modal', () => {
      // Refresh the summary after wizard completion
      void fetchDashboardData();
    });
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        'Permanently delete ALL campaigns and characters on this account? This cannot be undone.',
      )
    ) {
      return;
    }
    try {
      const result = await clearAll();
      if (!result.success && result.errors.length) {
        console.error('Clear all reported errors:', result.errors);
        alert(`Cleared with errors: ${result.errors.join('; ')}`);
      }
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to clear data:', err);
      alert(err instanceof Error ? err.message : 'Failed to clear data');
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedData({ campaigns: 3, characters: 4 });
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to seed test data:', err);
      alert(err instanceof Error ? err.message : 'Failed to seed test data');
    } finally {
      setSeeding(false);
    }
  };

  // MAPPERS: API payload to layout structures. The server already orders
  // tables by most recent activity.
  const runs = (summary?.runs ?? []).map(toLayoutTable);
  const joined = (summary?.joined ?? []).map(toLayoutTable);
  const heroes = (summary?.heroes ?? []).map(toLayoutHero);

  const joinCharacter = joinModal?.characterId
    ? (heroes.find((c) => c.id === joinModal.characterId) ?? null)
    : null;

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121417] text-[#f1e6d3]">
        <div className="bg-[#252a31] border border-[#8c6b4a]/30 p-8 text-[#cbd5e1]/80 motion-safe:animate-pulse font-serif rounded-sm shadow-md">
          Checking authentication…
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardLayout
        userName={user.name || 'Traveler'}
        runs={runs}
        joined={joined}
        heroes={heroes}
        lastTable={summary?.lastTable}
        loading={loading}
        onBack={() => navigate('/lobby')}
        onCreateCharacter={handleCreateCharacter}
        onJoinGame={() => setJoinModal({})}
        onJoinWithCode={(code) => setJoinModal({ roomCode: code })}
        onClearAll={devToolsEnabled ? handleClearAll : undefined}
        onSeedData={devToolsEnabled ? handleSeedData : undefined}
        seeding={seeding}
        onOpenTable={handleOpenTable}
        onDeleteTable={handleDeleteCampaign}
        onOpenCampaignStudio={() =>
          window.location.assign(getCampaignStudioUrl())
        }
        onCreateCampaign={handleCreateCampaign}
        onPlayAs={handlePlayAs}
        onOpenCharacterForge={() =>
          window.location.assign(getCharacterForgeUrl())
        }
        onDeleteHero={handleDeleteCharacter}
      />

      {/* Character creation wizard portal hook output */}
      {LauncherComponent}

      {/* Join a table / Play as {name} / Rejoin without a known hero */}
      {joinModal && (
        <JoinTableModal
          characters={heroes}
          preselectedCharacter={joinCharacter}
          initialRoomCode={joinModal.roomCode}
          onJoin={handleModalJoin}
          onClose={() => setJoinModal(null)}
        />
      )}

      {/* Create Campaign */}
      {campaignModalOpen && (
        <NewCampaignModal
          onCreate={handleCampaignSubmit}
          onClose={() => setCampaignModalOpen(false)}
        />
      )}
    </>
  );
};

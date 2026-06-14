/**
 * @file DashboardNew.tsx
 * @description Immersive, high-density Virtual Tabletop dashboard for D&D
 * players. Built from scratch on the NexusVTT Tailwind v4 design tokens
 * (iron / brushed bronze / parchment).
 *
 * Self-contained: ships with strictly-typed mock data so it renders in
 * isolation. Swap `MOCK_CAMPAIGNS` / `MOCK_CHARACTERS` for live data when
 * wiring it to the store.
 */

import React, { useMemo, useState } from 'react';

// ── Icons (direct path imports for tree-shaking) ─────────────────────────────
import Shield from 'lucide-react/dist/esm/icons/shield';
import Sword from 'lucide-react/dist/esm/icons/sword';
import Map from 'lucide-react/dist/esm/icons/map';
import Download from 'lucide-react/dist/esm/icons/download';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import PlayCircle from 'lucide-react/dist/esm/icons/play-circle';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Search from 'lucide-react/dist/esm/icons/search';
import Filter from 'lucide-react/dist/esm/icons/filter';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  subtitle: string;
  updatedAt: string; // ISO date
}

interface CharacterRecord {
  id: string;
  name: string;
  level: number;
  klass: string;
  race: string;
  updatedAt: string; // ISO date
  /** Optional current XP — drives the progress bar when present. */
  xp?: number;
}

interface LibraryDocument {
  id: string;
  name: string;
  size: string;
}

interface ToolbarButton {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
  onClick?: () => void;
  /** Optional trailing affordance (e.g. a dropdown caret). */
  trailing?: React.ReactNode;
  /** Tailwind text colour applied on hover. */
  hoverText?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CAMPAIGNS: readonly Campaign[] = [
  { id: 'c1', name: 'Tomb of Horrors', subtitle: 'A race against time to stop a death curse.', updatedAt: '2026-06-13T09:00:00Z' },
  { id: 'c2', name: 'Waterdeep Heist', subtitle: 'An urban treasure hunt in the crown jewel of the Sword Coast.', updatedAt: '2026-06-13T08:15:00Z' },
  { id: 'c3', name: 'Curse of Strahd', subtitle: 'A dark fantasy adventure set in the mist-shrouded valley.', updatedAt: '2026-06-12T22:40:00Z' },
  { id: 'c4', name: 'Storm King’s Thunder', subtitle: 'Giants rampage across the North — restore the ordning.', updatedAt: '2026-06-11T19:05:00Z' },
];

const MOCK_CHARACTERS: readonly CharacterRecord[] = [
  { id: 'h1', name: 'Silal', level: 14, klass: 'Sorcerer', race: 'Aasimar', updatedAt: '2026-06-13T09:30:00Z', xp: 152000 },
  { id: 'h2', name: 'Pyreon', level: 3, klass: 'Wizard', race: 'Human', updatedAt: '2026-06-12T17:00:00Z', xp: 1400 },
  { id: 'h3', name: 'Zela', level: 7, klass: 'Rogue', race: 'Halfling', updatedAt: '2026-06-11T12:00:00Z', xp: 27500 },
  { id: 'h4', name: 'Valya', level: 5, klass: 'Cleric', race: 'Half-Elf', updatedAt: '2026-06-10T20:20:00Z', xp: 9000 },
  { id: 'h5', name: 'Brakka', level: 11, klass: 'Barbarian', race: 'Goliath', updatedAt: '2026-06-09T15:45:00Z', xp: 92000 },
  { id: 'h6', name: 'Eldrin', level: 9, klass: 'Druid', race: 'Wood Elf', updatedAt: '2026-06-08T11:10:00Z', xp: 52000 },
  { id: 'h7', name: 'Mira', level: 2, klass: 'Bard', race: 'Tiefling', updatedAt: '2026-06-07T09:00:00Z' },
  { id: 'h8', name: 'Tordek', level: 18, klass: 'Fighter', race: 'Dwarf', updatedAt: '2026-06-06T08:00:00Z', xp: 280000 },
];

const MOCK_DOCUMENTS: readonly LibraryDocument[] = [
  { id: 'd1', name: 'Core Rules Reference.pdf', size: '12.4 MB' },
  { id: 'd2', name: 'Campaign Settings Map.png', size: '4.8 MB' },
  { id: 'd3', name: 'NPC Ledger — Act I.json', size: '142 KB' },
  { id: 'd4', name: 'Spell Compendium.pdf', size: '8.1 MB' },
  { id: 'd5', name: 'Faction Dossiers.pdf', size: '3.3 MB' },
  { id: 'd6', name: 'Encounter Tables.csv', size: '88 KB' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cumulative D&D 5e XP required to reach each level (index 0 = level 1). */
const DND5E_XP_THRESHOLDS: readonly number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Progress toward the next level. Uses real XP when available, otherwise the
 * character's position along the 1→20 journey so the bar is always meaningful.
 */
function levelProgress(char: CharacterRecord): { pct: number; label: string } {
  const level = Math.min(Math.max(char.level, 1), 20);

  if (char.xp !== undefined && level < 20) {
    const cur = DND5E_XP_THRESHOLDS[level - 1];
    const next = DND5E_XP_THRESHOLDS[level];
    const pct = Math.min(100, Math.max(0, ((char.xp - cur) / (next - cur)) * 100));
    return { pct, label: `${char.xp.toLocaleString()} XP` };
  }

  return { pct: (level / 20) * 100, label: `Lvl ${level} / 20` };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface WelcomeHeaderProps {
  userName: string;
  campaignCount: number;
  characterCount: number;
}

const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ userName, campaignCount, characterCount }) => (
  <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-vtt-iron-800 border border-vtt-iron-700 rounded-md p-5 shadow-xl">
    <h1 className="font-fantasy text-3xl font-bold tracking-wide text-slate-200">
      Welcome, {userName}!
    </h1>

    {/* Stacked stat box */}
    <div className="flex flex-col gap-1.5 bg-vtt-iron-900 border border-vtt-iron-700 rounded-sm px-4 py-2.5 font-interface">
      <div className="flex items-center justify-between gap-6 text-xs text-vtt-parchment/70">
        <span className="flex items-center gap-2">
          <Shield size={13} className="text-vtt-bronze min-w-[13px]" />
          Campaigns
        </span>
        <span className="font-bold text-vtt-parchment tabular-nums">{campaignCount}</span>
      </div>
      <div className="h-px bg-vtt-iron-700" />
      <div className="flex items-center justify-between gap-6 text-xs text-vtt-parchment/70">
        <span className="flex items-center gap-2">
          <Sword size={13} className="text-vtt-bronze min-w-[13px]" />
          Characters
        </span>
        <span className="font-bold text-vtt-parchment tabular-nums">{characterCount}</span>
      </div>
    </div>
  </header>
);

interface ActionBarProps {
  left: readonly ToolbarButton[];
  right: readonly ToolbarButton[];
}

const ActionBar: React.FC<ActionBarProps> = ({ left, right }) => {
  const renderButton = (btn: ToolbarButton): React.ReactNode => (
    <button
      key={btn.id}
      type="button"
      onClick={btn.onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-semibold font-interface text-vtt-parchment ${btn.hoverText ?? 'hover:text-vtt-amber-glow'} hover:bg-vtt-bronze/20 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-vtt-amber-glow`}
    >
      <btn.Icon size={16} className="min-w-[16px]" />
      <span>{btn.label}</span>
      {btn.trailing}
    </button>
  );

  return (
    <section className="flex flex-wrap items-center justify-between gap-y-2 bg-vtt-bronze/20 border border-vtt-bronze/40 rounded-md px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-1">{left.map(renderButton)}</div>
      <div className="flex items-center gap-1">{right.map(renderButton)}</div>
    </section>
  );
};

interface SectionHeadingProps {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, title, action }) => (
  <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-vtt-iron-700">
    <h2 className="font-fantasy text-2xl italic tracking-wide text-slate-300 flex items-center gap-2">
      {icon}
      {title}
    </h2>
    {action}
  </div>
);

/** Shared footer strip used by both campaign and character cards. */
interface ActionStripProps {
  onEdit: () => void;
  onDelete: () => void;
  onPlay: () => void;
  playLabel: string;
}

const ActionStrip: React.FC<ActionStripProps> = ({ onEdit, onDelete, onPlay, playLabel }) => (
  <div className="bg-vtt-bronze/10 px-3 py-2 flex justify-between items-center border-t border-vtt-bronze/30 mt-auto gap-2">
    <div className="flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-vtt-amber-glow transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 focus-visible:outline-none"
      >
        <Pencil size={12} className="min-w-[12px]" />
        <span>Edit</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text/80 hover:text-red-700 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 focus-visible:outline-none"
      >
        <Trash2 size={12} className="min-w-[12px]" />
        <span>Delete</span>
      </button>
    </div>
    <button
      type="button"
      onClick={onPlay}
      className="flex items-center gap-1 text-xs font-bold text-vtt-parchment-text hover:text-vtt-amber-glow transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 focus-visible:outline-none"
    >
      <PlayCircle size={12} className="min-w-[12px]" />
      <span>{playLabel}</span>
    </button>
  </div>
);

interface CampaignCardProps {
  campaign: Campaign;
  onPlay: (c: Campaign) => void;
  onEdit: (c: Campaign) => void;
  onDelete: (c: Campaign) => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onPlay, onEdit, onDelete }) => (
  <article className="bg-vtt-parchment text-vtt-parchment-text rounded-sm p-0 overflow-hidden min-w-0 flex flex-col border border-vtt-bronze/30 shadow-md hover:border-vtt-amber-glow hover:shadow-vtt-amber-glow transition-all duration-300 font-interface">
    <div className="p-3 flex flex-col gap-1">
      <h3 className="font-fantasy text-lg font-bold leading-tight truncate" title={campaign.name}>
        {campaign.name}
      </h3>
      <p className="text-xs text-vtt-parchment-text/80 line-clamp-2">{campaign.subtitle}</p>
      <p className="text-[10px] text-vtt-parchment-text/60 font-medium text-right mt-1">
        {formatDate(campaign.updatedAt)}
      </p>
    </div>
    <ActionStrip
      onEdit={() => onEdit(campaign)}
      onDelete={() => onDelete(campaign)}
      onPlay={() => onPlay(campaign)}
      playLabel="Play"
    />
  </article>
);

interface CharacterCardProps {
  character: CharacterRecord;
  onStartSession: (c: CharacterRecord) => void;
  onEdit: (c: CharacterRecord) => void;
  onDelete: (c: CharacterRecord) => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, onStartSession, onEdit, onDelete }) => {
  const { pct, label } = levelProgress(character);
  return (
    <article className="bg-vtt-parchment text-vtt-parchment-text rounded-sm p-0 overflow-hidden min-w-0 flex flex-col border border-vtt-bronze/30 shadow-md hover:border-vtt-amber-glow hover:shadow-vtt-amber-glow transition-all duration-300 font-interface">
      <div className="p-3 flex flex-col gap-1">
        <h3 className="font-fantasy text-lg font-bold leading-tight truncate" title={character.name}>
          {character.name}
        </h3>
        <p className="text-xs text-vtt-parchment-text/80 truncate">
          lvl {character.level} {character.klass}, {character.race}
        </p>
        <p className="text-[10px] text-vtt-parchment-text/60 font-medium mt-0.5">
          {formatDate(character.updatedAt)}
        </p>
      </div>

      {/* Slim XP progress bar sitting just above the action strip */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="relative h-1.5 flex-1 min-w-0 rounded-full bg-vtt-bronze/15 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-vtt-bronze to-vtt-amber-glow"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9px] font-semibold text-vtt-parchment-text/55 whitespace-nowrap flex-shrink-0 tabular-nums">
          {label}
        </span>
      </div>

      <ActionStrip
        onEdit={() => onEdit(character)}
        onDelete={() => onDelete(character)}
        onPlay={() => onStartSession(character)}
        playLabel="Start Session"
      />
    </article>
  );
};

/** Faint glowing arcane circle rendered behind the disabled document list. */
const ArcaneCircle: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
    <div className="absolute h-56 w-56 rounded-full bg-vtt-amber-glow/10 blur-2xl" />
    <svg viewBox="0 0 200 200" className="h-56 w-56 text-vtt-amber-glow/15">
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 5" />
      <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeWidth="1" />
      <path
        d="M100 8 L139 192 L8 76 L192 76 L61 192 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.6"
      />
    </svg>
  </div>
);

interface DocumentSidebarProps {
  documents: readonly LibraryDocument[];
  searchValue: string;
  onSearchChange: (value: string) => void;
}

const DocumentSidebar: React.FC<DocumentSidebarProps> = ({ documents, searchValue, onSearchChange }) => (
  <aside className="bg-vtt-iron-800 border border-vtt-iron-700 rounded-md p-4 shadow-md flex flex-col gap-4 h-full">
    <SectionHeading icon={<BookOpen size={18} className="text-vtt-bronze min-w-[18px]" />} title="Document Library" />

    {/* Search + filter */}
    <div className="flex gap-2">
      <div className="relative flex-1 min-w-0">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-vtt-parchment/40 min-w-[13px]" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search docs…"
          className="w-full pl-8 pr-3 py-1.5 rounded-sm text-xs font-interface text-vtt-parchment placeholder:text-vtt-parchment/40 bg-vtt-iron-900 border border-vtt-iron-700 outline-none focus:border-vtt-amber-glow transition-colors"
        />
      </div>
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1.5 rounded-sm text-xs font-interface text-vtt-parchment hover:text-vtt-amber-glow bg-vtt-iron-900 border border-vtt-iron-700 hover:border-vtt-amber-glow transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 focus-visible:outline-none"
      >
        <Filter size={13} className="min-w-[13px]" />
        <ChevronDown size={12} className="min-w-[12px] opacity-70" />
      </button>
    </div>

    {/* Service-unavailable banner */}
    <div className="flex items-start gap-2 bg-red-950/40 border border-vtt-amber-glow/40 text-vtt-amber-glow rounded-sm p-3 shadow-inner">
      <AlertTriangle size={15} className="min-w-[15px] mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-bold font-interface">Document service unavailable</p>
        <p className="text-[10px] opacity-80 leading-snug">
          Cloud documents are offline. Reconnect to browse and sync.
        </p>
      </div>
    </div>

    {/* Disabled doc list over the arcane circle */}
    <div className="relative flex-1 min-h-[14rem]">
      <ArcaneCircle />
      <ul className="relative flex flex-col gap-2 opacity-40 select-none">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-2 p-2.5 bg-vtt-iron-900/80 border border-vtt-iron-700/50 rounded-sm font-interface"
          >
            <span className="flex items-center gap-2 min-w-0">
              <FileText size={13} className="text-vtt-parchment/40 min-w-[13px]" />
              <span className="text-[11px] text-vtt-parchment/60 truncate" title={doc.name}>
                {doc.name}
              </span>
            </span>
            <span className="text-[9px] text-vtt-parchment/40 whitespace-nowrap flex-shrink-0 tabular-nums">
              {doc.size}
            </span>
          </li>
        ))}
      </ul>
    </div>
  </aside>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardNewProps {
  userName?: string;
}

export const DashboardNew: React.FC<DashboardNewProps> = ({ userName = 'Traveler' }) => {
  const [docSearch, setDocSearch] = useState('');

  const campaigns = MOCK_CAMPAIGNS;
  const characters = MOCK_CHARACTERS;

  const filteredDocs = useMemo<readonly LibraryDocument[]>(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return MOCK_DOCUMENTS;
    return MOCK_DOCUMENTS.filter((d) => d.name.toLowerCase().includes(q));
  }, [docSearch]);

  // ── Handlers (mock) ────────────────────────────────────────────────
  const noop = (): void => undefined;
  const playCampaign = (c: Campaign): void => console.info('Play campaign', c.id);
  const startSession = (c: CharacterRecord): void => console.info('Start session', c.id);

  const leftToolbar: readonly ToolbarButton[] = [
    { id: 'create', label: 'Create Character', Icon: Sword, onClick: noop },
    { id: 'join', label: 'Join Game', Icon: Map, onClick: noop },
  ];

  const rightToolbar: readonly ToolbarButton[] = [
    { id: 'import', label: 'Import', Icon: Download, onClick: noop },
    { id: 'export', label: 'Export', Icon: Upload, onClick: noop },
    {
      id: 'clear',
      label: 'Clear All',
      Icon: Trash2,
      onClick: noop,
      hoverText: 'hover:text-red-300',
      trailing: <ChevronDown size={14} className="min-w-[14px] opacity-70" />,
    },
  ];

  return (
    <div className="min-h-screen bg-vtt-iron-900 text-vtt-parchment font-interface p-4 md:p-6 flex flex-col gap-4">
      {/* A. Welcome header */}
      <WelcomeHeader
        userName={userName}
        campaignCount={campaigns.length}
        characterCount={characters.length}
      />

      {/* B. Bronze action bar */}
      <ActionBar left={leftToolbar} right={rightToolbar} />

      {/* C. Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left column (3/4). min-w-0 keeps cards from forcing the track wider. */}
        <div className="lg:col-span-3 min-w-0 flex flex-col gap-5">
          {/* Recent campaigns */}
          <section>
            <SectionHeading
              icon={<BookOpen size={20} className="text-vtt-bronze min-w-[20px]" />}
              title="Recent Campaigns"
              action={
                <button
                  type="button"
                  className="text-xs font-bold text-vtt-bronze hover:text-vtt-amber-glow transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 focus-visible:outline-none"
                >
                  + New Campaign
                </button>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onPlay={playCampaign}
                  onEdit={noop}
                  onDelete={noop}
                />
              ))}
            </div>
          </section>

          {/* Recent characters */}
          <section>
            <SectionHeading
              icon={<Shield size={20} className="text-vtt-bronze min-w-[20px]" />}
              title="Recent Characters"
              action={
                <button
                  type="button"
                  className="text-xs font-bold text-vtt-bronze hover:text-vtt-amber-glow transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 focus-visible:outline-none"
                >
                  + New Character
                </button>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {characters.map((c) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  onStartSession={startSession}
                  onEdit={noop}
                  onDelete={noop}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Right column (1/4) — Document Library */}
        <div className="lg:col-span-1 min-w-0">
          <DocumentSidebar
            documents={filteredDocs}
            searchValue={docSearch}
            onSearchChange={setDocSearch}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardNew;

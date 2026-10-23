import React from 'react';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Users from 'lucide-react/dist/esm/icons/users';
import type { CharacterRecord, LastTable, TableRecord } from '../types';
import { Header } from '../organisms/Header';
import { ActionBar } from '../organisms/ActionBar';
import { ContinueBand } from '../organisms/ContinueBand';
import { TableSection } from '../organisms/TableSection';
import { HeroSection } from '../organisms/HeroSection';
import { DocumentSidebar } from '../organisms/DocumentSidebar';
import { FirstRunChooser } from '../organisms/FirstRunChooser';
import { Button } from '../atoms/Button';
import { ParchmentTexture } from '../atoms/ParchmentTexture';
// DiceRoller is intentionally not rendered on the dashboard, but kept as a
// reusable component: src/components/Dashboard/molecules/DiceRoller.tsx
import { DocumentViewer } from '@/components/DocumentViewer';

interface DashboardLayoutProps {
  userName: string;
  /** Tables the user runs as DM. */
  runs: TableRecord[];
  /** Tables the user has joined as a player. */
  joined: TableRecord[];
  heroes: CharacterRecord[];
  lastTable?: LastTable;
  loading?: boolean;

  onBack?: () => void;
  onCreateCharacter?: () => void;
  /** Opens the join modal at the room-code step (first-run chooser). */
  onJoinGame?: () => void;
  /** Opens the join modal at the hero step with this code prefilled. */
  onJoinWithCode?: (code: string) => void;
  onImport?: () => void;
  onExport?: () => void;
  onClearAll?: () => void;
  /** Dev-only seeding; absent in production so the button never renders. */
  onSeedData?: () => void;
  seeding?: boolean;

  /** Open Table (DM) or Rejoin (player). */
  onOpenTable?: (table: TableRecord) => void;
  onEditTable?: (table: TableRecord) => void;
  onDeleteTable?: (table: TableRecord) => void;
  onCreateCampaign?: () => void;
  onOpenCampaignStudio?: () => void;

  onPlayAs?: (hero: CharacterRecord) => void;
  onDeleteHero?: (hero: CharacterRecord) => void;
  onOpenCharacterForge?: () => void;

  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  userName,
  runs,
  joined,
  heroes,
  lastTable,
  loading = false,

  onBack,
  onCreateCharacter,
  onJoinGame,
  onJoinWithCode,
  onImport,
  onExport,
  onClearAll,
  onSeedData,
  seeding = false,

  onOpenTable,
  onEditTable,
  onDeleteTable,
  onCreateCampaign,
  onOpenCampaignStudio,

  onPlayAs,
  onDeleteHero,
  onOpenCharacterForge,

  className = '',
}) => {
  const hasNothing =
    runs.length === 0 && joined.length === 0 && heroes.length === 0;
  const showFirstRun = !loading && hasNothing;
  const showSkeleton = loading && hasNothing;

  // "Tables You Run" is normally hidden when empty, but a user who has heroes
  // or joined tables still needs a way to start a campaign.
  const showRunsEmptyState =
    !showFirstRun && !loading && runs.length === 0 && !hasNothing;

  const continueTable = lastTable
    ? [...runs, ...joined].find(
        (t) => t.id === lastTable.campaignId && t.role === lastTable.role,
      )
    : undefined;

  const tableNames = new Map(
    [...runs, ...joined].map((t) => [t.id, t.name] as const),
  );
  const tableNameFor = (hero: CharacterRecord): string | undefined =>
    hero.boundCampaignId ? tableNames.get(hero.boundCampaignId) : undefined;

  return (
    <div
      className={`
        relative min-h-screen bg-[#121417] text-[#f1e6d3] font-sans p-4 md:p-6
        flex flex-col gap-6 overflow-x-hidden z-10
        ${className}
      `}
    >
      {/* Dynamic background texture */}
      <ParchmentTexture opacity={0.02} className="z-0" />

      {/* Top Header */}
      <Header userName={userName} onBack={onBack} className="relative z-10" />

      {/* Continue / join band (embers live inside it) */}
      <ContinueBand
        table={continueTable}
        onAction={onOpenTable}
        onJoinWithCode={onJoinWithCode}
        className="relative z-10"
      />

      {/* Action Bar */}
      <ActionBar
        onCreateCharacter={onCreateCharacter}
        onImport={onImport}
        onExport={onExport}
        onClearAll={onClearAll}
        onSeedData={onSeedData}
        seeding={seeding}
        className="relative z-10"
      />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10 flex-1">
        {/* Left Columns (3/4 width) */}
        <div className="lg:col-span-3 min-w-0 flex flex-col gap-6">
          {showFirstRun ? (
            <FirstRunChooser
              onCreateCharacter={onCreateCharacter}
              onJoinGame={onJoinGame}
              onCreateCampaign={onCreateCampaign}
              onOpenCampaignStudio={onOpenCampaignStudio}
            />
          ) : showSkeleton ? (
            <div
              aria-busy="true"
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-sm bg-[#252a31]/60 border border-[#8c6b4a]/20 motion-safe:animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <TableSection
                title="Tables You Run"
                icon={<BookOpen size={20} />}
                tables={runs}
                heroes={heroes}
                onAction={onOpenTable}
                onEdit={onEditTable}
                onDelete={onDeleteTable}
                actions={
                  <>
                    {onOpenCampaignStudio && (
                      <Button
                        variant="ghost"
                        onClick={onOpenCampaignStudio}
                        icon={<MapIcon size={14} />}
                        className="text-xs"
                      >
                        Campaign Studio
                      </Button>
                    )}
                    {onCreateCampaign && (
                      <Button
                        variant="ghost"
                        onClick={onCreateCampaign}
                        icon={<Plus size={14} />}
                        className="text-xs"
                      >
                        New Campaign
                      </Button>
                    )}
                  </>
                }
                emptyContent={
                  showRunsEmptyState ? (
                    <p className="p-6 rounded-sm bg-[#252a31]/50 border border-[#8c6b4a]/25 text-center text-sm font-serif italic text-[#cbd5e1]/75">
                      No tables yet. Start a campaign to run your own game.
                    </p>
                  ) : undefined
                }
              />

              <TableSection
                title="Tables You've Joined"
                icon={<Users size={20} />}
                tables={joined}
                heroes={heroes}
                onAction={onOpenTable}
              />

              <HeroSection
                heroes={heroes}
                tableNameFor={tableNameFor}
                onPlayAs={onPlayAs}
                onDelete={onDeleteHero}
                onCreateCharacter={onCreateCharacter}
                onOpenCharacterForge={onOpenCharacterForge}
              />
            </>
          )}
        </div>

        {/* Right Column (1/4 width) */}
        <div className="lg:col-span-1 min-w-0">
          <DocumentSidebar />
        </div>
      </div>

      {/* Document Viewer Modal Overlay */}
      <DocumentViewer />
    </div>
  );
};

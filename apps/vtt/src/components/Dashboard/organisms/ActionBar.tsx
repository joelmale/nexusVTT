import React from 'react';
import { Button } from '../atoms/Button';
import Sword from 'lucide-react/dist/esm/icons/sword';
import Map from 'lucide-react/dist/esm/icons/map';
import Download from 'lucide-react/dist/esm/icons/download';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Wand2 from 'lucide-react/dist/esm/icons/wand-2';

interface ActionBarProps {
  onCreateCharacter?: () => void;
  onJoinGame?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onClearAll?: () => void;
  /**
   * Dev-only seeding. The dashboard passes this only when dev mode is active,
   * so the button is absent (not merely disabled) in production builds.
   */
  onSeedData?: () => void;
  seeding?: boolean;
  className?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onCreateCharacter,
  onJoinGame,
  onImport,
  onExport,
  onClearAll,
  onSeedData,
  seeding = false,
  className = '',
}) => {
  return (
    <section
      className={`
        flex flex-wrap items-center justify-between gap-4 p-2.5 rounded-md
        border-t-2 border-t-[#dcb58f] border-b-2 border-b-[#2a1708] border-l border-r border-[#8c6b4a]
        shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_2px_rgba(0,0,0,0.5),0_6px_12px_rgba(0,0,0,0.5)]
        ${className}
      `}
      style={{
        backgroundImage: `
          linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.25) 100%),
          linear-gradient(to bottom, #a3805c, #705234, #422e1b)
        `,
      }}
    >
      {/* Left side: primary actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="bronze"
          onClick={onCreateCharacter}
          icon={<Sword size={14} className="text-[#f1e6d3]" />}
        >
          Create Character
        </Button>
        <Button
          variant="bronze"
          onClick={onJoinGame}
          icon={<Map size={14} className="text-[#f1e6d3]" />}
        >
          Join Game
        </Button>
        {onSeedData && (
          <Button
            variant="bronze"
            onClick={onSeedData}
            disabled={seeding}
            icon={<Wand2 size={14} className="text-[#f1e6d3]" />}
            title="Populate this account with randomly generated campaigns and characters"
          >
            {seeding ? 'Seeding…' : 'Seed Test Data'}
          </Button>
        )}
      </div>

      {/* Right side: data utilities. Import pulls data IN (upload a sheet),
          Export sends it OUT (download a file) — the icons previously read the
          opposite way round. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          onClick={onImport}
          icon={<Upload size={14} />}
          className="text-xs"
        >
          Import
        </Button>
        <div className="w-[1px] h-4 bg-[#8c6b4a]/30" />
        <Button
          variant="ghost"
          onClick={onExport}
          icon={<Download size={14} />}
          className="text-xs"
        >
          Export
        </Button>

        {/* Destructive actions are separated by a heavier rule and carry a
            persistent danger colour, rather than sitting flush with the
            reversible utilities and only turning red on hover. */}
        {onClearAll && (
          <>
            <div className="w-[2px] h-5 bg-[#2a1708]/50 mx-1" />
            <Button
              variant="ghost"
              onClick={onClearAll}
              icon={<Trash2 size={14} />}
              className="text-xs !text-[#7f1d1d] hover:!text-red-500"
              title="Permanently delete all campaigns and characters on this account"
            >
              Clear All
            </Button>
          </>
        )}
      </div>
    </section>
  );
};

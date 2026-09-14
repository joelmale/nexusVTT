import React from 'react';
import { Button } from '../atoms/Button';
import Sword from 'lucide-react/dist/esm/icons/sword';
import Map from 'lucide-react/dist/esm/icons/map';
import Download from 'lucide-react/dist/esm/icons/download';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';

interface ActionBarProps {
  onCreateCharacter?: () => void;
  onJoinGame?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onClearAll?: () => void;
  className?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onCreateCharacter,
  onJoinGame,
  onImport,
  onExport,
  onClearAll,
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
      {/* Left side actions */}
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
      </div>

      {/* Right side utilities */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          onClick={onImport}
          icon={<Download size={14} />}
          className="text-xs"
        >
          Import
        </Button>
        <div className="w-[1px] h-4 bg-[#8c6b4a]/30" />
        <Button
          variant="ghost"
          onClick={onExport}
          icon={<Upload size={14} />}
          className="text-xs"
        >
          Export
        </Button>
        <div className="w-[1px] h-4 bg-[#8c6b4a]/30" />
        <Button
          variant="ghost"
          onClick={onClearAll}
          icon={<Trash2 size={14} />}
          className="text-xs hover:!text-red-400"
        >
          Clear All
        </Button>
      </div>
    </section>
  );
};

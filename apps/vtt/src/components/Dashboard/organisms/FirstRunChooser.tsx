import React from 'react';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import Sword from 'lucide-react/dist/esm/icons/sword';
import Map from 'lucide-react/dist/esm/icons/map';
import Plus from 'lucide-react/dist/esm/icons/plus';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';

interface FirstRunChooserProps {
  onCreateCharacter?: () => void;
  onJoinGame?: () => void;
  onCreateCampaign?: () => void;
  onOpenCampaignStudio?: () => void;
  className?: string;
}

const cardClass = `
  relative flex flex-col gap-3 p-5 rounded-sm bg-[#EFE8D8] text-[#362b21]
  border-4 border-double border-[#8c6b4a]/60 shadow-[0_4px_8px_rgba(0,0,0,0.3)]
`;

/**
 * Shown when an account has no campaigns and no characters: two parchment
 * paths instead of two empty grids.
 */
export const FirstRunChooser: React.FC<FirstRunChooserProps> = ({
  onCreateCharacter,
  onJoinGame,
  onCreateCampaign,
  onOpenCampaignStudio,
  className = '',
}) => {
  return (
    <section
      aria-label="Get started"
      className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}
    >
      <article className={cardClass}>
        <GothicHeader level={3} variant="cinzel" className="!text-[#362b21]">
          I&apos;m here to play
        </GothicHeader>
        <p className="text-xs font-serif italic text-[#362b21]/75">
          Forge a hero, then join your Game Master&apos;s table with its room
          code.
        </p>
        <div className="flex flex-wrap gap-2 mt-auto">
          {onCreateCharacter && (
            <Button
              variant="bronze"
              onClick={onCreateCharacter}
              icon={<Sword size={14} />}
              className="text-xs"
            >
              Create hero
            </Button>
          )}
          {onJoinGame && (
            <Button
              variant="parchment"
              onClick={onJoinGame}
              icon={<Map size={14} />}
              className="text-xs"
            >
              Join a table
            </Button>
          )}
        </div>
      </article>

      <article className={cardClass}>
        <GothicHeader level={3} variant="cinzel" className="!text-[#362b21]">
          I&apos;m running a game
        </GothicHeader>
        <p className="text-xs font-serif italic text-[#362b21]/75">
          Start a campaign, then prepare maps and notes in Campaign Studio.
        </p>
        <div className="flex flex-wrap gap-2 mt-auto">
          {onCreateCampaign && (
            <Button
              variant="bronze"
              onClick={onCreateCampaign}
              icon={<Plus size={14} />}
              className="text-xs"
            >
              New campaign
            </Button>
          )}
          {onOpenCampaignStudio && (
            <Button
              variant="parchment"
              onClick={onOpenCampaignStudio}
              icon={<BookOpen size={14} />}
              className="text-xs"
            >
              Campaign Studio
            </Button>
          )}
        </div>
      </article>
    </section>
  );
};

import React from 'react';
import { Campaign } from '../types';
import { GothicHeader, OrnateDivider } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Play from 'lucide-react/dist/esm/icons/play';

interface CampaignCardProps {
  campaign: Campaign;
  onPlay?: (campaign: Campaign) => void;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  className?: string;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onPlay,
  onEdit,
  onDelete,
  className = '',
}) => {
  const formattedDate = new Date(campaign.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <article
      className={`
        relative flex flex-col p-3.5 rounded-sm bg-[#EFE8D8] text-[#362b21]
        border-4 border-double border-[#8c6b4a]/60 shadow-[0_4px_8px_rgba(0,0,0,0.3)]
        hover:border-[#d97706]/70 hover:shadow-vtt-amber-glow hover:scale-[1.01]
        transition-all duration-300 min-w-0 flex-1 justify-between
        ${className}
      `}
    >
      {/* Noise background texture to simulate real parchment materiality */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Top Section: Name & Description */}
      <div className="flex flex-col items-center text-center">
        <GothicHeader level={3} variant="cinzel" className="!text-[#362b21] text-lg leading-tight truncate w-full mb-1">
          {campaign.name}
        </GothicHeader>
        
        <OrnateDivider className="!my-2 scale-75" />

        <p className="text-[11px] font-serif italic text-[#362b21]/75 leading-relaxed line-clamp-3">
          {campaign.subtitle}
        </p>
      </div>

      {/* Middle Section: Active Character HUD */}
      <div className="my-4">
        {(campaign.characterClass || campaign.characterRace || campaign.characterLevel) ? (
          <div className="p-3 bg-[#8c6b4a]/10 border border-[#8c6b4a]/30 rounded-sm text-center shadow-inner">
            <span className="font-['Oswald',sans-serif] text-[9px] font-bold text-[#8c6b4a] uppercase tracking-wider block mb-1">
              Active Hero
            </span>
            <span className="font-['Oswald',sans-serif] text-xs font-black text-[#362b21] uppercase block truncate">
              {campaign.characterClass} &bull; {campaign.characterRace}
            </span>
            <span className="block text-[10px] font-bold text-amber-800 uppercase mt-0.5">
              Level {campaign.characterLevel || 1}
            </span>
          </div>
        ) : (
          <div className="p-3 border border-dashed border-[#8c6b4a]/30 rounded-sm text-center text-[10px] italic font-serif text-[#362b21]/50">
            No character joined yet
          </div>
        )}
        
        <p className="text-[10px] text-center text-[#362b21]/50 font-serif italic mt-3.5">
          Active: {formattedDate}
        </p>
      </div>

      {/* Bottom Section: Actions */}
      <div className="flex flex-col gap-2 border-t border-[#8c6b4a]/20 pt-3">
        {onPlay && (
          <Button
            variant="bronze"
            onClick={() => onPlay(campaign)}
            icon={<Play size={12} className="fill-current" />}
            className="w-full !py-1.5 text-xs"
          >
            Play Game
          </Button>
        )}
        <div className="flex justify-between items-center px-1">
          {onEdit && (
            <Button
              variant="ghost"
              onClick={() => onEdit(campaign)}
              icon={<Pencil size={11} />}
              className="!px-2 !py-0.5 text-[10px] !text-[#362b21] hover:!text-amber-700 font-bold"
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => onDelete(campaign)}
              icon={<Trash2 size={11} />}
              className="!px-2 !py-0.5 text-[10px] !text-[#7f1d1d] hover:!text-red-600 font-bold"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};
export default CampaignCard;

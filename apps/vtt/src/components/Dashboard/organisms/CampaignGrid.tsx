import React from 'react';
import { Campaign } from '../types';
import { CampaignCard } from '../molecules/CampaignCard';
import { GothicHeader } from '../atoms/Typography';
import { Button } from '../atoms/Button';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Plus from 'lucide-react/dist/esm/icons/plus';

interface CampaignGridProps {
  campaigns: Campaign[];
  onPlay?: (campaign: Campaign) => void;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onCreateCampaign?: () => void;
  loading?: boolean;
  className?: string;
}

export const CampaignGrid: React.FC<CampaignGridProps> = ({
  campaigns,
  onPlay,
  onEdit,
  onDelete,
  onCreateCampaign,
  loading = false,
  className = '',
}) => {
  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      {/* Grid Header */}
      <div className="flex items-center justify-between border-b border-[#8c6b4a]/30 pb-3">
        <GothicHeader level={2} variant="medieval" className="flex items-center gap-2">
          <BookOpen size={20} className="text-amber-500" />
          Recent Campaigns
        </GothicHeader>
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
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-sm bg-[#252a31]/60 border border-[#8c6b4a]/20 animate-pulse"
            />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-sm bg-[#252a31]/50 border border-[#8c6b4a]/25 text-center select-none">
          <BookOpen size={32} className="text-[#8c6b4a]/50 mb-2" />
          <p className="text-sm font-serif italic text-[#cbd5e1]/60">
            No active campaigns found. Start one from the lobby!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onPlay={onPlay}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
};

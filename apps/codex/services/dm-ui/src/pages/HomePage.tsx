import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Archive } from 'lucide-react';
import { db, Campaign } from '@/db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCampaignStore } from '@/stores/campaignStore';
import { formatRelativeTime } from '@/lib/utils';

export function HomePage() {
  const { setActiveCampaign } = useCampaignStore();
  const [showArchived, setShowArchived] = useState(false);

  // Live query for campaigns
  const campaigns = useLiveQuery(() => {
    if (showArchived) {
      return db.campaigns.orderBy('updatedAt').reverse().toArray();
    }
    return db.campaigns
      .where('status')
      .notEqual('archived')
      .reverse()
      .sortBy('updatedAt');
  }, [showArchived]);

  const activeCampaigns = campaigns?.filter((c) => c.status === 'active') || [];
  const planningCampaigns = campaigns?.filter((c) => c.status === 'planning') || [];
  const completedCampaigns = campaigns?.filter((c) => c.status === 'completed') || [];
  const archivedCampaigns = campaigns?.filter((c) => c.status === 'archived') || [];

  const handleSelectCampaign = (campaign: Campaign) => {
    setActiveCampaign(campaign);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Campaigns</h1>
        <p className="text-muted-foreground">
          Manage your TTRPG campaigns with ease
        </p>
      </div>

      {/* Actions */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>

        <button
          onClick={() => setShowArchived(!showArchived)}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Archive className="h-4 w-4" />
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      {/* Campaign Lists */}
      <div className="space-y-8">
        {/* Active Campaigns */}
        {activeCampaigns.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Active Campaigns</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSelect={handleSelectCampaign}
                />
              ))}
            </div>
          </section>
        )}

        {/* Planning Campaigns */}
        {planningCampaigns.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">In Planning</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {planningCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSelect={handleSelectCampaign}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed Campaigns */}
        {completedCampaigns.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Completed</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSelect={handleSelectCampaign}
                />
              ))}
            </div>
          </section>
        )}

        {/* Archived Campaigns */}
        {showArchived && archivedCampaigns.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Archived</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {archivedCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSelect={handleSelectCampaign}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {(!campaigns || campaigns.length === 0) && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No campaigns yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first campaign to get started
            </p>
            <Link
              to="/campaigns/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
}

function CampaignCard({ campaign, onSelect }: CampaignCardProps) {
  const statusColors = {
    planning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  };

  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      onClick={() => onSelect(campaign)}
      className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between">
        <h3 className="font-semibold">{campaign.name}</h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[campaign.status]}`}
        >
          {campaign.status}
        </span>
      </div>

      {campaign.description && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
          {campaign.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="capitalize">{campaign.gameSystem}</span>
        <span>Updated {formatRelativeTime(campaign.updatedAt)}</span>
      </div>
    </Link>
  );
}

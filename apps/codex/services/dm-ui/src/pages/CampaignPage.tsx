import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { useCampaigns } from '@/hooks/useCampaigns';
import { CampaignForm } from '@/components/campaign/CampaignForm';
import { Button } from '@/components/ui/button';
import {
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  Copy,
  Calendar,
  Users,
  ScrollText,
  Swords,
  Map
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { GAME_SYSTEMS } from '@/types/campaign';

export function CampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const {
    deleteCampaign,
    archiveCampaign,
    restoreCampaign,
    duplicateCampaign,
    setActiveCampaign
  } = useCampaigns();

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Live query for campaign
  const campaign = useLiveQuery(
    () => (campaignId ? db.campaigns.get(campaignId) : undefined),
    [campaignId]
  );

  // Get related stats
  const sessionCount = useLiveQuery(
    () =>
      campaignId
        ? db.sessions.where('campaignId').equals(campaignId).count()
        : 0,
    [campaignId]
  );

  const npcCount = useLiveQuery(
    () =>
      campaignId ? db.npcs.where('campaignId').equals(campaignId).count() : 0,
    [campaignId]
  );

  const plotCount = useLiveQuery(
    () =>
      campaignId
        ? db.plotThreads.where('campaignId').equals(campaignId).count()
        : 0,
    [campaignId]
  );

  const encounterCount = useLiveQuery(
    () =>
      campaignId
        ? db.encounters.where('campaignId').equals(campaignId).count()
        : 0,
    [campaignId]
  );

  const worldCount = useLiveQuery(
    () =>
      campaignId ? db.worlds.where('campaignId').equals(campaignId).count() : 0,
    [campaignId]
  );

  // Set as active campaign on load
  useEffect(() => {
    if (campaign) {
      setActiveCampaign(campaign);
    }
  }, [campaign, setActiveCampaign]);

  if (!campaign) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Campaign not found</h2>
          <p className="text-muted-foreground">
            The campaign you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${campaign.name}"? This will delete ALL associated data (sessions, NPCs, notes, etc.) and cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCampaign(campaign.id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      alert('Failed to delete campaign. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    await archiveCampaign(campaign.id);
  };

  const handleRestore = async () => {
    await restoreCampaign(campaign.id);
  };

  const handleDuplicate = async () => {
    const duplicate = await duplicateCampaign(campaign.id);
    navigate(`/campaigns/${duplicate.id}`);
  };

  const gameSystem =
    GAME_SYSTEMS.find((s) => s.value === campaign.gameSystem)?.label ||
    campaign.gameSystem;

  if (isEditing) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Campaign</h1>
          <p className="text-muted-foreground">Update your campaign details</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <CampaignForm
            campaign={campaign}
            onSuccess={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="text-muted-foreground">{gameSystem}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>

            <Button onClick={handleDuplicate} variant="outline" size="sm">
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>

            {campaign.status === 'archived' ? (
              <Button onClick={handleRestore} variant="outline" size="sm">
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Restore
              </Button>
            ) : (
              <Button onClick={handleArchive} variant="outline" size="sm">
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}

            <Button
              onClick={handleDelete}
              variant="destructive"
              size="sm"
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>

        {campaign.description && (
          <p className="mt-4 text-muted-foreground">{campaign.description}</p>
        )}

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="capitalize">Status: {campaign.status}</span>
          {campaign.currentDate && (
            <span>Current Date: {campaign.currentDate}</span>
          )}
          <span>Updated {formatRelativeTime(campaign.updatedAt)}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Sessions"
          count={sessionCount || 0}
          icon={Calendar}
          href={`/campaigns/${campaign.id}/sessions`}
        />
        <StatCard
          title="NPCs"
          count={npcCount || 0}
          icon={Users}
          href={`/campaigns/${campaign.id}/npcs`}
        />
        <StatCard
          title="Plot Threads"
          count={plotCount || 0}
          icon={ScrollText}
          href={`/campaigns/${campaign.id}/plots`}
        />
        <StatCard
          title="Encounters"
          count={encounterCount || 0}
          icon={Swords}
          href={`/campaigns/${campaign.id}/encounters`}
        />
        <StatCard
          title="Worlds & Locations"
          count={worldCount || 0}
          icon={Map}
          href={`/campaigns/${campaign.id}/worlds`}
        />
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            to={`/campaigns/${campaign.id}/sessions`}
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <h3 className="font-semibold">Plan a Session</h3>
            <p className="text-sm text-muted-foreground">
              Schedule and prepare your next game session
            </p>
          </Link>

          <Link
            to={`/campaigns/${campaign.id}/npcs`}
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <h3 className="font-semibold">Create an NPC</h3>
            <p className="text-sm text-muted-foreground">
              Add a new character to your campaign world
            </p>
          </Link>

          <Link
            to={`/campaigns/${campaign.id}/encounters`}
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <h3 className="font-semibold">Build an Encounter</h3>
            <p className="text-sm text-muted-foreground">
              Create combat, social, or exploration encounters
            </p>
          </Link>

          <Link
            to={`/campaigns/${campaign.id}/notes`}
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <h3 className="font-semibold">Take Notes</h3>
            <p className="text-sm text-muted-foreground">
              Record important campaign information
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  count: number;
  icon: React.ElementType;
  href: string;
}

function StatCard({ title, count, icon: Icon, href }: StatCardProps) {
  return (
    <Link
      to={href}
      className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{count}</p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
    </Link>
  );
}

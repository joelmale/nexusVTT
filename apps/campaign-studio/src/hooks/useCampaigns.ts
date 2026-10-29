import { useLiveQuery } from 'dexie-react-hooks';
import { db, Campaign } from '@/db/schema';
import { CampaignFormData } from '@/types/campaign';
import { generateId } from '@/lib/utils';
import { useCampaignStore } from '@/stores/campaignStore';

export function useCampaigns() {
  const { setActiveCampaign, clearActiveCampaign } = useCampaignStore();

  // Get all campaigns
  const campaigns = useLiveQuery(() => db.campaigns.toArray());

  // Get active campaigns
  const activeCampaigns = useLiveQuery(() =>
    db.campaigns.where('status').equals('active').toArray()
  );

  // Get campaign by ID
  const getCampaign = async (id: string): Promise<Campaign | undefined> => {
    return await db.campaigns.get(id);
  };

  // Create new campaign
  const createCampaign = async (data: CampaignFormData): Promise<Campaign> => {
    const campaign: Campaign = {
      id: generateId(),
      name: data.name,
      description: data.description,
      gameSystem: data.gameSystem,
      currentDate: data.currentDate,
      settings: data.settings || {},
      status: data.status || 'planning',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      exportVersion: '1.0.0'
    };

    await db.campaigns.add(campaign);
    return campaign;
  };

  // Update existing campaign
  const updateCampaign = async (
    id: string,
    data: Partial<CampaignFormData>
  ): Promise<void> => {
    await db.campaigns.update(id, {
      ...data,
      updatedAt: Date.now()
    });
  };

  // Delete campaign (and all related data)
  const deleteCampaign = async (id: string): Promise<void> => {
    await db.transaction('rw', [
      db.campaigns,
      db.worlds,
      db.sessions,
      db.plotThreads,
      db.clues,
      db.npcs,
      db.encounters,
      db.notes,
      db.journals,
      db.journalEntries,
      db.loreEntries,
      db.codexLinks
    ], async () => {
      // Delete all related data
      await db.worlds.where('campaignId').equals(id).delete();
      await db.sessions.where('campaignId').equals(id).delete();
      await db.plotThreads.where('campaignId').equals(id).delete();
      await db.clues.where('campaignId').equals(id).delete();
      await db.npcs.where('campaignId').equals(id).delete();
      await db.encounters.where('campaignId').equals(id).delete();
      await db.notes.where('campaignId').equals(id).delete();
      await db.journalEntries.where('campaignId').equals(id).delete();
      await db.loreEntries.where('campaignId').equals(id).delete();
      await db.codexLinks.where('campaignId').equals(id).delete();

      // Delete journals (need to check if campaign-specific)
      const journals = await db.journals.where('campaignId').equals(id).toArray();
      for (const journal of journals) {
        await db.journalEntries.where('journalId').equals(journal.id).delete();
      }
      await db.journals.where('campaignId').equals(id).delete();

      // Finally, delete the campaign
      await db.campaigns.delete(id);
    });

    // Clear active campaign if it was deleted
    const activeCampaign = useCampaignStore.getState().activeCampaign;
    if (activeCampaign?.id === id) {
      clearActiveCampaign();
    }
  };

  // Archive campaign
  const archiveCampaign = async (id: string): Promise<void> => {
    await updateCampaign(id, { status: 'archived' });
  };

  // Restore archived campaign
  const restoreCampaign = async (id: string): Promise<void> => {
    await updateCampaign(id, { status: 'planning' });
  };

  // Duplicate campaign (without sessions/notes)
  const duplicateCampaign = async (id: string): Promise<Campaign> => {
    const original = await getCampaign(id);
    if (!original) throw new Error('Campaign not found');

    const duplicate: Campaign = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      status: 'planning',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.campaigns.add(duplicate);

    // Optionally copy worlds, NPCs, encounters (but not sessions/notes)
    const worlds = await db.worlds.where('campaignId').equals(id).toArray();
    for (const world of worlds) {
      await db.worlds.add({
        ...world,
        id: generateId(),
        campaignId: duplicate.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    return duplicate;
  };

  // Search campaigns
  const searchCampaigns = async (query: string): Promise<Campaign[]> => {
    if (!query) return campaigns || [];

    const lowerQuery = query.toLowerCase();
    return (campaigns || []).filter((campaign) =>
      campaign.name.toLowerCase().includes(lowerQuery) ||
      campaign.description?.toLowerCase().includes(lowerQuery) ||
      campaign.gameSystem.toLowerCase().includes(lowerQuery)
    );
  };

  return {
    campaigns,
    activeCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    archiveCampaign,
    restoreCampaign,
    duplicateCampaign,
    searchCampaigns,
    setActiveCampaign,
    clearActiveCampaign
  };
}

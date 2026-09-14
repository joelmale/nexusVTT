import { db, Campaign } from '@/db/schema';
import { saveAs } from 'file-saver';
import type {
  World,
  Session,
  PlotThread,
  Clue,
  NPC,
  Encounter,
  Note,
  Journal,
  JournalEntry,
  LoreEntry,
  CodexLink
} from '@/db/schema';

export interface CampaignExport {
  version: string;
  exportedAt: number;
  exportedBy: string;

  campaign: Campaign;
  worlds: World[];
  sessions: Session[];
  plotThreads: PlotThread[];
  clues: Clue[];
  npcs: NPC[];
  encounters: Encounter[];
  notes: Note[];
  journals: Journal[];
  journalEntries: JournalEntry[];
  loreEntries: LoreEntry[];
  codexLinks: CodexLink[];

  metadata: {
    totalNotes: number;
    totalSessions: number;
    totalNPCs: number;
    totalWorlds: number;
    totalPlotThreads: number;
    totalEncounters: number;
    campaignStatus: string;
    lastSessionDate?: number;
  };
}

export class ExportService {
  /**
   * Export a campaign to JSON format
   */
  async exportCampaign(campaignId: string): Promise<CampaignExport> {
    const campaign = await db.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const [
      worlds,
      sessions,
      plotThreads,
      clues,
      npcs,
      encounters,
      notes,
      journals,
      journalEntries,
      loreEntries,
      codexLinks
    ] = await Promise.all([
      db.worlds.where('campaignId').equals(campaignId).toArray(),
      db.sessions.where('campaignId').equals(campaignId).toArray(),
      db.plotThreads.where('campaignId').equals(campaignId).toArray(),
      db.clues.where('campaignId').equals(campaignId).toArray(),
      db.npcs.where('campaignId').equals(campaignId).toArray(),
      db.encounters.where('campaignId').equals(campaignId).toArray(),
      db.notes.where('campaignId').equals(campaignId).toArray(),
      db.journals.where('campaignId').equals(campaignId).toArray(),
      db.journalEntries.where('campaignId').equals(campaignId).toArray(),
      db.loreEntries.where('campaignId').equals(campaignId).toArray(),
      db.codexLinks.where('campaignId').equals(campaignId).toArray()
    ]);

    const lastSession = sessions
      .filter(s => s.actualDate)
      .sort((a, b) => (b.actualDate || 0) - (a.actualDate || 0))[0];

    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      exportedBy: 'offline',
      campaign,
      worlds,
      sessions,
      plotThreads,
      clues,
      npcs,
      encounters,
      notes,
      journals,
      journalEntries,
      loreEntries,
      codexLinks,
      metadata: {
        totalNotes: notes.length,
        totalSessions: sessions.length,
        totalNPCs: npcs.length,
        totalWorlds: worlds.length,
        totalPlotThreads: plotThreads.length,
        totalEncounters: encounters.length,
        campaignStatus: campaign.status,
        lastSessionDate: lastSession?.actualDate
      }
    };
  }

  /**
   * Download campaign as JSON file
   */
  async downloadCampaignJSON(campaignId: string, filename?: string): Promise<void> {
    const data = await this.exportCampaign(campaignId);
    const campaign = await db.campaigns.get(campaignId);

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const defaultFilename = `${campaign?.name || 'campaign'}-${Date.now()}.json`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    saveAs(blob, filename || defaultFilename);
  }

  /**
   * Import campaign from JSON
   */
  async importCampaign(
    data: CampaignExport,
    options: {
      overwrite?: boolean;
      newCampaignId?: boolean;
    } = {}
  ): Promise<string> {
    // Validation
    if (data.version !== '1.0.0') {
      throw new Error(`Unsupported export version: ${data.version}`);
    }

    if (!data.campaign) {
      throw new Error('Invalid export data: missing campaign');
    }

    let campaignId = data.campaign.id;

    // Generate new ID if requested
    if (options.newCampaignId) {
      campaignId = crypto.randomUUID();
      data = this.remapCampaignIds(data, campaignId);
    }

    // Check for conflicts
    if (!options.overwrite) {
      const existing = await db.campaigns.get(campaignId);
      if (existing) {
        throw new Error(
          'Campaign already exists. Enable overwrite option or import with new ID.'
        );
      }
    }

    // Import in transaction
    await db.transaction(
      'rw',
      [
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
      ],
      async () => {
        await db.campaigns.put(data.campaign);
        await db.worlds.bulkPut(data.worlds);
        await db.sessions.bulkPut(data.sessions);
        await db.plotThreads.bulkPut(data.plotThreads);
        await db.clues.bulkPut(data.clues);
        await db.npcs.bulkPut(data.npcs);
        await db.encounters.bulkPut(data.encounters);
        await db.notes.bulkPut(data.notes);
        await db.journals.bulkPut(data.journals);
        await db.journalEntries.bulkPut(data.journalEntries);
        await db.loreEntries.bulkPut(data.loreEntries);
        await db.codexLinks.bulkPut(data.codexLinks);
      }
    );

    return campaignId;
  }

  /**
   * Remap campaign IDs (for importing as new campaign)
   */
  private remapCampaignIds(
    data: CampaignExport,
    newCampaignId: string
  ): CampaignExport {
    const idMap = new Map<string, string>();
    idMap.set(data.campaign.id, newCampaignId);

    // Generate new IDs for all entities
    const generateNewIds = <T extends { id: string; campaignId?: string }>(items: T[]) => {
      return items.map(item => {
        const newId = crypto.randomUUID();
        idMap.set(item.id, newId);
        return { ...item, id: newId, campaignId: newCampaignId } as T;
      });
    };

    const worlds = generateNewIds(data.worlds);
    const sessions = generateNewIds(data.sessions);
    const plotThreads = generateNewIds(data.plotThreads);
    const clues = generateNewIds(data.clues);
    const npcs = generateNewIds(data.npcs);
    const encounters = generateNewIds(data.encounters);
    const notes = generateNewIds(data.notes);
    const journals = generateNewIds(data.journals);
    const journalEntries = generateNewIds(data.journalEntries);
    const loreEntries = generateNewIds(data.loreEntries);
    const codexLinks = generateNewIds(data.codexLinks);

    // Update foreign key references
    const updateReferences = (item: Record<string, unknown>) => {
      const updated = { ...item };

      // Update common references
      if (typeof updated.plotThreadId === 'string' && idMap.has(updated.plotThreadId)) {
        updated.plotThreadId = idMap.get(updated.plotThreadId)!;
      }
      if (typeof updated.sessionId === 'string' && idMap.has(updated.sessionId)) {
        updated.sessionId = idMap.get(updated.sessionId)!;
      }
      if (typeof updated.parentThreadId === 'string' && idMap.has(updated.parentThreadId)) {
        updated.parentThreadId = idMap.get(updated.parentThreadId)!;
      }
      if (typeof updated.parentWorldId === 'string' && idMap.has(updated.parentWorldId)) {
        updated.parentWorldId = idMap.get(updated.parentWorldId)!;
      }
      if (typeof updated.journalId === 'string' && idMap.has(updated.journalId)) {
        updated.journalId = idMap.get(updated.journalId)!;
      }
      if (typeof updated.entityId === 'string' && idMap.has(updated.entityId)) {
        updated.entityId = idMap.get(updated.entityId)!;
      }

      return updated;
    };

    return {
      ...data,
      campaign: { ...data.campaign, id: newCampaignId },
      worlds: worlds.map(item => updateReferences(item as any) as unknown as World),
      sessions: sessions.map(item => updateReferences(item as any) as unknown as Session),
      plotThreads: plotThreads.map(item => updateReferences(item as any) as unknown as PlotThread),
      clues: clues.map(item => updateReferences(item as any) as unknown as Clue),
      npcs: npcs.map(item => updateReferences(item as any) as unknown as NPC),
      encounters: encounters.map(item => updateReferences(item as any) as unknown as Encounter),
      notes: notes.map(item => updateReferences(item as any) as unknown as Note),
      journals: journals.map(item => updateReferences(item as any) as unknown as Journal),
      journalEntries: journalEntries.map(item => updateReferences(item as any) as unknown as JournalEntry),
      loreEntries: loreEntries.map(item => updateReferences(item as any) as unknown as LoreEntry),
      codexLinks: codexLinks.map(item => updateReferences(item as any) as unknown as CodexLink)
    };
  }

  /**
   * Validate export data
   */
  validateExport(data: CampaignExport): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.version) {
      errors.push('Missing version');
    } else if (data.version !== '1.0.0') {
      errors.push(`Unsupported version: ${data.version}`);
    }

    if (!data.campaign) {
      errors.push('Missing campaign data');
    } else {
      if (!data.campaign.id) errors.push('Missing campaign ID');
      if (!data.campaign.name) errors.push('Missing campaign name');
      if (!data.campaign.gameSystem) errors.push('Missing game system');
    }

    if (!data.metadata) {
      errors.push('Missing metadata');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const exportService = new ExportService();

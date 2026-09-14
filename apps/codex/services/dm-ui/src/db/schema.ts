import Dexie, { Table } from 'dexie';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  gameSystem: string; // dnd5e, pathfinder2e, etc.
  currentDate?: string; // In-game date
  settings: Record<string, any>;
  status: 'planning' | 'active' | 'completed' | 'archived';
  createdAt: number;
  updatedAt: number;
  exportVersion: string;
}

export interface World {
  id: string;
  campaignId: string;
  name: string;
  description?: string;
  type: 'continent' | 'region' | 'city' | 'dungeon' | 'plane' | 'location' | 'kingdom' | 'town' | 'village' | 'other';
  parentWorldId?: string;
  mapUrl?: string; // Base64 or blob URL
  map_url?: string; // Alternative field name for compatibility
  geography?: string; // Geographic description
  climate?: string; // Climate description
  population?: number; // Population count
  government?: string; // Government type and details
  factions?: string[]; // Faction names or IDs
  points_of_interest?: string[]; // POI names or descriptions
  notes?: string; // Additional notes
  properties: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  campaignId: string;
  sessionNumber: number;
  title: string;
  plannedDate?: number;
  actualDate?: number;
  duration?: number; // Duration in minutes
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  worldId?: string; // Location of the session
  summary?: string; // Markdown
  notes?: string; // DM notes (Markdown)
  privateNotes?: string; // DM-only notes (Markdown)
  publicNotes?: string; // Player-visible notes (Markdown)
  participants?: string[]; // Character names or player names
  experience_awarded?: number; // Total XP awarded
  treasure_awarded?: string; // Description of treasure
  quests_advanced?: string[]; // Quest IDs or names
  npcs_encountered?: string[]; // NPC IDs or names
  createdAt: number;
  updatedAt: number;
}

export interface PlotThread {
  id: string;
  campaignId: string;
  name: string;
  description: string; // Markdown
  status: 'active' | 'resolved' | 'abandoned' | 'background';
  priority: number; // 1-10
  parentThreadId?: string;
  startSessionId?: string;
  endSessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Clue {
  id: string;
  plotThreadId: string;
  campaignId: string;
  name: string;
  description: string; // Markdown
  discovered: boolean;
  discoveredBy: string[]; // Character names
  sessionId?: string;
  importance: number; // 1-5
  createdAt: number;
  updatedAt: number;
}

export interface NPC {
  id: string;
  campaignId: string;
  name: string;
  title?: string;
  race?: string;
  class?: string;
  level?: number;
  appearance?: string; // Markdown
  personality?: string; // Markdown
  motivation?: string; // Markdown
  secrets?: string; // Markdown, DM-only
  publicInfo?: string; // Markdown, player-visible
  status: 'alive' | 'dead' | 'missing' | 'unknown';
  location?: string;
  homeWorldId?: string; // Reference to World for home location
  faction?: string;
  relationships: Record<string, any>; // { npcId/characterName: relationship }
  statBlockDocumentId?: string; // Link to codex document
  customStats?: Record<string, any>;
  portraitUrl?: string; // Base64 or blob URL
  createdAt: number;
  updatedAt: number;
}

export interface Encounter {
  id: string;
  campaignId: string;
  name: string;
  type: 'combat' | 'social' | 'exploration' | 'puzzle';
  difficulty?: 'easy' | 'medium' | 'hard' | 'deadly';
  description: string; // Markdown
  location?: string;
  worldId?: string; // Reference to World for location
  triggers: Record<string, any>;
  rewards: Record<string, any>;
  notes?: string; // Markdown
  monsters: Array<{
    documentId?: string; // Link to codex monster
    name: string;
    quantity: number;
    customStats?: Record<string, any>;
  }>;
  npcs: string[]; // NPC IDs
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  campaignId: string;
  sessionId?: string;
  type: 'session' | 'character' | 'location' | 'general';
  title: string;
  content: string; // Markdown or Lexical JSON
  tags: string[];
  visibility: 'dm_only' | 'players';
  linkedEntities: Array<{
    type: 'npc' | 'location' | 'item' | 'document';
    id: string;
    name: string;
  }>;
  attachments: Array<{
    type: 'image' | 'map' | 'handout';
    url: string; // Base64 or blob URL
    name: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface Journal {
  id: string;
  campaignId?: string;
  type: 'dm' | 'player' | 'character';
  title: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEntry {
  id: string;
  journalId: string;
  campaignId: string;
  sessionId?: string;
  entryDate: number;
  inGameDate?: string;
  title: string;
  content: string; // Markdown or Lexical JSON
  mood?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LoreEntry {
  id: string;
  campaignId: string;
  title: string;
  content: string; // Markdown
  category: string;
  visibility: 'dm_only' | 'players';
  revealedInSessionId?: string;
  linkedEntities: Array<{
    type: 'world' | 'npc' | 'location';
    id: string;
    name: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface CodexLink {
  id: string;
  campaignId: string;
  entityType: 'npc' | 'encounter' | 'note';
  entityId: string;
  documentId: string; // doc-api document ID
  documentTitle: string; // Cached for offline
  linkType: 'stat_block' | 'reference' | 'lore' | 'map';
  notes?: string;
  createdAt: number;
}

// ============================================================================
// Dexie Database Class
// ============================================================================

export class CampaignDatabase extends Dexie {
  campaigns!: Table<Campaign>;
  worlds!: Table<World>;
  sessions!: Table<Session>;
  plotThreads!: Table<PlotThread>;
  clues!: Table<Clue>;
  npcs!: Table<NPC>;
  encounters!: Table<Encounter>;
  notes!: Table<Note>;
  journals!: Table<Journal>;
  journalEntries!: Table<JournalEntry>;
  loreEntries!: Table<LoreEntry>;
  codexLinks!: Table<CodexLink>;

  constructor() {
    super('NexusCodexCampaigns');

    this.version(1).stores({
      campaigns: 'id, name, status, createdAt, updatedAt',
      worlds: 'id, campaignId, parentWorldId, name, type',
      sessions: 'id, campaignId, sessionNumber, status, plannedDate, worldId',
      plotThreads: 'id, campaignId, parentThreadId, status, priority',
      clues: 'id, plotThreadId, campaignId, discovered',
      npcs: 'id, campaignId, name, status, faction, homeWorldId',
      encounters: 'id, campaignId, type, difficulty, worldId',
      notes: 'id, campaignId, sessionId, type, visibility, createdAt',
      journals: 'id, campaignId, type, createdAt',
      journalEntries: 'id, journalId, campaignId, sessionId, entryDate',
      loreEntries: 'id, campaignId, category, visibility',
      codexLinks: 'id, campaignId, entityType, entityId, documentId'
    });

    // Add hooks for automatic timestamps
    this.campaigns.hook('creating', (_primKey, obj) => {
      obj.createdAt = Date.now();
      obj.updatedAt = Date.now();
      obj.exportVersion = '1.0.0';
    });

    this.campaigns.hook('updating', (modifications: any) => {
      modifications.updatedAt = Date.now();
    });

    // Auto-timestamp for all other entities
    const tables = [
      this.worlds,
      this.sessions,
      this.plotThreads,
      this.clues,
      this.npcs,
      this.encounters,
      this.notes,
      this.journals,
      this.journalEntries,
      this.loreEntries,
      this.codexLinks
    ];

    tables.forEach((table) => {
      table.hook('creating', (_primKey, obj: any) => {
        obj.createdAt = Date.now();
        obj.updatedAt = Date.now();
      });

      table.hook('updating', (modifications: any) => {
        modifications.updatedAt = Date.now();
      });
    });
  }
}

// Export singleton instance
export const db = new CampaignDatabase();

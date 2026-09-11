# NexusCodex DM Campaign Planner - Implementation Plan

## Vision Statement

Transform NexusCodex into a comprehensive DM workspace by adding a **client-side first** campaign planning interface that seamlessly integrates with the existing intelligent document codex. DMs can plan campaigns offline using IndexedDB, link to codex documents, and export their work as portable JSON files.

---

## Architecture Overview

### Two-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          NexusCodex Ecosystem                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Admin UI (Port 3001)                            │   │
│  │  • Document Management    • Processing Queue                     │   │
│  │  • System Health          • User Management                      │   │
│  │  • ElasticSearch Admin    • Tag Management                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   DM UI (Port 3003) - NEW                        │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │           Client-Side Campaign Storage (IndexedDB)        │  │   │
│  │  │  • Campaigns    • Sessions      • Plot Threads            │  │   │
│  │  │  • NPCs         • Encounters    • Notes                   │  │   │
│  │  │  • Lore         • Journals      • World Maps              │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │              Sync & Integration Layer                     │  │   │
│  │  │  • Codex Document Linking    • Export/Import (JSON)       │  │   │
│  │  │  • Optional Cloud Sync       • Conflict Resolution        │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │                   UI Components                           │  │   │
│  │  │  • Campaign Dashboard    • World Builder                  │  │   │
│  │  │  • Session Planner       • NPC Manager                    │  │   │
│  │  │  • Plot Tracker          • Encounter Builder              │  │   │
│  │  │  • Note Editor           • Codex Browser                  │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Existing Backend Services (Read-Only for DM UI)     │   │
│  │  • doc-api (3000)      • doc-processor      • doc-websocket     │   │
│  │  • PostgreSQL          • ElasticSearch      • Redis             │   │
│  │  • S3/MinIO            • Document Processing                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Client-Side First**: All campaign data stored in IndexedDB, works 100% offline
2. **Codex Integration**: Read-only access to doc-api for browsing/linking documents
3. **Export/Import**: JSON-based portable format for backups and sharing
4. **Optional Sync**: Future enhancement for multi-device sync (not Phase 1)
5. **Lightweight Backend**: Minimal server changes, reuse existing doc-api
6. **Modern Stack**: React + TypeScript + IndexedDB + TailwindCSS + shadcn/ui

---

## Tech Stack (DM UI Service)

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7 (requires Node.js 22+)
- **Styling**: Tailwind CSS + shadcn/ui components (consistent with admin-ui)
- **State Management**:
  - **Zustand** for global app state (campaigns, active session, UI state)
  - **TanStack Query** for codex document fetching (read-only from doc-api)
- **Client Storage**:
  - **Dexie.js** (IndexedDB wrapper) for campaign data
  - **localforage** as fallback for browsers with limited IndexedDB support
- **Rich Text Editor**: **Lexical** (Meta's text editor framework) for notes
- **Data Visualization**: **D3.js** for plot graphs, relationship maps
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **Date/Time**: date-fns
- **Export/Import**: Native JSON + FileSaver.js

### Backend Integration
- **doc-api**: Read-only access for codex documents (no auth changes needed)
- **ElasticSearch**: Search codex documents via existing `/api/search` endpoints
- **Future**: Optional campaign sync service (Phase 2+)

---

## Database Schema (IndexedDB)

### Dexie.js Schema Definition

```typescript
// services/dm-ui/src/db/schema.ts

import Dexie, { Table } from 'dexie';

export interface Campaign {
  id: string;                    // UUID
  name: string;
  description?: string;
  gameSystem: string;            // dnd5e, pathfinder2e, etc.
  currentDate?: string;          // In-game date
  settings: Record<string, any>; // Custom settings
  status: 'planning' | 'active' | 'completed' | 'archived';
  createdAt: number;             // Timestamp
  updatedAt: number;
  exportVersion: string;         // Schema version for exports
}

export interface World {
  id: string;
  campaignId: string;
  name: string;
  description?: string;
  type: 'continent' | 'region' | 'city' | 'dungeon' | 'plane' | 'location';
  parentWorldId?: string;        // Hierarchical worlds
  mapUrl?: string;               // Local blob URL or base64
  properties: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  campaignId: string;
  sessionNumber: number;
  title: string;
  plannedDate?: number;          // Timestamp
  actualDate?: number;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  summary?: string;              // Markdown
  privateNotes?: string;         // DM-only notes (Markdown)
  publicNotes?: string;          // Player-visible notes (Markdown)
  createdAt: number;
  updatedAt: number;
}

export interface PlotThread {
  id: string;
  campaignId: string;
  name: string;
  description: string;           // Markdown
  status: 'active' | 'resolved' | 'abandoned' | 'background';
  priority: number;              // 1-10
  parentThreadId?: string;       // Sub-plots
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
  description: string;           // Markdown
  discovered: boolean;
  discoveredBy: string[];        // Character names
  sessionId?: string;
  importance: number;            // 1-5
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
  appearance?: string;           // Markdown
  personality?: string;          // Markdown
  motivation?: string;           // Markdown
  secrets?: string;              // Markdown, DM-only
  publicInfo?: string;           // Markdown, player-visible
  status: 'alive' | 'dead' | 'missing' | 'unknown';
  location?: string;
  faction?: string;
  relationships: Record<string, any>; // { npcId/characterName: relationship }
  statBlockDocumentId?: string;  // Link to codex document
  customStats?: Record<string, any>;
  portraitUrl?: string;          // Base64 or blob URL
  createdAt: number;
  updatedAt: number;
}

export interface Encounter {
  id: string;
  campaignId: string;
  name: string;
  type: 'combat' | 'social' | 'exploration' | 'puzzle';
  difficulty?: 'easy' | 'medium' | 'hard' | 'deadly';
  description: string;           // Markdown
  location?: string;
  triggers: Record<string, any>;
  rewards: Record<string, any>;
  notes?: string;                // Markdown
  monsters: Array<{
    documentId?: string;         // Link to codex monster
    name: string;
    quantity: number;
    customStats?: Record<string, any>;
  }>;
  npcs: string[];                // NPC IDs
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  campaignId: string;
  sessionId?: string;
  type: 'session' | 'character' | 'location' | 'general';
  title: string;
  content: string;               // Markdown or Lexical JSON
  tags: string[];
  visibility: 'dm_only' | 'players';
  linkedEntities: Array<{
    type: 'npc' | 'location' | 'item' | 'document';
    id: string;
    name: string;
  }>;
  attachments: Array<{
    type: 'image' | 'map' | 'handout';
    url: string;                 // Base64 or blob URL
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
  entryDate: number;             // Timestamp
  inGameDate?: string;
  title: string;
  content: string;               // Markdown or Lexical JSON
  mood?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LoreEntry {
  id: string;
  campaignId: string;
  title: string;
  content: string;               // Markdown
  category: string;              // history, religion, geography, etc.
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
  documentId: string;            // doc-api document ID
  documentTitle: string;         // Cached for offline
  linkType: 'stat_block' | 'reference' | 'lore' | 'map';
  notes?: string;
  createdAt: number;
}

// Dexie Database Class
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
      sessions: 'id, campaignId, sessionNumber, status, plannedDate',
      plotThreads: 'id, campaignId, parentThreadId, status, priority',
      clues: 'id, plotThreadId, campaignId, discovered',
      npcs: 'id, campaignId, name, status, faction',
      encounters: 'id, campaignId, type, difficulty',
      notes: 'id, campaignId, sessionId, type, visibility, createdAt',
      journals: 'id, campaignId, type, createdAt',
      journalEntries: 'id, journalId, campaignId, sessionId, entryDate',
      loreEntries: 'id, campaignId, category, visibility',
      codexLinks: 'id, campaignId, entityType, entityId, documentId'
    });
  }
}

export const db = new CampaignDatabase();
```

---

## Export/Import Format

### JSON Export Schema

```typescript
// services/dm-ui/src/types/export.ts

export interface CampaignExport {
  version: string;               // Schema version (e.g., "1.0.0")
  exportedAt: number;            // Timestamp
  exportedBy: string;            // Username or "offline"

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

  // Metadata
  metadata: {
    totalNotes: number;
    totalSessions: number;
    totalNPCs: number;
    campaignStatus: string;
    lastSessionDate?: number;
  };
}

// Export service
export class ExportService {
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
        campaignStatus: campaign.status,
        lastSessionDate: sessions
          .filter(s => s.actualDate)
          .sort((a, b) => (b.actualDate || 0) - (a.actualDate || 0))[0]?.actualDate
      }
    };
  }

  async importCampaign(data: CampaignExport, options: {
    overwrite?: boolean;
    newCampaignId?: string;
  } = {}): Promise<string> {
    // Validation
    if (data.version !== '1.0.0') {
      throw new Error(`Unsupported export version: ${data.version}`);
    }

    const campaignId = options.newCampaignId || data.campaign.id;

    // Check for conflicts
    if (!options.overwrite) {
      const existing = await db.campaigns.get(campaignId);
      if (existing) {
        throw new Error('Campaign already exists. Use overwrite option.');
      }
    }

    // Import in transaction
    await db.transaction('rw', [
      db.campaigns, db.worlds, db.sessions, db.plotThreads, db.clues,
      db.npcs, db.encounters, db.notes, db.journals, db.journalEntries,
      db.loreEntries, db.codexLinks
    ], async () => {
      // Update campaign ID if generating new
      if (options.newCampaignId) {
        data = this.remapCampaignIds(data, campaignId);
      }

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
    });

    return campaignId;
  }

  async downloadCampaignJSON(campaignId: string, filename?: string) {
    const data = await this.exportCampaign(campaignId);
    const campaign = await db.campaigns.get(campaignId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${campaign?.name || 'campaign'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private remapCampaignIds(data: CampaignExport, newCampaignId: string): CampaignExport {
    // Deep clone and remap all campaignId references
    // ... implementation
    return data;
  }
}
```

---

## Phase Implementation Plan (16 Weeks Total)

**Note**: Phase 5 (AI Tools) has been **deferred** to avoid API costs. Timeline adjusted from 18 weeks to 16 weeks.

### Phase 1: Foundation & Core Infrastructure (Weeks 1-3)

**Goal**: Set up DM UI service, IndexedDB schema, basic campaign CRUD, codex integration

#### Epic 1.1: DM UI Service Setup
**Tasks**:
- **TASK-001**: Create `services/dm-ui` directory structure
  - Initialize Vite + React + TypeScript project
  - Add TailwindCSS + shadcn/ui
  - Configure ESLint, Prettier
  - Add to `docker-compose.yml` (port 3003)

- **TASK-002**: Set up IndexedDB with Dexie.js
  - Implement `CampaignDatabase` class
  - Create database migration system
  - Add Dexie hooks for timestamps
  - Test database operations

- **TASK-003**: Create base UI layout
  - Top navigation bar (campaign selector, export/import)
  - Sidebar navigation (campaigns, sessions, NPCs, etc.)
  - Main content area
  - Responsive design (mobile/tablet support)

#### Epic 1.2: Campaign Management
**Tasks**:
- **TASK-004**: Campaign CRUD components
  - `CampaignDashboard.tsx` - List all campaigns
  - `CampaignForm.tsx` - Create/edit campaign
  - `CampaignDetails.tsx` - View campaign overview
  - Campaign status badges (planning, active, completed)

- **TASK-005**: Campaign services
  - `useCampaigns` hook with Zustand
  - CRUD operations via Dexie
  - Campaign search/filter
  - Campaign archive/restore

#### Epic 1.3: Codex Integration (Read-Only)
**Tasks**:
- **TASK-006**: Codex browser component
  - `CodexBrowser.tsx` - Browse doc-api documents
  - Search interface (uses existing `/api/search/quick`)
  - Document type filters (spells, monsters, items, etc.)
  - Document preview modal

- **TASK-007**: Codex linking service
  - `useCodexLinks` hook
  - Link document to NPC/encounter/note
  - Display linked documents in entities
  - Cache document metadata in IndexedDB for offline

- **TASK-008**: TanStack Query integration
  - Set up query client for doc-api
  - Prefetch commonly used documents
  - Error handling for offline mode
  - Stale-while-revalidate strategy

#### Epic 1.4: Export/Import System
**Tasks**:
- **TASK-009**: Export service implementation
  - `ExportService` class
  - JSON export with schema versioning
  - Metadata generation
  - Blob download via FileSaver.js

- **TASK-010**: Import service implementation
  - JSON validation with Zod
  - Conflict detection and resolution
  - ID remapping for duplicate imports
  - Import preview UI

- **TASK-011**: Export/Import UI
  - Export modal (select campaign, filename)
  - Import modal (drag-drop JSON file)
  - Import preview (show what will be imported)
  - Progress indicators

**Deliverables**:
- Functional DM UI service on port 3003
- Campaign create/read/update/delete
- Codex document browsing and linking
- Export/import campaigns as JSON
- 100% offline capable

---

### Phase 2: World Building & Session Planning (Weeks 4-6)

#### Epic 2.1: World Builder
**Tasks**:
- **TASK-012**: World data model and services
  - `useWorlds` hook
  - Hierarchical world CRUD
  - World type management (continent, city, dungeon, etc.)

- **TASK-013**: World builder UI
  - `WorldBuilder.tsx` - Main component
  - `WorldTree.tsx` - Hierarchical tree view (react-arborist)
  - `WorldDetails.tsx` - World properties form
  - Drag-drop to reorganize hierarchy

- **TASK-014**: Map management
  - Upload map images (store as base64 in IndexedDB)
  - Display maps with pan/zoom (react-zoom-pan-pinch)
  - Link locations to map coordinates
  - Map annotation tools (markers, notes)

#### Epic 2.2: Session Planner
**Tasks**:
- **TASK-015**: Session data model and services
  - `useSessions` hook
  - Session CRUD with campaign association
  - Session status workflow (planned → in-progress → completed)

- **TASK-016**: Session planner UI
  - `SessionPlanner.tsx` - Calendar view (react-big-calendar)
  - `SessionDetails.tsx` - Session form
  - `SessionRunner.tsx` - In-session view (current notes, NPCs, encounters)
  - Session templates for quick planning

- **TASK-017**: Session notes editor
  - Rich text editor with Lexical
  - Private vs public notes toggle
  - Markdown export
  - Auto-save to IndexedDB (debounced)

**Deliverables**:
- Hierarchical world builder with maps
- Session calendar and planning tools
- Rich text session notes
- Session runner for active sessions

---

### Phase 3: Story Tools (Plot, NPCs, Encounters) (Weeks 7-10)

#### Epic 3.1: Plot Thread Management
**Tasks**:
- **TASK-018**: Plot thread data model and services
  - `usePlotThreads` hook
  - Hierarchical plots (main plot + sub-plots)
  - Plot status tracking

- **TASK-019**: Plot tracker UI
  - `PlotTracker.tsx` - List of active plots
  - `PlotGraph.tsx` - D3.js force-directed graph
  - `PlotTimeline.tsx` - Plot progression over sessions
  - Plot connection visualizer

- **TASK-020**: Clue management
  - `ClueManager.tsx` - List clues by plot
  - Mark clues as discovered
  - Track which characters discovered clues
  - Undiscovered clues dashboard

#### Epic 3.2: NPC Manager
**Tasks**:
- **TASK-021**: NPC data model and services
  - `useNPCs` hook
  - NPC CRUD with rich metadata
  - NPC relationships (to PCs and other NPCs)

- **TASK-022**: NPC manager UI
  - `NPCManager.tsx` - NPC card grid
  - `NPCEditor.tsx` - Detailed NPC form
  - `NPCCard.tsx` - Quick view card
  - Portrait upload (base64 storage)

- **TASK-023**: NPC relationship graph
  - `RelationshipGraph.tsx` - D3.js network graph
  - Visual relationship strength indicators
  - Faction grouping
  - Interactive node exploration

- **TASK-024**: Link NPCs to codex stat blocks
  - Search monsters from codex
  - Link monster document to NPC
  - Override stats with custom values
  - Quick stat reference in NPC view

#### Epic 3.3: Encounter Builder
**Tasks**:
- **TASK-025**: Encounter data model and services
  - `useEncounters` hook
  - Encounter CRUD
  - Monster/NPC association

- **TASK-026**: Encounter builder UI
  - `EncounterBuilder.tsx` - Main builder
  - `MonsterSelector.tsx` - Search/add monsters from codex
  - `EncounterDifficultyCalc.tsx` - D&D 5e CR calculator
  - Drag-drop monsters to encounter

- **TASK-027**: Encounter templates
  - Save encounters as templates
  - Quick encounter generation (random from codex)
  - Encounter library

**Deliverables**:
- Plot thread tracker with visualizations
- Comprehensive NPC manager with relationships
- Encounter builder with codex integration
- D&D 5e difficulty calculator

---

### Phase 4: Notes, Journals, and Lore (Weeks 11-13)

#### Epic 4.1: Note Management System
**Tasks**:
- **TASK-028**: Note data model and services
  - `useNotes` hook
  - Note CRUD with tagging
  - Entity linking (NPCs, locations, documents)

- **TASK-029**: Note editor UI
  - `NoteEditor.tsx` - Lexical rich text editor
  - Tag selector with autocomplete
  - Entity linker (autocomplete search)
  - Attachment manager (base64 images)

- **TASK-030**: Note browser
  - `NoteBrowser.tsx` - Searchable note list
  - Filter by tags, type, visibility
  - Full-text search (client-side)
  - Note preview cards

#### Epic 4.2: Journal System
**Tasks**:
- **TASK-031**: Journal data model and services
  - `useJournals` hook
  - Journal entry CRUD
  - In-game date tracking

- **TASK-032**: Journal UI
  - `Journal.tsx` - Journal viewer
  - `JournalEntryEditor.tsx` - Entry form
  - Timeline view (chronological)
  - Mood tracker visualization

- **TASK-033**: Session journal integration
  - Auto-create journal entry from session
  - Link journal entries to sessions
  - Generate session recap

#### Epic 4.3: Lore Encyclopedia
**Tasks**:
- **TASK-034**: Lore entry data model and services
  - `useLoreEntries` hook
  - Category management
  - Visibility control (DM vs players)

- **TASK-035**: Lore wiki UI
  - `LoreWiki.tsx` - Wiki-style navigation
  - `LoreEditor.tsx` - Lore entry form
  - Category tree sidebar
  - Cross-reference linking

- **TASK-036**: Lore revelation tracking
  - Mark lore as revealed in session
  - Player-visible lore view (future: player portal)
  - Lore timeline (when revealed)

**Deliverables**:
- Rich note-taking system with entity linking
- Personal journals with timeline view
- Lore encyclopedia with categories
- Visibility controls for DM vs player content

---

### Phase 5: AI-Assisted Tools (DEFERRED - API Costs)

**Status**: ❌ **NOT IMPLEMENTED** - Deferred to avoid OpenAI API costs

#### Epic 5.1: AI Integration (Future Enhancement)

**Note**: These features are **NOT** part of the initial implementation. TODO notes will be left in the codebase for future development.

**Tasks**:
- **TASK-037**: ❌ Quest generator (DEFERRED)
  - **TODO**: Implement quest generation API endpoint in doc-api
  - **TODO**: Create QuestGenerator.tsx component
  - **TODO**: Add quest form with campaign context parameters
  - **TODO**: Save generated quest as note/session
  - **Estimated Cost**: ~$0.01-0.05 per generation (GPT-4o-mini)

- **TASK-038**: ❌ NPC personality generator (DEFERRED)
  - **TODO**: Create personality generation endpoint
  - **TODO**: Build NPCPersonalityGenerator.tsx component
  - **TODO**: Generate dialogue suggestions based on context
  - **TODO**: Secret/motivation generation
  - **Estimated Cost**: ~$0.01-0.03 per NPC (GPT-4o-mini)

- **TASK-039**: ❌ Description enhancer (DEFERRED)
  - **TODO**: Implement description enhancement API
  - **TODO**: Add DescriptionEnhancer.tsx component to note editor
  - **TODO**: Support multiple styles (gothic, high fantasy, gritty, whimsical)
  - **TODO**: Add sensory detail generation
  - **Estimated Cost**: ~$0.005-0.02 per enhancement (GPT-4o-mini)

- **TASK-040**: ❌ Session recap generator (DEFERRED)
  - **TODO**: Create recap generation endpoint
  - **TODO**: Build SessionRecapGenerator.tsx component
  - **TODO**: Extract key events from session notes
  - **TODO**: Generate player-specific recaps
  - **Estimated Cost**: ~$0.02-0.10 per session (GPT-4o-mini)

**Alternative Future Implementations**:
1. **Self-hosted LLM**: Use local models (Ollama, llama.cpp) to avoid API costs
2. **Browser-based AI**: Use WebLLM or Transformers.js for client-side generation
3. **Community Templates**: Crowd-sourced templates instead of AI generation
4. **Pay-per-use**: Optional feature with user-provided API keys

**Deliverables**: None (deferred)

---

### Phase 6: Polish, UX, and Advanced Features (Weeks 14-16)

#### Epic 6.1: Search and Discovery
**Tasks**:
- **TASK-041**: Global search
  - Client-side full-text search (Fuse.js)
  - Search across all campaign entities
  - Search results with entity type badges
  - Quick navigation to results

- **TASK-042**: Smart suggestions
  - Recently viewed entities
  - Related NPCs/locations
  - Unused encounters/notes
  - Session planning suggestions

#### Epic 6.2: Data Visualization and Analytics
**Tasks**:
- **TASK-043**: Campaign dashboard
  - Active plot threads widget
  - Recent sessions widget
  - NPC interaction heatmap
  - Session frequency chart

- **TASK-044**: Statistics and insights
  - Total sessions/NPCs/notes count
  - Most interacted NPCs
  - Unresolved plot threads
  - Campaign timeline visualization

#### Epic 6.3: UX Polish
**Tasks**:
- **TASK-045**: Keyboard shortcuts
  - Quick actions (Cmd+K command palette)
  - Navigation shortcuts
  - Editor shortcuts

- **TASK-046**: Dark mode
  - Theme toggle
  - Persist theme preference in localStorage
  - Update all components for dark mode

- **TASK-047**: Mobile optimization
  - Responsive layouts for all components
  - Touch-friendly interactions
  - Offline indicator
  - Mobile navigation menu

- **TASK-048**: Onboarding and help
  - First-time user tutorial
  - Tooltips for complex features
  - Help documentation
  - Sample campaign template

#### Epic 6.4: Advanced Export/Import
**Tasks**:
- **TASK-049**: Selective export
  - Export specific sessions/NPCs/notes
  - Filter export by date range
  - Export to multiple formats (JSON, Markdown, PDF)

- **TASK-050**: Backup automation
  - Auto-export to browser downloads folder
  - Scheduled backups (weekly, monthly)
  - Backup history management

- **TASK-051**: Campaign templates
  - Export campaign as template (strip IDs, dates)
  - Template library (starter campaigns)
  - Import template with new IDs

**Deliverables**:
- Global search across all entities
- Campaign dashboard with analytics
- Full dark mode support
- Mobile-optimized UI
- Advanced export/import features

---

## Optional: Phase 7 - Cloud Sync and Multi-Device Support (Future)

**Goal**: Enable campaign sync across devices and optional cloud backup

### Tasks:
- **TASK-052**: Sync service backend
  - New service: `campaign-sync-api` (port 3004)
  - User authentication (JWT)
  - Store campaigns in PostgreSQL
  - Sync endpoints (push, pull, conflicts)

- **TASK-053**: Conflict resolution
  - Last-write-wins strategy
  - Manual merge UI for conflicts
  - Sync status indicators

- **TASK-054**: Offline-first sync
  - Queue sync operations when offline
  - Background sync worker
  - Sync logs and history

**Note**: This phase requires significant backend work and is not part of the initial client-side first approach. Can be added later based on user demand.

---

## File Structure

```
services/dm-ui/
├── public/
│   ├── favicon.ico
│   └── assets/
├── src/
│   ├── main.tsx                      # Entry point
│   ├── App.tsx                       # Root component with routing
│   ├── db/
│   │   ├── schema.ts                 # Dexie database schema
│   │   └── migrations.ts             # Database migrations
│   ├── stores/
│   │   ├── campaignStore.ts          # Zustand store for active campaign
│   │   ├── uiStore.ts                # UI state (sidebar, modals, etc.)
│   │   └── settingsStore.ts          # User settings
│   ├── hooks/
│   │   ├── useCampaigns.ts
│   │   ├── useWorlds.ts
│   │   ├── useSessions.ts
│   │   ├── usePlotThreads.ts
│   │   ├── useNPCs.ts
│   │   ├── useEncounters.ts
│   │   ├── useNotes.ts
│   │   ├── useCodexDocuments.ts      # TanStack Query for doc-api
│   │   └── useCodexLinks.ts
│   ├── services/
│   │   ├── export.service.ts         # Export/import logic
│   │   ├── search.service.ts         # Client-side search (Fuse.js)
│   │   └── codex-api.ts              # doc-api client
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileMenu.tsx
│   │   ├── campaign/
│   │   │   ├── CampaignDashboard.tsx
│   │   │   ├── CampaignForm.tsx
│   │   │   ├── CampaignDetails.tsx
│   │   │   └── CampaignSelector.tsx
│   │   ├── world/
│   │   │   ├── WorldBuilder.tsx
│   │   │   ├── WorldTree.tsx
│   │   │   ├── WorldDetails.tsx
│   │   │   └── MapViewer.tsx
│   │   ├── session/
│   │   │   ├── SessionPlanner.tsx
│   │   │   ├── SessionCalendar.tsx
│   │   │   ├── SessionDetails.tsx
│   │   │   ├── SessionRunner.tsx
│   │   │   └── SessionNotes.tsx
│   │   ├── plot/
│   │   │   ├── PlotTracker.tsx
│   │   │   ├── PlotGraph.tsx
│   │   │   ├── PlotTimeline.tsx
│   │   │   └── ClueManager.tsx
│   │   ├── npc/
│   │   │   ├── NPCManager.tsx
│   │   │   ├── NPCCard.tsx
│   │   │   ├── NPCEditor.tsx
│   │   │   └── RelationshipGraph.tsx
│   │   ├── encounter/
│   │   │   ├── EncounterBuilder.tsx
│   │   │   ├── MonsterSelector.tsx
│   │   │   └── DifficultyCalculator.tsx
│   │   ├── note/
│   │   │   ├── NoteBrowser.tsx
│   │   │   ├── NoteEditor.tsx
│   │   │   └── NoteCard.tsx
│   │   ├── journal/
│   │   │   ├── Journal.tsx
│   │   │   ├── JournalEntryEditor.tsx
│   │   │   └── JournalTimeline.tsx
│   │   ├── lore/
│   │   │   ├── LoreWiki.tsx
│   │   │   ├── LoreEditor.tsx
│   │   │   └── LoreCategoryTree.tsx
│   │   ├── codex/
│   │   │   ├── CodexBrowser.tsx
│   │   │   ├── CodexSearch.tsx
│   │   │   ├── DocumentPreview.tsx
│   │   │   └── LinkedDocuments.tsx
│   │   ├── export/
│   │   │   ├── ExportModal.tsx
│   │   │   ├── ImportModal.tsx
│   │   │   └── ImportPreview.tsx
│   │   ├── search/
│   │   │   ├── GlobalSearch.tsx
│   │   │   └── CommandPalette.tsx
│   │   └── ui/                       # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── tabs.tsx
│   │       └── ...
│   ├── pages/
│   │   ├── HomePage.tsx              # Campaign dashboard
│   │   ├── CampaignPage.tsx          # Single campaign view
│   │   ├── WorldPage.tsx             # World builder
│   │   ├── SessionsPage.tsx          # Session planner
│   │   ├── PlotsPage.tsx             # Plot tracker
│   │   ├── NPCsPage.tsx              # NPC manager
│   │   ├── EncountersPage.tsx        # Encounter builder
│   │   ├── NotesPage.tsx             # Notes browser
│   │   ├── JournalsPage.tsx          # Journal viewer
│   │   ├── LorePage.tsx              # Lore wiki
│   │   └── CodexPage.tsx             # Codex browser
│   ├── types/
│   │   ├── campaign.ts
│   │   ├── world.ts
│   │   ├── session.ts
│   │   ├── plot.ts
│   │   ├── npc.ts
│   │   ├── encounter.ts
│   │   ├── note.ts
│   │   ├── journal.ts
│   │   ├── lore.ts
│   │   ├── export.ts
│   │   └── codex.ts
│   ├── lib/
│   │   ├── utils.ts                  # Utility functions
│   │   └── cn.ts                     # Tailwind class merger
│   └── styles/
│       └── globals.css               # Tailwind imports
├── Dockerfile                        # Multi-stage build (Vite + nginx)
├── docker-compose.override.yml       # Add dm-ui service
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Docker Configuration

### Update `docker-compose.yml`

```yaml
services:
  # ... existing services (postgres, redis, elasticsearch, minio, doc-api, doc-processor, doc-websocket, admin-ui)

  dm-ui:
    build:
      context: ./services/dm-ui
      dockerfile: Dockerfile
    container_name: nexuscodex-dm-ui
    ports:
      - "3003:80"
    environment:
      - VITE_DOC_API_URL=http://localhost:3000
      - VITE_WEBSOCKET_URL=ws://localhost:3002
    depends_on:
      - doc-api
    networks:
      - nexuscodex
    restart: unless-stopped
```

### Dockerfile for `dm-ui`

```dockerfile
# services/dm-ui/Dockerfile

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf for SPA routing

```nginx
# services/dm-ui/nginx.conf

server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://doc-api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "dexie": "^4.0.1",
    "dexie-react-hooks": "^1.1.7",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.28.0",
    "zod": "^3.22.4",
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.3.4",
    "lexical": "^0.13.0",
    "@lexical/react": "^0.13.0",
    "d3": "^7.9.0",
    "@types/d3": "^7.4.3",
    "fuse.js": "^7.0.0",
    "date-fns": "^3.3.1",
    "react-big-calendar": "^1.11.0",
    "react-arborist": "^3.4.0",
    "react-zoom-pan-pinch": "^3.4.4",
    "file-saver": "^2.0.5",
    "@types/file-saver": "^2.0.7",
    "nanoid": "^5.0.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^7.0.0",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "eslint": "^8.56.0",
    "prettier": "^3.2.5"
  }
}
```

---

## Implementation Checklist

### Phase 1 (Weeks 1-3): Foundation
- [ ] Set up `services/dm-ui` with Vite + React + TypeScript
- [ ] Add to `docker-compose.yml` on port 3003
- [ ] Implement Dexie.js database schema
- [ ] Create base layout (navbar, sidebar, routing)
- [ ] Campaign CRUD (create, list, view, edit, archive)
- [ ] Codex browser with search (TanStack Query + doc-api)
- [ ] Codex linking to entities (NPCs, encounters, notes)
- [ ] Export campaign to JSON
- [ ] Import campaign from JSON (with conflict resolution)
- [ ] Test offline functionality (IndexedDB persistence)

### Phase 2 (Weeks 4-6): World & Sessions
- [ ] World builder with hierarchical tree
- [ ] Map upload and viewer (pan/zoom)
- [ ] Session planner with calendar view
- [ ] Session details form (title, date, notes)
- [ ] Session runner (in-progress session view)
- [ ] Rich text editor (Lexical) for session notes
- [ ] Auto-save notes to IndexedDB

### Phase 3 (Weeks 7-10): Story Tools
- [ ] Plot thread tracker with status management
- [ ] Plot graph visualization (D3.js)
- [ ] Clue manager (discovered/undiscovered)
- [ ] NPC manager with card grid
- [ ] NPC editor (detailed form)
- [ ] NPC relationship graph (D3.js)
- [ ] Link NPCs to codex stat blocks
- [ ] Encounter builder with monster selector
- [ ] Encounter difficulty calculator (D&D 5e CR)

### Phase 4 (Weeks 11-13): Notes & Journals
- [ ] Note editor with Lexical
- [ ] Note browser with search/filter
- [ ] Entity linking in notes (NPCs, locations, documents)
- [ ] Journal system with entries
- [ ] Journal timeline view
- [ ] Lore encyclopedia with categories
- [ ] Lore wiki navigation
- [ ] Visibility controls (DM vs player)

### Phase 5 (Weeks 14-15): AI Tools (DEFERRED ❌)
- [ ] ~~Quest generator~~ (DEFERRED - API costs)
- [ ] ~~NPC personality generator~~ (DEFERRED - API costs)
- [ ] ~~Description enhancer~~ (DEFERRED - API costs)
- [ ] ~~Session recap generator~~ (DEFERRED - API costs)
- [ ] Add TODO comments in codebase for future AI integration

### Phase 6 (Weeks 14-16): Polish & Advanced Features
- [ ] Global search (Fuse.js client-side)
- [ ] Command palette (Cmd+K shortcuts)
- [ ] Campaign dashboard with analytics
- [ ] Dark mode support
- [ ] Mobile responsive design
- [ ] Onboarding tutorial
- [ ] Selective export (sessions, NPCs, notes)
- [ ] Auto-backup to downloads folder
- [ ] Campaign templates

---

## Success Metrics

1. **Offline Capability**: 100% of campaign planning works offline (no doc-api required)
2. **Export/Import**: All campaign data exportable as JSON with no data loss
3. **Codex Integration**: Seamless linking to codex documents with offline caching
4. **Performance**: IndexedDB operations < 100ms for typical datasets (< 1000 entities)
5. **Mobile Support**: Responsive design works on tablets and phones
6. **Data Safety**: No data loss on browser crash or refresh (auto-save every 5 seconds)

---

## Future Enhancements (Post-Launch)

1. **Cloud Sync Service** (Phase 7)
   - Multi-device sync
   - Conflict resolution
   - Cloud backup

2. **Player Portal** (Phase 8)
   - Player-facing UI for viewing public campaign content
   - Character journals
   - Session recaps

3. **VTT Integration** (Phase 9)
   - Foundry VTT module
   - Roll20 integration
   - Real-time encounter sync

4. **Collaboration Features** (Phase 10)
   - Multi-DM campaigns (co-DMs)
   - Real-time note sharing
   - Session notes collaboration

5. **Advanced AI Features** (Phase 11)
   - Voice-to-text session notes
   - AI-generated maps
   - NPC voice synthesis
   - Plot recommendation engine

---

## Migration from Admin UI

**Important**: The DM UI is a **separate service** from the admin UI. They serve different purposes:

- **Admin UI** (port 3001): System administration, document processing, queue management, user management
- **DM UI** (port 3003): Campaign planning, note-taking, codex browsing (for DMs running campaigns)

**No migration needed** - they coexist. DMs will use the DM UI for campaign planning and occasionally use the Admin UI for document uploads/management.

---

## Design Decisions (Finalized)

1. ✅ **AI Features**: DEFERRED (no API costs) - TODO notes for future implementation
2. ✅ **Authentication**: Single-user, local IndexedDB only (no accounts, no login)
3. ✅ **Player Portal**: DEFERRED to Phase 7 (post-launch) - focus on DM UI first
4. ✅ **Backend Changes**: Minimal - read-only access to existing doc-api endpoints only
5. ✅ **Mobile Priority**: Phase 6 (weeks 14-16) - desktop/tablet optimized first, mobile polish later

---

This plan provides a **complete roadmap** for building a DM-focused campaign planning UI with:
- ✅ Client-side IndexedDB storage (100% offline)
- ✅ Codex integration (read-only doc-api access)
- ✅ Export/import as JSON
- ✅ Rich note-taking with Lexical
- ✅ Modern React + TypeScript + Tailwind stack
- ✅ **16-week implementation timeline** (AI features deferred)
- ✅ Detailed task breakdown (50 tasks: 36 active, 4 deferred AI tasks, 10 polish tasks)
- ❌ AI-assisted tools deferred (no API costs) - TODO notes for future implementation

**Alternative AI Options for Future**:
- Self-hosted LLM (Ollama, llama.cpp) - no API costs
- Browser-based WebLLM or Transformers.js - client-side only
- Community templates - crowd-sourced content
- User-provided API keys - pay-per-use model

Let me know if you'd like me to start implementing Phase 1!

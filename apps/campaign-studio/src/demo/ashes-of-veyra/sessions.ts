import { clues } from './clues';
import { encounters } from './encounters';
import { handouts } from './handouts';
import { npcs } from './npcs';
import { quests } from './quests';
import type { CampaignSession, SessionPlan } from './types';

const sessionRecords: Omit<
  CampaignSession,
  | 'id'
  | 'campaignId'
  | 'actId'
  | 'number'
  | 'partyLevel'
  | 'tags'
  | 'questIds'
  | 'npcIds'
  | 'factionIds'
  | 'locationIds'
  | 'encounterIds'
  | 'clueIds'
  | 'handoutIds'
>[] = [
  {
    title: 'Wreck on the Black Shoals',
    status: 'complete',
    summary:
      'The Northstar breaks apart on the Black Shoals. The party drags four survivors to a reef, fights off wreck-scavengers, and recovers an ember-marked crate from the flooded hold. The captain log hints the ship was never meant to arrive, and something hums inside the crate.',
    durationHours: 4,
  },
  {
    title: 'The Lantern Road',
    status: 'complete',
    summary:
      'The party escorts the refugees along the cliff-top Lantern Road to a Guild waystation. They meet Neris Quill, who recognizes the ember mark on the crate and offers the first ward sketches in return for a promise to share what they learn.',
    durationHours: 4,
  },
  {
    title: 'Salt in the Wound',
    status: 'complete',
    summary:
      'Sahuagin tracks around the wreck reveal organized activity, not random predation. A tense parley with a sahuagin priestess ends without bloodshed, and the party learns of a "door below" the sahuagin guard against another group.',
    durationHours: 4,
  },
  {
    title: 'The Fractured Spire',
    status: 'complete',
    summary:
      'Lira leads the party into a cracked observatory whose great lens has vanished. They survive the guardian wards, find a keeper journal page, and trace a ward line that points toward Glass Harbor. A broken compass starts pointing at the spire.',
    durationHours: 5,
  },
  {
    title: 'A Debt in Blood',
    status: 'complete',
    summary:
      "Mira's family debt surfaces when Selka Marr travels down the coast to meet the party at a smugglers' landing. The Crimson Wake does not ask for coin; it hands over a red glass token and a note that the favor is a person. Mira leaves the table shaken and silent.",
    durationHours: 4,
  },
  {
    title: 'Bells Beneath the Tide',
    status: 'complete',
    summary:
      'A coastal ferry crosses the shoals at dusk. Old Mara Venn recites a children song as the party hears the drowned choir for the first time, and Torin collapses with a vision of a flooded court. A child speaks in a woman voice and says "the door will answer."',
    durationHours: 4,
  },
  {
    title: 'Passage to Veyra',
    status: 'complete',
    summary:
      "With Neris's writ, the party secures a berth on a harbor packet, hides the crate in a ballast barrel, and arrives under an overcast sky. Kael recognizes the harbor chain and the face of the old Watch sergeant standing on the quay.",
    durationHours: 4,
  },
  {
    title: 'City of Glass and Salt',
    status: 'complete',
    summary:
      'The party learns the shape of Glass Harbor: the Watch holds the chain, the Concord holds the debts, the Synod holds the dead, and the Wake holds the dark. Captain Serin offers an audience, Kael confronts the order that dismissed him, and the harbor ward sketches begin to match.',
    durationHours: 5,
  },
  {
    title: 'The Salty Mast',
    status: 'complete',
    summary:
      'Mara Venn offers the party a hot meal and a back room. Selka Marr offers information for a favor, and a drowned cellar beneath the tavern nearly drowns the rogue. Pell Thistlewick becomes the party first street informant.',
    durationHours: 4,
  },
  {
    title: 'Customs and Contraband',
    status: 'complete',
    summary:
      'A false manifest connects the Ashen Synod to missing cargo. The party audiences Prelate Voss, meets Magister Brask, and finds the forged endorsement on an entry writ in ash-ink. Sergeant Corr bends the rules once at a checkpoint.',
    durationHours: 5,
  },
  {
    title: "Smoke over Fishmongers' Row",
    status: 'complete',
    summary:
      'The party prevents an arson on Fishmongers Row and recovers the burned shipping ledger, naming the Dawn Petrel and pier 6. Brother Tamsin slips a confession under their door, and Captain Serin asks for silence about what the ledger implies.',
    durationHours: 5,
  },
  {
    title: 'The Glass Harbor',
    status: 'draft',
    summary:
      'Follow Captain Serin warning to the eastern pier as rival crews move to seize the ledger. The party must decide whom to trust, survive the Crimson Wake ambush, and decide what to do when a bell sounds beneath the harbor at low tide.',
    plannedDate: '2025-04-26',
    durationHours: 4,
  },
  {
    title: 'Under the Customs House',
    status: 'planned',
    summary:
      'Explore the flooded tunnel and recover the Ember Key. The Synod, the Wake and the Watch converge on the Customs House at low tide, and the Choir Below has been waiting for someone to answer the bell.',
    durationHours: 5,
  },
];

export const session12Plan: SessionPlan = {
  revision: 3,
  lastEdited: '2 hours ago',
  estimatedMinutes: 235,
  readiness: [
    {
      id: 'readiness-opening-recap',
      label: 'Opening recap ready',
      complete: true,
    },
    {
      id: 'readiness-scene',
      label: 'Glass Harbor Docks scene linked',
      complete: true,
    },
    {
      id: 'readiness-warning',
      label: "Harbormaster's Warning attached",
      complete: true,
    },
    {
      id: 'readiness-encounter',
      label: 'Dockside Ambush reviewed',
      complete: true,
    },
    {
      id: 'readiness-player-summary',
      label: 'Player-facing summary written',
      complete: false,
    },
    { id: 'readiness-closing', label: 'Closing beat checked', complete: false },
  ],
  dependencies: [
    { objectId: 'scene-glass-harbor-docks', status: 'ready' },
    { objectId: 'encounter-dockside-ambush', status: 'ready' },
    { objectId: 'handout-burned-shipping-ledger', status: 'needs-review' },
  ],
  steps: [
    {
      id: 'step-opening-recap',
      order: 1,
      kind: 'recap',
      track: 'main',
      title: 'Opening recap',
      durationMinutes: 10,
      visibility: 'shared',
      body: "Re-establish the burned ledger, Serin's quiet request, and the pressure each faction is putting on the party.",
    },
    {
      id: 'step-glass-harbor-docks',
      order: 2,
      kind: 'scene',
      track: 'main',
      title: 'Activate scene: Glass Harbor Docks',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'scene-glass-harbor-docks',
      body: 'Evening at the eastern pier. Light rain beads on the ropes; the Watch is changing shifts.',
    },
    {
      id: 'step-harbormaster-warning',
      order: 3,
      kind: 'note',
      track: 'main',
      title: "Open note: Harbormaster's Warning",
      durationMinutes: 10,
      visibility: 'shared',
      objectId: 'handout-harbormasters-warning',
      body: 'Captain Serin asks the party to watch the eastern pier without involving the Watch. Typed reference: @Captain Serin is worried Warden Rook will erase the manifest.',
    },
    {
      id: 'step-dockside-ambush',
      order: 4,
      kind: 'encounter',
      track: 'main',
      title: 'Deploy encounter: Dockside Ambush',
      durationMinutes: 30,
      visibility: 'dm-only',
      objectId: 'encounter-dockside-ambush',
      body: 'The attackers want the ledger. One bandit tries to take the satchel while the others create an escape lane; they do not fight to the death unless cornered.',
    },
    {
      id: 'step-burned-ledger',
      order: 5,
      kind: 'handout',
      track: 'main',
      title: 'Share handout: Burned Shipping Ledger',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'handout-burned-shipping-ledger',
      body: 'Reveal the Dawn Petrel, pier 6, and the phrase "third bell" after the encounter.',
    },
    {
      id: 'step-fleeing-bandit-choice',
      order: 6,
      kind: 'choice',
      track: 'main',
      title: 'Optional: Follow the fleeing bandit or confront the Watch',
      durationMinutes: 20,
      visibility: 'dm-only',
      body: 'The party can pursue the courier along the chainwalk or hold position as the Watch patrol arrives.',
    },
    {
      id: 'step-bell-closing',
      order: 7,
      kind: 'closing',
      track: 'main',
      title: 'Closing beat: The bell below the harbor',
      durationMinutes: 5,
      visibility: 'shared',
      body: 'At low tide, a bell sounds beneath the harbor. The water in the mooring rings ripples inward.',
    },

    // ── PARALLEL THREADS ──────────────────────────────────────────────────────
    {
      id: 'step-quest-ember-key',
      order: 8,
      kind: 'note',
      track: 'parallel',
      title: 'Quest: Find the Ember Key',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'The Ember Key was last seen at customs. Multiple factions now know the party has a lead.',
    },
    {
      id: 'step-quest-mira-debt',
      order: 9,
      kind: 'note',
      track: 'parallel',
      title: "Quest: Mira's Debt to the Crimson Wake",
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'Resolution may span sessions. Note leverage the Crimson Wake applies if Mira acts openly.',
    },
    {
      id: 'step-handout-writ',
      order: 10,
      kind: 'handout',
      track: 'parallel',
      title: 'Port Authority Entry Writ',
      durationMinutes: 2,
      visibility: 'shared',
      objectId: 'handout-port-authority-writ',
      body: 'Surface when the party inspects the warehouse gate or asks a Watch officer for access.',
    },
    {
      id: 'step-handout-letter',
      order: 11,
      kind: 'handout',
      track: 'parallel',
      title: 'Mysterious Unsigned Letter (pier 6)',
      durationMinutes: 2,
      visibility: 'shared',
      objectId: 'handout-unsigned-letter-pier6',
      body: "Surface when pacing allows — preferably after the ambush to seed the 'third bell' thread.",
    },
    {
      id: 'step-decision-selka',
      order: 12,
      kind: 'recap',
      track: 'parallel',
      title: 'Decision: Trust Selka Marr or report to the Watch?',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'Selka will trade ledger insight for the Ember Key. Note the party instinct — no forced answer needed this session.',
    },
    {
      id: 'step-sahuagin-patrol',
      order: 13,
      kind: 'encounter',
      track: 'parallel',
      title: 'Optional: Sahuagin Patrol (eastern mooring)',
      durationMinutes: 20,
      visibility: 'dm-only',
      objectId: 'encounter-sahuagin-patrol',
      body: 'Deploy only if the party investigates the waterline before the ambush. Good pacing pivot if the ambush resolves quickly.',
    },
    {
      id: 'step-lore-bell-rhyme',
      order: 14,
      kind: 'handout',
      track: 'parallel',
      title: 'Lore: The Bell Rhyme of the Shoals',
      durationMinutes: 3,
      visibility: 'shared',
      objectId: 'lore-bell-rhyme-shoals',
      body: "Share if the party asks about the harbor bell sound at the closing beat. Seeds the Choir Below subplot for act 3.",
    },
  ],
  notes: [
    'Serin wants the cargo identified, not an arrest made in public.',
    'If the party takes the warehouse lead, let the Watch checkpoint become a negotiation rather than a forced combat.',
  ],
  playerFacingSummary:
    'A quiet favor from the Harbor Master puts you on the rain-slick eastern pier, where someone else is already looking for the burned ledger.',
  attachments: [
    'handout-harbormasters-warning',
    'handout-burned-shipping-ledger',
    'lore-bell-rhyme-shoals',
    'handout-port-authority-writ',
    'handout-unsigned-letter-pier6',
  ],
};

export const session13Plan: SessionPlan = {
  revision: 2,
  lastEdited: 'Yesterday',
  estimatedMinutes: 210,
  readiness: [
    { id: 'readiness-s13-recap', label: 'Recap of session 12 outcome', complete: false },
    {
      id: 'readiness-s13-scene',
      label: 'Flooded Undercroft scene built',
      complete: true,
    },
    {
      id: 'readiness-s13-tide',
      label: 'Tide clock handout printed',
      complete: true,
    },
    {
      id: 'readiness-s13-encounter',
      label: 'Flooded Undercroft encounter balanced',
      complete: false,
    },
    {
      id: 'readiness-s13-rook',
      label: "Rook's confrontation branches written",
      complete: false,
    },
    {
      id: 'readiness-s13-key',
      label: 'Ember Key reveal text reviewed',
      complete: false,
    },
  ],
  dependencies: [
    { objectId: 'encounter-flooded-undercroft', status: 'needs-review' },
    { objectId: 'encounter-rook-confrontation', status: 'needs-review' },
    { objectId: 'lore-azure-compact', status: 'ready' },
  ],
  steps: [
    {
      id: 'step-s13-recap',
      order: 1,
      kind: 'recap',
      track: 'main',
      title: 'Opening recap: the third bell',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'Review what happened at the eastern pier, who holds the ledger now, and what the bell beneath the harbor sounded like.',
    },
    {
      id: 'step-s13-gate',
      order: 2,
      kind: 'encounter',
      track: 'main',
      title: 'The record vault gate: Warden Rook',
      durationMinutes: 30,
      visibility: 'dm-only',
      objectId: 'encounter-rook-confrontation',
      body: 'The only dry way down is through the vault. Rook will talk, deflect, and offer Kael his old rank. If Corr sides with the party the guards stand down.',
    },
    {
      id: 'step-s13-scene',
      order: 3,
      kind: 'scene',
      track: 'main',
      title: 'Activate scene: Flooded Undercroft',
      durationMinutes: 5,
      visibility: 'shared',
      body: 'Low tide exposes a warded stair for exactly one hour. Cold air, black water, and the sound of a distant bell struck on a long interval.',
    },
    {
      id: 'step-s13-descent',
      order: 4,
      kind: 'note',
      track: 'main',
      title: 'Descent and the tide clock',
      durationMinutes: 20,
      visibility: 'dm-only',
      body: 'Track the tide in 10-minute increments. Torin hears the Tidewife with each strike; give him a vision at the second landing.',
    },
    {
      id: 'step-s13-undercroft',
      order: 5,
      kind: 'encounter',
      track: 'main',
      title: 'Deploy encounter: The Flooded Undercroft',
      durationMinutes: 70,
      visibility: 'dm-only',
      objectId: 'encounter-flooded-undercroft',
      body: 'Zombies hold the landings while the flood rises. The specter withdraws if Torin speaks the right bell-name. Synod agents are trapped in the lower archive.',
    },
    {
      id: 'step-s13-choice',
      order: 6,
      kind: 'choice',
      track: 'main',
      title: 'Take the key or save the trapped Synod agents',
      durationMinutes: 30,
      visibility: 'shared',
      body: 'The reliquary can be secured at once, but doing so closes the only dry route to the wounded rivals. Do not hint at a right answer.',
    },
    {
      id: 'step-s13-compact',
      order: 7,
      kind: 'handout',
      track: 'main',
      title: 'Share lore: The Azure Compact (article nine)',
      durationMinutes: 5,
      visibility: 'shared',
      objectId: 'lore-azure-compact',
      body: 'Lira reads the carved inscription beside the vault door and realizes the Compact was a lock, not a treaty.',
    },
    {
      id: 'step-s13-closing',
      order: 8,
      kind: 'closing',
      track: 'main',
      title: 'Closing beat: The Hollow Crown answers',
      durationMinutes: 10,
      visibility: 'shared',
      body: 'When the Ember Key reaches open air the bells beneath the bay answer in sequence. Cut to black on the fourth.',
    },
    {
      id: 'step-s13-quest-key',
      order: 9,
      kind: 'note',
      track: 'parallel',
      title: 'Quest: Find the Ember Key',
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'Mark the tunnel objective complete when the party enters the vault. The key objective stays open until they choose.',
    },
    {
      id: 'step-s13-quest-kael',
      order: 10,
      kind: 'note',
      track: 'parallel',
      title: "Quest: Clear Kael's Name",
      durationMinutes: 0,
      visibility: 'dm-only',
      body: 'If the party has the ash-ink evidence and Corr beside them, Rook cannot hold the Watch. Otherwise Kael is offered a quiet pardon.',
    },
    {
      id: 'step-s13-patrol',
      order: 11,
      kind: 'encounter',
      track: 'parallel',
      title: 'Optional: Sahuagin Patrol at the arch',
      durationMinutes: 20,
      visibility: 'dm-only',
      objectId: 'encounter-sahuagin-patrol',
      body: 'Use only if the party approaches by water. The baron sends a patrol to watch, not to fight.',
    },
    {
      id: 'step-s13-tamsin',
      order: 12,
      kind: 'handout',
      track: 'parallel',
      title: "Brother Tamsin's Confession",
      durationMinutes: 2,
      visibility: 'shared',
      objectId: 'handout-tamsin-confession',
      body: 'Resurface if the party brings Tamsin to the vault or asks where the Synod forgeries were made.',
    },
    {
      id: 'step-s13-rhyme',
      order: 13,
      kind: 'handout',
      track: 'parallel',
      title: 'Lore: The Bell-Rhyme of the Shoals',
      durationMinutes: 3,
      visibility: 'shared',
      objectId: 'lore-bell-rhyme-shoals',
      body: 'Share when Torin counts the bell strikes; the fourth beat is when the harbor answers.',
    },
  ],
  notes: [
    'Success is measured by choices, not a clean fight. The flood is the main antagonist.',
    "If session 12 ends with the ledger lost, Pell can supply the Dawn Petrel crew roll to keep the tunnel lead alive.",
    'Prepare a fallback: if the party skips Rook, the Synod bribes a clerk to open the stair.',
  ],
  playerFacingSummary:
    'At the lowest tide of the month a hidden stair opens beneath the Customs House, and someone has already gone down ahead of you.',
  attachments: [
    'lore-azure-compact',
    'lore-bell-rhyme-shoals',
    'handout-tamsin-confession',
    'handout-harbor-map-legend',
  ],
};

/**
 * Locations each completed session actually visited. Links to quests,
 * NPCs, encounters, clues and handouts are derived from those records so the
 * session history cannot drift from the collections.
 */
const visitedLocations: Record<number, string[]> = {
  1: ['location-black-shoals'],
  2: ['location-lantern-waystation', 'location-veyra-coast'],
  3: ['location-black-shoals'],
  4: ['location-fractured-spire'],
  5: ['location-veyra-coast'],
  6: ['location-veyra-coast', 'location-black-shoals'],
  7: ['location-veyra-coast', 'location-glass-harbor'],
  8: [
    'location-glass-harbor',
    'location-old-customs-house',
    'location-counting-hall',
  ],
  9: ['location-salty-mast', 'location-north-docks'],
  10: [
    'location-old-customs-house',
    'location-synod-relief-house',
    'location-counting-hall',
    'location-harbor-warehouse',
  ],
  11: ['location-fishmongers-row', 'location-salty-mast'],
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function deriveSessionLinks(sessionId: string, number: number) {
  const inSession = <T extends { sessionIds: string[] }>(records: T[]): T[] =>
    records.filter((record) => record.sessionIds.includes(sessionId));
  const sessionQuests = inSession(quests);
  const sessionNpcs = inSession(npcs);
  const sessionEncounters = inSession(encounters);
  return {
    questIds: sessionQuests.map((quest) => quest.id),
    npcIds: sessionNpcs.map((npc) => npc.id),
    encounterIds: sessionEncounters.map((encounter) => encounter.id),
    clueIds: inSession(clues).map((clue) => clue.id),
    handoutIds: inSession(handouts).map((handout) => handout.id),
    factionIds: unique([
      ...sessionNpcs.flatMap((npc) => npc.factionIds),
      ...sessionEncounters.flatMap((encounter) => encounter.factionIds),
      ...sessionQuests.flatMap((quest) => quest.factionIds),
    ]),
    locationIds: visitedLocations[number] ?? [],
  };
}

type SessionLinks = ReturnType<typeof deriveSessionLinks>;

function mergeLinks(base: SessionLinks, extra: Partial<SessionLinks>): SessionLinks {
  return {
    questIds: unique([...(extra.questIds ?? []), ...base.questIds]),
    npcIds: unique([...(extra.npcIds ?? []), ...base.npcIds]),
    encounterIds: unique([...(extra.encounterIds ?? []), ...base.encounterIds]),
    clueIds: unique([...(extra.clueIds ?? []), ...base.clueIds]),
    handoutIds: unique([...(extra.handoutIds ?? []), ...base.handoutIds]),
    factionIds: unique([...(extra.factionIds ?? []), ...base.factionIds]),
    locationIds: unique([...(extra.locationIds ?? []), ...base.locationIds]),
  };
}

export const sessions: CampaignSession[] = sessionRecords.map(
  (record, index) => {
    const number = index + 1;
    const id = `session-${number}`;
    const actId =
      number <= 7
        ? 'act-fractured-tides'
        : number <= 13
          ? 'act-glass-harbor'
          : 'act-hollow-crown';
    const derived = deriveSessionLinks(id, number);
    const links =
      number === 12
        ? mergeLinks(derived, {
            questIds: ['quest-find-ember-key', 'quest-a-debt-in-blood'],
            npcIds: [
              'npc-captain-serin',
              'npc-selka-marr',
              'npc-oren-voss',
              'npc-elian-rook',
              'npc-mara-venn',
            ],
            factionIds: [
              'faction-harbor-watch',
              'faction-crimson-wake',
              'faction-ashen-synod',
              'faction-choir-below',
            ],
            locationIds: [
              'location-glass-harbor',
              'location-old-customs-house',
              'location-south-pier',
              'location-harbor-warehouse',
              'location-salty-mast',
            ],
            encounterIds: [
              'encounter-dockside-ambush',
              'encounter-sahuagin-patrol',
              'encounter-city-watch-checkpoint',
              'encounter-drowned-cellar',
            ],
            clueIds: [
              'clue-strange-symbol',
              'clue-smuggler-note',
              'clue-sahuagin-activity',
              'clue-broken-compass',
            ],
            handoutIds: [
              'handout-burned-shipping-ledger',
              'handout-harbormasters-warning',
              'lore-bell-rhyme-shoals',
            ],
          })
        : number === 13
          ? mergeLinks(derived, {
              questIds: [
                'quest-find-ember-key',
                'quest-whispers-beneath-veyra',
              ],
              npcIds: ['npc-captain-serin', 'npc-oren-voss', 'npc-elian-rook'],
              factionIds: [
                'faction-harbor-watch',
                'faction-ashen-synod',
                'faction-choir-below',
              ],
              locationIds: [
                'location-old-customs-house',
                'location-flooded-undercroft',
                'location-harbor-warehouse',
                'location-south-pier',
              ],
              encounterIds: [
                'encounter-sahuagin-patrol',
                'encounter-flooded-undercroft',
                'encounter-rook-confrontation',
              ],
              clueIds: ['clue-sahuagin-activity', 'clue-strange-symbol'],
              handoutIds: ['lore-azure-compact', 'lore-bell-rhyme-shoals'],
            })
          : derived;

    return {
      campaignId: 'campaign-ashes-of-veyra',
      actId,
      number,
      partyLevel: number <= 3 ? 3 : number <= 7 ? 4 : 5,
      tags:
        number === 12
          ? ['Urban', 'Intrigue', 'Combat']
          : number <= 7
            ? ['Coastal', 'Discovery']
            : ['Urban', 'Intrigue'],
      ...record,
      id,
      ...links,
      ...(number === 12 ? { plan: session12Plan } : {}),
      ...(number === 13 ? { plan: session13Plan } : {}),
    };
  },
);

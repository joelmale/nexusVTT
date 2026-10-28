import type { CampaignNpc } from './types';

export const npcs: CampaignNpc[] = [
  {
    id: 'npc-captain-serin',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Captain Serin Dhal',
    role: 'Harbor Master',
    ancestry: 'Human',
    factionIds: ['faction-harbor-watch'],
    motivation:
      'Keep trade moving while quietly exposing corruption in the customs office. Serin has kept a private second ledger for eleven years and cannot prove a word of it without a witness.',
    relationship:
      'Cautious ally; trusts the party with a quiet eastern-pier inquiry and has vouched for Kael to the council twice.',
    locationIds: ['location-old-customs-house', 'location-glass-harbor'],
    sessionIds: [
      'session-8',
      'session-10',
      'session-11',
      'session-12',
      'session-13',
    ],
    portraitFallback: 'CS',
    tags: ['Harbor Master', 'Cautious ally', 'Quest giver', 'Five backlinks'],
  },
  {
    id: 'npc-selka-marr',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Selka Marr',
    role: 'Crimson Wake broker',
    ancestry: 'Half-elf',
    factionIds: ['faction-crimson-wake'],
    motivation:
      "Control the Ember Key's sale without starting a faction war. Her own captains are restless, and a clean sale is the only thing that keeps her seat.",
    relationship:
      'Useful, untrusted contact; holds the terms of Mira Vale family debt and has hinted she will trade it for the key.',
    locationIds: ['location-salty-mast', 'location-north-docks'],
    sessionIds: ['session-5', 'session-9', 'session-12'],
    portraitFallback: 'SM',
    tags: ['Broker', 'Useful contact', 'Debt holder', 'Crimson Wake leader'],
  },
  {
    id: 'npc-oren-voss',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Prelate Oren Voss',
    role: 'Ashen Synod envoy',
    ancestry: 'Human',
    factionIds: ['faction-ashen-synod'],
    motivation:
      'Claim the Ember Key as a holy relic before it reaches the drowned vault. He sincerely believes the Hollow Crown can end a century of silence from the gods.',
    relationship:
      'Polite antagonist who frames every demand as an offer of help; sends Torin gifts of candles and sealed letters.',
    locationIds: [
      'location-old-customs-house',
      'location-glass-harbor',
      'location-synod-relief-house',
    ],
    sessionIds: ['session-8', 'session-10', 'session-12', 'session-13'],
    portraitFallback: 'OV',
    tags: ['Envoy', 'Polite antagonist', 'Synod', 'Zealot'],
  },
  {
    id: 'npc-neris-quill',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Neris Quill',
    role: 'Lantern Guild archivist',
    ancestry: 'Gnome',
    factionIds: ['faction-lantern-guild'],
    motivation:
      'Prove the drowned kingdom survived beneath Veyra and map its surviving wards. She lost a brother to the first survey dive.',
    relationship:
      'Research ally; shares findings when the party brings a verifiable lead. Wrote the party passage writ in session 7.',
    locationIds: [
      'location-north-docks',
      'location-fishmongers-row',
      'location-lantern-waystation',
      'location-fractured-spire',
    ],
    sessionIds: [
      'session-2',
      'session-4',
      'session-7',
      'session-8',
      'session-11',
    ],
    portraitFallback: 'NQ',
    tags: [
      'Archivist',
      'Research ally',
      'Drowned history',
      'Lantern Guild leader',
    ],
  },
  {
    id: 'npc-elian-rook',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Warden Elian Rook',
    role: 'Harbor Watch commander',
    ancestry: 'Human',
    factionIds: ['faction-harbor-watch'],
    motivation:
      'Restore order while keeping his part in the false manifests hidden. He tells himself the relics he sells fund the Watch widows.',
    relationship:
      'Secret antagonist; once Kael Ardyn superior in the Watch and the officer who signed his dismissal.',
    locationIds: [
      'location-old-customs-house',
      'location-south-pier',
      'location-harbor-warehouse',
    ],
    sessionIds: ['session-8', 'session-10', 'session-12', 'session-13'],
    portraitFallback: 'ER',
    tags: ['Commander', 'Secret antagonist', 'Former superior', 'Corrupt'],
  },
  {
    id: 'npc-mara-venn',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Old Mara Venn',
    role: 'Salty Mast proprietor',
    ancestry: 'Human',
    factionIds: [],
    motivation:
      'Protect dockworkers and collect every useful rumor before it reaches the street. She has heard the bells since she was a girl and has told no one.',
    relationship:
      'Friendly information source; quietly shelters people fleeing the Watch. Shared the coastal ferry with the party in session 6 and recited the Bell-Rhyme.',
    locationIds: ['location-salty-mast'],
    sessionIds: ['session-6', 'session-9', 'session-11', 'session-12'],
    portraitFallback: 'MV',
    tags: ['Proprietor', 'Information source', 'Dockside community'],
  },
  {
    id: 'npc-brother-tamsin',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Brother Tamsin Ose',
    role: 'Synod ash-reader and reluctant defector',
    ancestry: 'Half-elf',
    factionIds: ['faction-ashen-synod'],
    motivation:
      'Atone for the forged manifests he inked on Voss order, without being burned as a heretic for confessing them.',
    relationship:
      'Nervous informant; left a confession for the party in session 11 and now asks Torin for sanctuary.',
    locationIds: ['location-synod-relief-house', 'location-fishmongers-row'],
    sessionIds: ['session-10', 'session-11', 'session-12', 'session-13'],
    portraitFallback: 'TO',
    tags: ['Informant', 'Defector', 'Synod', 'Forger'],
  },
  {
    id: 'npc-hesper-dray',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Captain Hesper Dray',
    role: 'Master of the Dawn Petrel (missing)',
    ancestry: 'Dragonborn',
    factionIds: ['faction-crimson-wake'],
    motivation:
      'Survive long enough to testify. She delivered the ember crate believing it was kiln glass and fled when the hold began to hum.',
    relationship:
      'Hunted witness; the party has found her marks but not her. Rumored hiding among the tidal flats under the South Pier.',
    locationIds: ['location-north-docks', 'location-south-pier'],
    sessionIds: ['session-11', 'session-13'],
    portraitFallback: 'HD',
    tags: ['Witness', 'Missing', 'Dawn Petrel'],
  },
  {
    id: 'npc-inspector-vane',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Inspector Bram Vane',
    role: 'Port Authority inspector',
    ancestry: 'Dwarf',
    factionIds: ['faction-harbor-watch'],
    motivation:
      'Keep his pension and his name. His signature appears on the entry writ, and he has no memory of signing it.',
    relationship:
      'Bewildered bureaucrat; the forged endorsement on the Port Authority writ is his, which makes him the quickest proof of tampering.',
    locationIds: ['location-old-customs-house'],
    sessionIds: ['session-8', 'session-10'],
    portraitFallback: 'BV',
    tags: ['Inspector', 'Forgery victim', 'Customs'],
  },
  {
    id: 'npc-kestrel-ruhn',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Kestrel Ruhn',
    role: 'Crimson Wake lieutenant',
    ancestry: 'Tiefling',
    factionIds: ['faction-crimson-wake'],
    motivation:
      'Prove Selka is too cautious and take the key by force. Believes a bold seizure will make him the next broker.',
    relationship:
      'Rival of Selka and active threat to the party; leads the crew in the Dockside Ambush and will not follow a negotiated peace.',
    locationIds: ['location-north-docks', 'location-harbor-warehouse'],
    sessionIds: ['session-9', 'session-12'],
    portraitFallback: 'KR',
    tags: ['Lieutenant', 'Hothead', 'Ambush leader'],
  },
  {
    id: 'npc-ysolde-marrow',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Ysolde Marrow, the Tidewife',
    role: 'Voice of the Choir Below',
    ancestry: 'Human',
    factionIds: ['faction-choir-below'],
    motivation:
      'Open the sealed vault so the drowned court can speak again. She no longer remembers whether the voices asked her to, or she asked them.',
    relationship:
      'Distant threat; spoke through a child in session 6 and is the unseen hand behind the drowned cellar. Shares a dream-link with Torin.',
    locationIds: ['location-flooded-undercroft', 'location-black-shoals'],
    sessionIds: ['session-6', 'session-13'],
    portraitFallback: 'YM',
    tags: ['Cult leader', 'Drowned-touched', 'Dream link'],
  },
  {
    id: 'npc-dagan-corr',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Sergeant Dagan Corr',
    role: 'Harbor Watch sergeant',
    ancestry: 'Half-orc',
    factionIds: ['faction-harbor-watch'],
    motivation:
      'Do the job honestly and protect the patrol under him. He never believed Kael was guilty and has been waiting for a reason to say so.',
    relationship:
      "Kael's old squadmate, now running the inner-ward checkpoint; will bend the rules once, and only once, for a friend.",
    locationIds: ['location-fishmongers-row', 'location-old-customs-house'],
    sessionIds: ['session-8', 'session-10', 'session-12', 'session-13'],
    portraitFallback: 'DC',
    tags: ['Sergeant', 'Kael friend', 'Honest guard'],
  },
  {
    id: 'npc-pell-thistlewick',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Pell Thistlewick',
    role: 'Fishmongers Row runner',
    ancestry: 'Halfling',
    factionIds: [],
    motivation:
      'Earn enough coin to buy back the family stall that burned and keep the older runners from selling him out.',
    relationship:
      'Eager informant who sells everything he sees; saw who lit the row fire and will name them for a hot meal.',
    locationIds: ['location-fishmongers-row', 'location-salty-mast'],
    sessionIds: ['session-9', 'session-11', 'session-13'],
    portraitFallback: 'PT',
    tags: ['Street runner', 'Witness', 'Comic relief'],
  },
  {
    id: 'npc-halden-brask',
    campaignId: 'campaign-ashes-of-veyra',
    name: 'Magister Halden Brask',
    role: 'Gilded Concord magister',
    ancestry: 'Human',
    factionIds: ['faction-gilded-concord'],
    motivation:
      'Secure salvage rights to the drowned royal quarter under the Azure Compact before anyone else reads the fine print.',
    relationship:
      'Courteous power broker; offers the party a charter and a seat at the table if they hand over copies of every record they find.',
    locationIds: ['location-counting-hall', 'location-glass-harbor'],
    sessionIds: ['session-8', 'session-10', 'session-13'],
    portraitFallback: 'HB',
    tags: ['Magister', 'Power broker', 'Concord leader'],
  },
];

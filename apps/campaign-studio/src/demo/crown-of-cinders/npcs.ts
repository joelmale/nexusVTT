import type { CampaignNpc } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID, crownSessionId } from './campaign';

export const crownNpcs: CampaignNpc[] = [
  {
    id: 'npc-corvin-vell',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Prince Corvin Vell',
    role: 'Eldest heir, Lord Marshal of the Realm',
    ancestry: 'Human',
    factionIds: ['faction-house-vell', 'faction-ember-wardens'],
    motivation:
      'Hold the realm together by force before the border lords sense weakness.',
    relationship:
      'Blunt and likable; assumes the party will follow the strongest claimant.',
    locationIds: ['location-hall-of-nine-banners', 'location-ember-cloister'],
    sessionIds: [crownSessionId(1), crownSessionId(3), crownSessionId(6)],
    portraitFallback: 'CV',
    tags: ['Heir', 'Soldier', 'Hides a war debt'],
  },
  {
    id: 'npc-ysolde-vell',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Princess Ysolde Vell',
    role: 'Middle heir, Royal Envoy',
    ancestry: 'Human',
    factionIds: ['faction-house-vell', 'faction-gilded-ledger'],
    motivation:
      'Win the throne through treaties and loans instead of another civil war.',
    relationship:
      'Charming and precise; courts the party with favors she expects repaid.',
    locationIds: ['location-hall-of-nine-banners', 'location-gilded-exchange'],
    sessionIds: [crownSessionId(1), crownSessionId(3), crownSessionId(6)],
    portraitFallback: 'YV',
    tags: ['Heir', 'Diplomat', 'Owes the Ledger'],
  },
  {
    id: 'npc-tamsin-vell',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Tamsin Vell',
    role: 'Youngest heir, Cloister scholar',
    ancestry: 'Half-elf',
    factionIds: ['faction-house-vell', 'faction-ember-wardens'],
    motivation:
      'Learn why the crown burns its bearers and stop the cycle, even at the cost of the throne.',
    relationship:
      'Earnest and underestimated; the only heir who asks the crown questions.',
    locationIds: ['location-ember-cloister', 'location-crown-vault'],
    sessionIds: [crownSessionId(1), crownSessionId(4), crownSessionId(6)],
    portraitFallback: 'TV',
    tags: ['Heir', 'Scholar', 'Secretly kind'],
  },
  {
    id: 'npc-the-crown',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Crown of Cinders',
    role: 'Sentient coronation relic',
    ancestry: 'Sentient relic',
    factionIds: [],
    motivation:
      'Be worn by a ruler who will not lie to it; it remembers every bearer it has burned.',
    relationship:
      'Speaks only to those touching it. Accuses all three heirs but never says which lie matters.',
    locationIds: ['location-hall-of-nine-banners', 'location-crown-vault'],
    sessionIds: [
      crownSessionId(1),
      crownSessionId(2),
      crownSessionId(4),
      crownSessionId(6),
    ],
    portraitFallback: 'CC',
    tags: ['Relic', 'Voice in the head', 'Truth-seeker'],
  },
  {
    id: 'npc-halden-brack',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Marshal Halden Brack',
    role: 'Warden-Marshal of the Ember Wardens',
    ancestry: 'Dwarf',
    factionIds: ['faction-ember-wardens'],
    motivation:
      'Keep the crown out of the wrong hands and his order from being blamed for the assassination.',
    relationship:
      'Gruff patron for Bryn; suspicious of the party until they prove the crown trusts them.',
    locationIds: ['location-ember-cloister', 'location-hall-of-nine-banners'],
    sessionIds: [crownSessionId(1), crownSessionId(2), crownSessionId(5)],
    portraitFallback: 'HB',
    tags: ['Warden', 'Oath-bound', 'Mentor'],
  },
  {
    id: 'npc-oswin-pell',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Lord Treasurer Oswin Pell',
    role: 'Master of the Gilded Ledger',
    ancestry: 'Human',
    factionIds: ['faction-gilded-ledger'],
    motivation:
      'Back whichever heir keeps the realm’s debts profitable; has quietly funded all three.',
    relationship:
      'Affable financier who offers the party contracts and never a straight answer.',
    locationIds: ['location-gilded-exchange', 'location-ashgate'],
    sessionIds: [crownSessionId(3), crownSessionId(4)],
    portraitFallback: 'OP',
    tags: ['Financier', 'Backs every horse', 'Blackmail ledger'],
  },
  {
    id: 'npc-nell-soot',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Nell Soot',
    role: 'Fence and guild speaker of the Soot Hands',
    ancestry: 'Halfling',
    factionIds: ['faction-soot-hands'],
    motivation:
      'Keep the guild alive; someone used the Soot Hands’ flame signal without permission.',
    relationship:
      'Knows Ivo’s old crew; trades information for a favor and a clean name.',
    locationIds: ['location-guttered-candle', 'location-ashwater-quay'],
    sessionIds: [crownSessionId(2), crownSessionId(3)],
    portraitFallback: 'NS',
    tags: ['Fence', 'Ivo’s contact', 'Frightened'],
  },
  {
    id: 'npc-mother-cinder',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Mother Cinder',
    role: 'Voice of the Unquenched',
    ancestry: 'Human',
    factionIds: ['faction-unquenched'],
    motivation:
      'Burn the crown’s judgement out of the realm so fire, not law, chooses its rulers.',
    relationship:
      'Unmet. Her brand appears on the assassins before she appears in person.',
    locationIds: ['location-ashen-catacombs'],
    sessionIds: [crownSessionId(5), crownSessionId(6)],
    portraitFallback: 'MC',
    tags: ['Villain', 'Cult leader', 'Not yet introduced'],
  },
  {
    id: 'npc-courier-wren',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Wren Ashdown',
    role: 'Ash-streaked courier',
    ancestry: 'Human',
    factionIds: [],
    motivation:
      'Deliver the sealed genealogy she was paid to carry, and stay alive long enough to be paid twice.',
    relationship:
      'Terrified messenger; does not know what she is carrying or who wrote it.',
    locationIds: ['location-hall-of-nine-banners', 'location-ashwater-quay'],
    sessionIds: [crownSessionId(1), crownSessionId(2)],
    portraitFallback: 'WA',
    tags: ['Messenger', 'Session 1 closer', 'Witness'],
  },
  {
    id: 'npc-maren-vell',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Queen Maren Vell (deceased)',
    role: 'Late monarch, subject of the inquest',
    ancestry: 'Human',
    factionIds: ['faction-house-vell'],
    motivation:
      'Even in death: keep her children from learning what she confessed to the crown on her last night.',
    relationship:
      'Never met. Appears through testimony and the crown’s memories, and every heir remembers a different queen.',
    locationIds: ['location-queens-chambers', 'location-hall-of-nine-banners'],
    sessionIds: [crownSessionId(3), crownSessionId(4), crownSessionId(6)],
    portraitFallback: 'MV',
    tags: ['Deceased', 'Memory', 'Matriarch', 'Hidden confession'],
  },
  {
    id: 'npc-quillon-thrum',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Brother Quillon Thrum',
    role: 'Archivist of the Ember Cloister',
    ancestry: 'Gnome',
    factionIds: ['faction-ember-wardens'],
    motivation:
      'Preserve the Cloister’s records and quietly atone for the pages he was ordered to seal.',
    relationship:
      'Nervous, generous with trivia and a terrible liar; Tamsin’s confidant and the party’s best source of lore if they are kind to him.',
    locationIds: ['location-ember-cloister', 'location-crown-vault'],
    sessionIds: [crownSessionId(4), crownSessionId(5)],
    portraitFallback: 'QT',
    tags: ['Archivist', 'Guilty conscience', 'Lore source'],
  },
  {
    id: 'npc-dagna-rook',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Marchwarden Dagna Rook',
    role: 'Spokesperson of the Marcher Lords',
    ancestry: 'Half-orc',
    factionIds: ['faction-border-lords'],
    motivation:
      'Collect the war debt Corvin owes the frontier in grain, steel and a council seat, or march on Ashgate to collect it in person.',
    relationship:
      'Plainspoken and patient. Treats the party as honest brokers precisely because they are not courtiers.',
    locationIds: ['location-marchwarden-house', 'location-hall-of-nine-banners'],
    sessionIds: [crownSessionId(3), crownSessionId(6)],
    portraitFallback: 'DR',
    tags: ['Creditor', 'Border lord', 'Honest brute', 'Corvin’s debt'],
  },
  {
    id: 'npc-ferrant-inkwell',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Ferrant Inkwell',
    role: 'Master scrivener and forger',
    ancestry: 'Gnome',
    factionIds: ['faction-soot-hands', 'faction-gilded-ledger'],
    motivation:
      'Stay paid and stay off the gallows. He aged the genealogy’s ink on commission but swears he did not write the lines.',
    relationship:
      'Hides behind pedantry and professional ethics, but sells his customers’ names the moment the Watch is not listening.',
    locationIds: ['location-inkwell-court'],
    sessionIds: [crownSessionId(3)],
    portraitFallback: 'FI',
    tags: ['Forger', 'Pedant', 'Knows who paid'],
  },
  {
    id: 'npc-vessa-thornscale',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Captain Vessa Thornscale',
    role: 'Captain of the Ashgate Watch',
    ancestry: 'Dragonborn',
    factionIds: ['faction-ashgate-watch'],
    motivation:
      'Keep the capital from rioting while the throne is contested. She arrests whoever the crowd blames first.',
    relationship:
      'Fair, exhausted and under pressure from all three heirs to detain the others’ people; a reluctant ally who will not be bribed but can be out-argued.',
    locationIds: ['location-palace-hill', 'location-lamplighters-row'],
    sessionIds: [crownSessionId(2), crownSessionId(3), crownSessionId(6)],
    portraitFallback: 'VT',
    tags: ['Law', 'Under pressure', 'Reluctant ally'],
  },
  {
    id: 'npc-sera-lampwright',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'Sera Lampwright',
    role: 'Soot Hands runner and lamplighter',
    ancestry: 'Tiefling',
    factionIds: ['faction-soot-hands'],
    motivation:
      'Prove the guild did not do this. She saw who was tapping out the old flame code on the Row three nights before the coronation.',
    relationship:
      'Sharp-tongued teenager who trusts Ivo’s reputation more than his promises.',
    locationIds: ['location-lamplighters-row', 'location-guttered-candle'],
    sessionIds: [crownSessionId(2)],
    portraitFallback: 'SL',
    tags: ['Runner', 'Witness', 'Young', 'Wants a clean name'],
  },
  {
    id: 'npc-aurel-claimant',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Man Who Calls Himself Aurel',
    role: 'Unverified fourth claimant',
    ancestry: 'Human',
    factionIds: [],
    motivation:
      'To be believed. He may be the true firstborn, a decoy, or a foundling raised in the Cloister, and even he is not certain which.',
    relationship:
      'Unmet. Letters and rumors precede him; he surfaces only after the mausoleum reveals the empty coffin.',
    locationIds: ['location-royal-mausoleum', 'location-ashwater-quay'],
    sessionIds: [crownSessionId(4), crownSessionId(6)],
    portraitFallback: 'AC',
    tags: ['Fourth claimant', 'Unverified', 'Late reveal'],
  },
];

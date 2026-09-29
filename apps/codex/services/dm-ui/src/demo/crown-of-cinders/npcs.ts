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
];

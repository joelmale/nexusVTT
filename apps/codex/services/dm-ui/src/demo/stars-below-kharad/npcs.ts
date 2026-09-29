import type { CampaignNpc } from '../ashes-of-veyra/types';
import { KHARAD_CAMPAIGN_ID as C } from './campaign';

const S1 = `${C}-session-1`;
const S2 = `${C}-session-2`;
const S3 = `${C}-session-3`;

export const kharadNpcs: CampaignNpc[] = [
  {
    id: 'npc-tamsin-brack',
    campaignId: C,
    name: 'Foreman Tamsin Brack',
    role: 'Kharad mine foreman',
    ancestry: 'Dwarf',
    factionIds: ['faction-kharad-delvers-union'],
    motivation:
      'Bring every miner home, then make sure the holds never treat Kharad as expendable again.',
    relationship:
      'Devoted ally after the rescue; stands at the Commons dedication holding the survey hammer she lent Orik.',
    locationIds: ['location-kharad-mine', 'location-kharad-commons'],
    sessionIds: [S1, S3],
    portraitFallback: 'TB',
    tags: ['Foreman', 'Loyal ally', 'Rescued crew'],
  },
  {
    id: 'npc-yarrow-stonesinger',
    campaignId: C,
    name: 'Yarrow Stonesinger',
    role: 'Fault-singer and rescued surveyor',
    ancestry: 'Dwarf',
    factionIds: ['faction-kharad-delvers-union', 'faction-chalkline-collegium'],
    motivation:
      'Understand why the stone answers her songs a heartbeat before she sings them.',
    relationship:
      'Grateful witness who later tunes the deep sun’s hum into the Commons’ evening bell.',
    locationIds: ['location-singing-fault', 'location-inverted-observatory'],
    sessionIds: [S1, S3],
    portraitFallback: 'YS',
    tags: ['Surveyor', 'Witness', 'Echo-touched'],
  },
  {
    id: 'npc-pell-quartz',
    campaignId: C,
    name: 'Archivist Pell Quartz',
    role: 'Chalkline Collegium archivist',
    ancestry: 'Deep gnome',
    factionIds: ['faction-chalkline-collegium'],
    motivation:
      'Vindicate Dagna’s discredited deep-sky theory and preserve the chart for every hold.',
    relationship:
      'Scholarly ally who translates the inverted chart and later curates the legacy archive.',
    locationIds: ['location-inverted-observatory', 'location-kharad-commons'],
    sessionIds: [S1, S2, S3],
    portraitFallback: 'PQ',
    tags: ['Archivist', 'Translator', 'Dagna’s mentor'],
  },
  {
    id: 'npc-hrolda-ironvein',
    campaignId: C,
    name: 'Speaker Hrolda Ironvein',
    role: 'Speaker of the Seven-Hold Concord',
    ancestry: 'Dwarf',
    factionIds: ['faction-seven-hold-concord'],
    motivation:
      'Keep seven quarrelsome holds at one table long enough to share the engine instead of fighting for it.',
    relationship:
      'Tired, honest patron; accepts the party’s deep-sun compromise and signs the Commons charter.',
    locationIds: ['location-broken-gate-hall', 'location-kharad-commons'],
    sessionIds: [S2, S3],
    portraitFallback: 'HI',
    tags: ['Speaker', 'Patron', 'Peacemaker'],
  },
  {
    id: 'npc-vessa-ordrun',
    campaignId: C,
    name: 'Marshal Vessa Ordrun',
    role: 'Ardent Deep Company expedition marshal',
    ancestry: 'Duergar',
    factionIds: ['faction-ardent-deep-company'],
    motivation:
      'Seize the star engine as a weapon that ends a century of underground border wars.',
    relationship:
      'Rival turned reluctant witness; stands down when the Astronomer refuses her command word.',
    locationIds: ['location-transit-line', 'location-engine-heart'],
    sessionIds: [S2, S3],
    portraitFallback: 'VO',
    tags: ['Rival', 'Marshal', 'Weaponizer'],
  },
  {
    id: 'npc-oskar-deepfire',
    campaignId: C,
    name: 'Delegate Oskar Deepfire',
    role: 'Hold Duskforge delegate',
    ancestry: 'Dwarf',
    factionIds: ['faction-duskforge-hold', 'faction-seven-hold-concord'],
    motivation:
      'Turn the vessel into a Duskforge-controlled arsenal and quietly sabotage rival delegates to do it.',
    relationship:
      'Spurned schemer; his sabotage requests were refused and his promised weapon never came.',
    locationIds: ['location-broken-gate-hall', 'location-engine-heart'],
    sessionIds: [S2, S3],
    portraitFallback: 'OD',
    tags: ['Delegate', 'Schemer', 'Broken promise'],
  },
  {
    id: 'npc-ilsa-vaunt',
    campaignId: C,
    name: 'Magistrate Ilsa Vaunt',
    role: 'Concord magistrate of custodianship',
    ancestry: 'Human',
    factionIds: ['faction-seven-hold-concord'],
    motivation:
      'See the engine’s legal custodian named without loopholes that a hold could exploit later.',
    relationship:
      'Fair, exacting neutral who witnesses the writ and later drafts the shared-sky charter.',
    locationIds: ['location-broken-gate-hall', 'location-kharad-commons'],
    sessionIds: [S2, S3],
    portraitFallback: 'IV',
    tags: ['Magistrate', 'Legal', 'Neutral'],
  },
  {
    id: 'npc-the-astronomer',
    campaignId: C,
    name: 'The Astronomer',
    role: 'Ancient custodian of the star engine',
    ancestry: 'Construct',
    factionIds: ['faction-astronomers-watch'],
    motivation:
      'Deliver its civilization to the sky, or burn the vessel rather than let it be misused.',
    relationship:
      'Guardian turned convert; surrenders after the party states a shared purpose and becomes the deep sun’s quiet steward.',
    locationIds: ['location-zero-gravity-vault', 'location-engine-heart'],
    sessionIds: [S3],
    portraitFallback: 'TA',
    tags: ['Guardian', 'Mythic', 'Surrendered'],
  },
];

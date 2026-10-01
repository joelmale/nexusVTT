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
  {
    id: 'npc-brondi-greywall',
    campaignId: C,
    name: 'Warden-Delegate Brondi Greywall',
    role: 'Delegate of Hold Greywarden',
    ancestry: 'Dwarf',
    factionIds: ['faction-hold-greywarden', 'faction-seven-hold-concord'],
    motivation:
      'Keep the engine behind a door that only seven keys can open, because Greywarden has buried too many sons to border wars to trust any single hand.',
    relationship:
      'Blunt, scrupulously honest skeptic who votes against opening the gate, then stands the first watch beside it once the party proves the custodian oath binds everyone.',
    locationIds: ['location-broken-gate-hall', 'location-kharad-commons'],
    sessionIds: [S2, S3],
    portraitFallback: 'BG',
    tags: ['Delegate', 'Hardliner', 'Honest broker'],
  },
  {
    id: 'npc-sunniva-thrum',
    campaignId: C,
    name: 'Railwright Sunniva Thrum',
    role: 'Delegate of Hold Thrumhall and keeper of the transit line',
    ancestry: 'Dwarf',
    factionIds: ['faction-hold-thrumhall', 'faction-seven-hold-concord'],
    motivation:
      'Thrumhall cast the rails and owns every switch on them; she wants the line to run again, safely, and wants it written down that her hold built it.',
    relationship:
      'Delighted by the chase and furious about the damage; coaches the party through the switchyard and later oversees sealing the line.',
    locationIds: [
      'location-thrumhall-switchyard',
      'location-transit-line',
      'location-broken-gate-hall',
    ],
    sessionIds: [S2, S3],
    portraitFallback: 'ST',
    tags: ['Delegate', 'Engineer', 'Line keeper'],
  },
  {
    id: 'npc-orla-silvervein',
    campaignId: C,
    name: 'Banker-Delegate Orla Silvervein',
    role: 'Delegate of Hold Highvein',
    ancestry: 'Dwarf',
    factionIds: ['faction-hold-highvein', 'faction-seven-hold-concord'],
    motivation:
      'Convert every road, lamp and loaf under the deep sun into a toll, and quietly sabotage Thrumhall so Highvein can underwrite the rails.',
    relationship:
      'Gracious, patient and never in a hurry; her private sabotage request was declined, but her letters keep arriving with a smile.',
    locationIds: [
      'location-broken-gate-hall',
      'location-highvein-counting-house',
    ],
    sessionIds: [S2, S3],
    portraitFallback: 'OS',
    tags: ['Delegate', 'Banker', 'Open threat'],
  },
  {
    id: 'npc-bodil-marrowsong',
    campaignId: C,
    name: 'Ancestor-Keeper Bodil Marrowsong',
    role: 'Delegate of Hold Marrowstone and ossuary-keeper',
    ancestry: 'Dwarf',
    factionIds: ['faction-hold-marrowstone', 'faction-seven-hold-concord'],
    motivation:
      'Learn whether the sleepers in the engine were ancestors, strangers or something Marrowstone swore to bury and forgot.',
    relationship:
      'Gentle and unsettling; reads the vault shards as burial rites and refuses to vote until she has counted the berths herself.',
    locationIds: ['location-berth-galleries', 'location-zero-gravity-vault'],
    sessionIds: [S2, S3],
    portraitFallback: 'BM',
    tags: ['Delegate', 'Ossuary', 'Open question'],
  },
  {
    id: 'npc-kjeld-bellows',
    campaignId: C,
    name: 'Brewmaster Kjeld Bellows',
    role: 'Delegate of Hold Bellowmere',
    ancestry: 'Dwarf',
    factionIds: ['faction-hold-bellowmere', 'faction-seven-hold-concord'],
    motivation:
      'Feed everyone: a hold of steam-brewers and mushroom farmers, Bellowmere believes no treaty survives an empty table.',
    relationship:
      'Jovial swing vote who trades his ballot for a promise of shared kitchens, and later stocks the Commons taproom for the dedication.',
    locationIds: ['location-kharad-commons', 'location-broken-gate-hall'],
    sessionIds: [S2, S3],
    portraitFallback: 'KB',
    tags: ['Delegate', 'Brewer', 'Swing vote'],
  },
  {
    id: 'npc-ysolde-ghostlamp',
    campaignId: C,
    name: 'Lampwright Ysolde Ghostlamp',
    role: 'Delegate of Hold Ghostlamp',
    ancestry: 'Dwarf',
    factionIds: ['faction-hold-ghostlamp', 'faction-seven-hold-concord'],
    motivation:
      'Her hold’s lamps have burned violet for a week and she wants to know whether that is a blessing, a warning or a bill coming due.',
    relationship:
      'Quiet, watchful ally of the Collegium; supplies the violet lamps for the rescue and keeps a private log of every flicker.',
    locationIds: ['location-kharad-mine', 'location-broken-gate-hall'],
    sessionIds: [S1, S2, S3],
    portraitFallback: 'YG',
    tags: ['Delegate', 'Lampwright', 'Omen-reader'],
  },
  {
    id: 'npc-ketta-rawl',
    campaignId: C,
    name: 'Courier Ketta Rawl',
    role: 'Ardent Deep Company courier turned defector',
    ancestry: 'Duergar',
    factionIds: ['faction-ardent-deep-company'],
    motivation:
      'Survive the marshal’s war and see the light she was told never to look at.',
    relationship:
      'Carried Ordrun’s sealed orders to Meridian Station, left them for the party on purpose, and now tends the Commons’ lamp stalls under a Concord pardon.',
    locationIds: ['location-meridian-station', 'location-kharad-commons'],
    sessionIds: [S2, S3],
    portraitFallback: 'KR',
    tags: ['Defector', 'Courier', 'Pardoned'],
  },
  {
    id: 'npc-fennick-ashglass',
    campaignId: C,
    name: 'Tinker Fennick Ashglass',
    role: 'Keyholder’s kin and clockwork tinker',
    ancestry: 'Deep gnome',
    factionIds: ['faction-chalkline-collegium'],
    motivation:
      'Make sure the second half of his family’s warning is not lost: the Ashglass keys were cut as a pair.',
    relationship:
      'Nima’s great-uncle, arrives at the Commons dedication with a cracked brass case and an unfinished sentence about a second lock.',
    locationIds: ['location-kharad-commons'],
    sessionIds: [S3],
    portraitFallback: 'FA',
    tags: ['Kin', 'Tinker', 'Sequel hook'],
  },
  {
    id: 'npc-gruvna-brightcut',
    campaignId: C,
    name: 'Echo-Prior Gruvna Brightcut',
    role: 'Prior of the Kindled Congregation',
    ancestry: 'Orc',
    factionIds: ['faction-kindled-congregation'],
    motivation:
      'Give the miners’ grief and awe somewhere to live, and prove to Hale that the constellation was a map and not a trap.',
    relationship:
      'Hale’s elder in faith; lights the first evening bell, argues theology over stew, and treats the Astronomer as a kind of saint.',
    locationIds: ['location-evening-bell-shrine', 'location-kharad-commons'],
    sessionIds: [S3],
    portraitFallback: 'GB',
    tags: ['Cleric', 'Congregation', 'Shrine-keeper'],
  },
];

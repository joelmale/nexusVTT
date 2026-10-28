import type { CampaignFaction } from '../ashes-of-veyra/types';
import { KHARAD_CAMPAIGN_ID as C } from './campaign';

export const kharadFactions: CampaignFaction[] = [
  {
    id: 'faction-seven-hold-concord',
    campaignId: C,
    name: 'The Seven-Hold Concord',
    publicFace:
      'A standing council of delegates from the seven holds that share the deep roads.',
    hiddenAgenda:
      'Every delegate privately bargains to win the engine for their own hold.',
    leaderNpcId: 'npc-hrolda-ironvein',
    alliedFactionIds: [
      'faction-kharad-delvers-union',
      'faction-chalkline-collegium',
      'faction-hold-greywarden',
      'faction-hold-thrumhall',
      'faction-hold-bellowmere',
    ],
    rivalFactionIds: ['faction-ardent-deep-company'],
    locationIds: [
      'location-broken-gate-hall',
      'location-kharad-commons',
      'location-highvein-counting-house',
    ],
    questIds: [
      'quest-open-the-transit-gate',
      'quest-honor-the-seven-promises',
      'quest-seal-the-transit-line',
    ],
    status: 'ally',
  },
  {
    id: 'faction-chalkline-collegium',
    campaignId: C,
    name: 'The Chalkline Collegium',
    publicFace:
      'Surveyors and scholars who map the deep by chalk, echo, and stubbornness.',
    hiddenAgenda:
      'Keep the engine a research site and prevent any hold from weaponizing its findings.',
    leaderNpcId: 'npc-pell-quartz',
    alliedFactionIds: [
      'faction-seven-hold-concord',
      'faction-kharad-delvers-union',
      'faction-hold-ghostlamp',
      'faction-hold-marrowstone',
    ],
    rivalFactionIds: ['faction-duskforge-hold'],
    locationIds: [
      'location-inverted-observatory',
      'location-kharad-commons',
      'location-chalk-gallery',
    ],
    questIds: [
      'quest-read-inverted-chart',
      'quest-fate-of-the-vessel',
      'quest-the-eighth-light',
    ],
    status: 'ally',
  },
  {
    id: 'faction-kharad-delvers-union',
    campaignId: C,
    name: 'Kharad Delvers’ Union',
    publicFace: 'The mine crews of Kharad and the families that depend on them.',
    hiddenAgenda:
      'Use the discovery to end the holds’ habit of treating miners as expendable.',
    leaderNpcId: 'npc-tamsin-brack',
    alliedFactionIds: [
      'faction-seven-hold-concord',
      'faction-chalkline-collegium',
      'faction-hold-bellowmere',
      'faction-kindled-congregation',
    ],
    rivalFactionIds: ['faction-hold-highvein'],
    locationIds: [
      'location-kharad-mine',
      'location-kharad-commons',
      'location-lift-head-shrine',
    ],
    questIds: [
      'quest-rescue-survey-crew',
      'quest-honor-the-seven-promises',
      'quest-turn-the-tolls',
    ],
    status: 'ally',
  },
  {
    id: 'faction-duskforge-hold',
    campaignId: C,
    name: 'Hold Duskforge',
    publicFace: 'The Concord’s wealthiest smithing hold and its loudest delegate.',
    hiddenAgenda:
      'Convert the star engine into a Duskforge weapon and cripple rival delegations in the meantime.',
    leaderNpcId: 'npc-oskar-deepfire',
    alliedFactionIds: ['faction-ardent-deep-company'],
    rivalFactionIds: [
      'faction-chalkline-collegium',
      'faction-seven-hold-concord',
      'faction-hold-greywarden',
    ],
    locationIds: ['location-broken-gate-hall', 'location-engine-heart'],
    questIds: [
      'quest-sabotage-for-the-holds',
      'quest-honor-the-seven-promises',
    ],
    status: 'opposition',
  },
  {
    id: 'faction-ardent-deep-company',
    campaignId: C,
    name: 'The Ardent Deep Company',
    publicFace: 'A chartered rival expedition racing the party to the engine.',
    hiddenAgenda:
      'Seize the vessel and use it to win the century-long border wars by force.',
    leaderNpcId: 'npc-vessa-ordrun',
    alliedFactionIds: ['faction-duskforge-hold'],
    rivalFactionIds: [
      'faction-seven-hold-concord',
      'faction-astronomers-watch',
    ],
    locationIds: [
      'location-transit-line',
      'location-engine-heart',
      'location-meridian-station',
    ],
    questIds: [
      'quest-race-ordrun-to-the-engine',
      'quest-the-deserters-bargain',
    ],
    status: 'opposition',
  },
  {
    id: 'faction-astronomers-watch',
    campaignId: C,
    name: 'The Astronomer’s Watch',
    publicFace:
      'Nothing, until the rings turn: a sleeping guardian and its ring sentinels.',
    hiddenAgenda:
      'Deliver the vessel to the sky, or destroy it if it is claimed by a single power.',
    leaderNpcId: 'npc-the-astronomer',
    alliedFactionIds: ['faction-kindled-congregation'],
    rivalFactionIds: ['faction-ardent-deep-company'],
    locationIds: [
      'location-zero-gravity-vault',
      'location-engine-heart',
      'location-berth-galleries',
      'location-eighth-shaft',
    ],
    questIds: ['quest-fate-of-the-vessel', 'quest-the-eighth-light'],
    status: 'unknown',
  },
  {
    id: 'faction-hold-greywarden',
    campaignId: C,
    name: 'Hold Greywarden',
    publicFace:
      'The wall-wardens: a fortress hold whose sentries have kept the border galleries for four hundred years.',
    hiddenAgenda:
      'Never again let a single hand hold the engine, even if that means arming the Concord’s own wardens against a hold that tries.',
    leaderNpcId: 'npc-brondi-greywall',
    alliedFactionIds: [
      'faction-seven-hold-concord',
      'faction-hold-thrumhall',
    ],
    rivalFactionIds: ['faction-duskforge-hold'],
    locationIds: ['location-broken-gate-hall', 'location-kharad-commons'],
    questIds: ['quest-open-the-transit-gate', 'quest-seal-the-transit-line'],
    status: 'ally',
  },
  {
    id: 'faction-hold-thrumhall',
    campaignId: C,
    name: 'Hold Thrumhall',
    publicFace:
      'Bell-founders and railwrights who cast the transit line and keep its switches and timetables.',
    hiddenAgenda:
      'Control who may travel the line again, and keep the builders’ safety breaks a Thrumhall trade secret.',
    leaderNpcId: 'npc-sunniva-thrum',
    alliedFactionIds: [
      'faction-seven-hold-concord',
      'faction-hold-greywarden',
      'faction-kharad-delvers-union',
    ],
    rivalFactionIds: ['faction-hold-highvein'],
    locationIds: [
      'location-thrumhall-switchyard',
      'location-transit-line',
      'location-meridian-station',
    ],
    questIds: [
      'quest-open-the-transit-gate',
      'quest-seal-the-transit-line',
      'quest-turn-the-tolls',
    ],
    status: 'ally',
  },
  {
    id: 'faction-hold-highvein',
    campaignId: C,
    name: 'Hold Highvein',
    publicFace:
      'The silver-vein bankers who underwrite half the Concord’s treasuries and all of its excuses.',
    hiddenAgenda:
      'Charge a toll on every road, lamp and meal in the Commons, and quietly hobble Thrumhall to underwrite the rails.',
    leaderNpcId: 'npc-orla-silvervein',
    alliedFactionIds: ['faction-duskforge-hold'],
    rivalFactionIds: [
      'faction-hold-thrumhall',
      'faction-kharad-delvers-union',
    ],
    locationIds: [
      'location-highvein-counting-house',
      'location-broken-gate-hall',
    ],
    questIds: [
      'quest-sabotage-for-the-holds',
      'quest-turn-the-tolls',
    ],
    status: 'neutral',
  },
  {
    id: 'faction-hold-marrowstone',
    campaignId: C,
    name: 'Hold Marrowstone',
    publicFace:
      'The ossuary-keepers who bury the dead of all seven holds and keep their names in stone.',
    hiddenAgenda:
      'Establish whether the sleepers in the engine are their sworn dead; if they are, Marrowstone will contest every plan that would burn them.',
    leaderNpcId: 'npc-bodil-marrowsong',
    alliedFactionIds: ['faction-chalkline-collegium'],
    rivalFactionIds: [],
    locationIds: ['location-berth-galleries', 'location-zero-gravity-vault'],
    questIds: ['quest-bring-the-ancestors-home', 'quest-the-eighth-light'],
    status: 'neutral',
  },
  {
    id: 'faction-hold-bellowmere',
    campaignId: C,
    name: 'Hold Bellowmere',
    publicFace:
      'Steam-brewers and mushroom farmers whose kitchens feed the deep roads.',
    hiddenAgenda:
      'Keep the peace by keeping everyone fed, and build a food-debt web that makes war too expensive for any hold.',
    leaderNpcId: 'npc-kjeld-bellows',
    alliedFactionIds: [
      'faction-seven-hold-concord',
      'faction-kharad-delvers-union',
    ],
    rivalFactionIds: ['faction-hold-highvein'],
    locationIds: ['location-kharad-commons', 'location-broken-gate-hall'],
    questIds: ['quest-honor-the-seven-promises', 'quest-turn-the-tolls'],
    status: 'ally',
  },
  {
    id: 'faction-hold-ghostlamp',
    campaignId: C,
    name: 'Hold Ghostlamp',
    publicFace:
      'Lampwrights and oil-merchants who light every tunnel the holds share.',
    hiddenAgenda:
      'Decode why their lamps burn violet near the engine, and sell the answer before anyone else can.',
    leaderNpcId: 'npc-ysolde-ghostlamp',
    alliedFactionIds: [
      'faction-chalkline-collegium',
      'faction-kindled-congregation',
    ],
    rivalFactionIds: [],
    locationIds: ['location-kharad-mine', 'location-lift-head-shrine'],
    questIds: ['quest-rescue-survey-crew', 'quest-light-the-evening-shrine'],
    status: 'neutral',
  },
  {
    id: 'faction-kindled-congregation',
    campaignId: C,
    name: 'The Kindled Congregation',
    publicFace:
      'A young faith of miners, scholars and orcs who hold that the constellation is a map left by a patient god.',
    hiddenAgenda:
      'Raise a shrine at the deep sun and, in time, ask the Astronomer to bless it as the first saint of the new faith.',
    leaderNpcId: 'npc-gruvna-brightcut',
    alliedFactionIds: [
      'faction-kharad-delvers-union',
      'faction-hold-ghostlamp',
      'faction-astronomers-watch',
    ],
    rivalFactionIds: ['faction-duskforge-hold'],
    locationIds: [
      'location-evening-bell-shrine',
      'location-lift-head-shrine',
    ],
    questIds: ['quest-light-the-evening-shrine'],
    status: 'ally',
  },
];

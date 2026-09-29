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
    ],
    rivalFactionIds: ['faction-ardent-deep-company'],
    locationIds: ['location-broken-gate-hall', 'location-kharad-commons'],
    questIds: [
      'quest-open-the-transit-gate',
      'quest-honor-the-seven-promises',
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
    ],
    rivalFactionIds: ['faction-duskforge-hold'],
    locationIds: ['location-inverted-observatory', 'location-kharad-commons'],
    questIds: ['quest-read-inverted-chart', 'quest-fate-of-the-vessel'],
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
    ],
    rivalFactionIds: [],
    locationIds: ['location-kharad-mine', 'location-kharad-commons'],
    questIds: ['quest-rescue-survey-crew', 'quest-honor-the-seven-promises'],
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
    locationIds: ['location-transit-line', 'location-engine-heart'],
    questIds: ['quest-race-ordrun-to-the-engine'],
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
    alliedFactionIds: [],
    rivalFactionIds: ['faction-ardent-deep-company'],
    locationIds: ['location-zero-gravity-vault', 'location-engine-heart'],
    questIds: ['quest-fate-of-the-vessel'],
    status: 'unknown',
  },
];

import type { CampaignFaction } from '../ashes-of-veyra/types';
import { MOURNINGFEN_CAMPAIGN_ID } from './campaign';

export const factions: CampaignFaction[] = [
  {
    id: 'faction-lantern-wardens',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'The Lantern Wardens',
    publicFace:
      'Volunteers who trim the marsh lamps, staff the ferry, and keep travelers off the fen after dusk.',
    hiddenAgenda:
      'Pay the yearly tithe of remembered things to the well, and make sure no one recalls the Verrows long enough to ask why.',
    leaderNpcId: 'npc-hesper-crane',
    alliedFactionIds: ['faction-burial-society'],
    rivalFactionIds: [
      'faction-reedbound',
      'faction-fenfolk-drovers',
      'faction-marrowbone-circle',
      'faction-greywater-assize',
    ],
    locationIds: [
      'location-wardens-lamp-house',
      'location-mourningfen-village',
      'location-crossing-ferry-landing',
    ],
    questIds: ['quest-village-that-forgot', 'quest-ferrymans-last-fare'],
    status: 'unknown',
  },
  {
    id: 'faction-reedbound',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'The Reedbound',
    publicFace:
      'A procession of lantern-carrying shapes glimpsed in the reeds at dusk.',
    hiddenAgenda:
      'Recover seven names. Some of them will accept an eighth if it stops the counting.',
    leaderNpcId: 'npc-ysolde-verrow',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-lantern-wardens'],
    locationIds: [
      'location-drowned-shrine',
      'location-verrow-homestead',
      'location-homestead-nursery',
    ],
    questIds: [
      'quest-follow-the-blue-lantern',
      'quest-what-the-house-remembers',
    ],
    status: 'neutral',
  },
  {
    id: 'faction-burial-society',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Tidewake Burial Society',
    publicFace:
      'Keeps the village funeral rolls and holds the marsh’s only consecrated ground.',
    hiddenAgenda:
      'Its founders signed the forgetting. The archive holds the signatories and the Society would rather it stay shut.',
    leaderNpcId: 'npc-bettin-sallow',
    alliedFactionIds: ['faction-lantern-wardens'],
    rivalFactionIds: ['faction-greywater-assize'],
    locationIds: [
      'location-mourningfen-village',
      'location-tidewake-burial-hall',
      'location-tidewake-archive',
      'location-tidewake-burying-ground',
    ],
    questIds: ['quest-village-that-forgot'],
    status: 'neutral',
  },
  {
    id: 'faction-mere-below',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'The Mere Below',
    publicFace: 'Nothing. The well has been dry as long as anyone remembers.',
    hiddenAgenda:
      'Be given a name and, failing that, take the names of everyone who lives above it.',
    leaderNpcId: 'npc-the-eighth-voice',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-lantern-wardens'],
    locationIds: ['location-verrow-well'],
    questIds: ['quest-the-eighth-voice'],
    status: 'opposition',
  },
  {
    id: 'faction-fenfolk-drovers',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'Fenfolk Eel-Drovers',
    publicFace:
      'Rough boatmen and eel-catchers who supply the market and know every channel.',
    hiddenAgenda:
      'Talk of leaving the fen for the coast. Several crews have already lost whole years of memory and blame the Wardens.',
    leaderNpcId: 'npc-dunmore-fenn',
    alliedFactionIds: ['faction-marrowbone-circle'],
    rivalFactionIds: ['faction-lantern-wardens'],
    locationIds: ['location-eel-market', 'location-reedcutters-rest'],
    questIds: ['quest-village-that-forgot'],
    status: 'ally',
  },
  {
    id: 'faction-marrowbone-circle',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'The Marrowbone Circle',
    publicFace:
      'A loose sisterhood of herbalists, midwives and bone-setters who treat the fen’s fevers, fits and forgettings out of back rooms and boat-sheds.',
    hiddenAgenda:
      'Preserve a parallel record: every remedy card, every midwife’s tally, every patient’s missing year. They believe the forgetting can be reversed one person at a time, and that doing it at scale would wake the well.',
    leaderNpcId: 'npc-marl-quillon',
    alliedFactionIds: ['faction-fenfolk-drovers'],
    rivalFactionIds: ['faction-lantern-wardens'],
    locationIds: ['location-eel-market', 'location-verrow-kitchen'],
    questIds: ['quest-the-remedy-for-forgetting'],
    status: 'ally',
  },
  {
    id: 'faction-greywater-assize',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    name: 'The Greywater Assize',
    publicFace:
      'The travelling circuit court that audits the marsh villages’ tax rolls, boundaries and burial rights twice a decade.',
    hiddenAgenda:
      'The Assize wants a lawful reason to dissolve the Burial Society and seize its holdings, which include the only consecrated ground in the fen and a century of unaudited oil purchases. It does not care what the village forgot, only who profited.',
    leaderNpcId: 'npc-sabine-vale',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-lantern-wardens', 'faction-burial-society'],
    locationIds: ['location-mourningfen-village', 'location-tidewake-archive'],
    questIds: ['quest-the-assize-rides-in'],
    status: 'unknown',
  },
];

import type { CampaignFaction } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID } from './campaign';

export const crownFactions: CampaignFaction[] = [
  {
    id: 'faction-house-vell',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'House Vell',
    publicFace: 'The royal family, grieving and united for the coronation.',
    hiddenAgenda:
      'Each heir has privately promised offices and land to their own backers.',
    leaderNpcId: 'npc-corvin-vell',
    alliedFactionIds: ['faction-ember-wardens'],
    rivalFactionIds: ['faction-unquenched'],
    locationIds: [
      'location-hall-of-nine-banners',
      'location-ashgate',
      'location-crown-vault',
    ],
    questIds: ['quest-who-wears-the-crown', 'quest-dead-princes-genealogy'],
    status: 'unknown',
  },
  {
    id: 'faction-ember-wardens',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Ember Wardens',
    publicFace: 'Oath-sworn guardians of the crown and its vault.',
    hiddenAgenda:
      'Marshal Brack has hidden the crown’s burn list to protect the order’s founders.',
    leaderNpcId: 'npc-halden-brack',
    alliedFactionIds: ['faction-house-vell'],
    rivalFactionIds: ['faction-unquenched', 'faction-soot-hands'],
    locationIds: ['location-ember-cloister', 'location-crown-vault'],
    questIds: ['quest-trace-the-cinder-assassins', 'quest-crown-remembers'],
    status: 'ally',
  },
  {
    id: 'faction-gilded-ledger',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Gilded Ledger',
    publicFace: 'The counting-house guild that lends to the crown.',
    hiddenAgenda:
      'Keeps a blackmail ledger on every court family and needs the realm indebted, not settled.',
    leaderNpcId: 'npc-oswin-pell',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-soot-hands'],
    locationIds: ['location-gilded-exchange', 'location-ashgate'],
    questIds: ['quest-who-wears-the-crown', 'quest-dead-princes-genealogy'],
    status: 'neutral',
  },
  {
    id: 'faction-soot-hands',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Soot Hands',
    publicFace: 'Chimney sweeps and lamplighters serving every district.',
    hiddenAgenda:
      'A thieves’ guild that signals with lamp flame; its code was stolen and used for the attack.',
    leaderNpcId: 'npc-nell-soot',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-gilded-ledger', 'faction-ember-wardens'],
    locationIds: ['location-guttered-candle', 'location-ashwater-quay'],
    questIds: ['quest-trace-the-cinder-assassins'],
    status: 'unknown',
  },
  {
    id: 'faction-unquenched',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Unquenched',
    publicFace: 'Unknown. Marks appear on the dead and the burning.',
    hiddenAgenda:
      'An elemental cult that believes the crown’s judgement is a cage and wants it destroyed.',
    leaderNpcId: 'npc-mother-cinder',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-house-vell', 'faction-ember-wardens'],
    locationIds: ['location-ashen-catacombs', 'location-ember-cloister'],
    questIds: ['quest-trace-the-cinder-assassins', 'quest-crown-remembers'],
    status: 'opposition',
  },
];

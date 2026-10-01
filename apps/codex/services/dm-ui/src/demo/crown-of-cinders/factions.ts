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
    alliedFactionIds: [
      'faction-ember-wardens',
      'faction-ashgate-watch',
      'faction-border-lords',
    ],
    rivalFactionIds: ['faction-unquenched'],
    locationIds: [
      'location-hall-of-nine-banners',
      'location-ashgate',
      'location-crown-vault',
      'location-palace-hill',
      'location-queens-chambers',
      'location-royal-mausoleum',
    ],
    questIds: [
      'quest-who-wears-the-crown',
      'quest-dead-princes-genealogy',
      'quest-queens-last-night',
      'quest-border-lords-ultimatum',
    ],
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
    questIds: [
      'quest-trace-the-cinder-assassins',
      'quest-crown-remembers',
      'quest-queens-last-night',
    ],
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
    rivalFactionIds: ['faction-soot-hands', 'faction-border-lords'],
    locationIds: [
      'location-gilded-exchange',
      'location-ashgate',
      'location-inkwell-court',
    ],
    questIds: [
      'quest-who-wears-the-crown',
      'quest-dead-princes-genealogy',
      'quest-ink-without-blood',
      'quest-border-lords-ultimatum',
    ],
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
    rivalFactionIds: [
      'faction-gilded-ledger',
      'faction-ember-wardens',
      'faction-ashgate-watch',
    ],
    locationIds: [
      'location-guttered-candle',
      'location-ashwater-quay',
      'location-lamplighters-row',
      'location-inkwell-court',
    ],
    questIds: [
      'quest-trace-the-cinder-assassins',
      'quest-ink-without-blood',
      'quest-keep-ashgate-from-burning',
    ],
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
  {
    id: 'faction-border-lords',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Marcher Lords',
    publicFace:
      'Frontier landholders who guard the realm’s borders and answer the Lord Marshal’s call to arms.',
    hiddenAgenda:
      'They have financed Corvin’s campaigns for a decade and will seat a protector of their own choosing if the debt is not honored by the end of the coronation season.',
    leaderNpcId: 'npc-dagna-rook',
    alliedFactionIds: ['faction-house-vell'],
    rivalFactionIds: ['faction-gilded-ledger'],
    locationIds: ['location-marchwarden-house', 'location-hall-of-nine-banners'],
    questIds: ['quest-border-lords-ultimatum', 'quest-who-wears-the-crown'],
    status: 'neutral',
  },
  {
    id: 'faction-ashgate-watch',
    campaignId: CROWN_CAMPAIGN_ID,
    name: 'The Ashgate Watch',
    publicFace:
      'The city watch and palace guard, keeping the capital orderly in a week when nobody agrees who rules it.',
    hiddenAgenda:
      'Its sergeants take coin from all three heirs and from the Soot Hands. Captain Thornscale does not know how deep the rot goes, and will not like finding out.',
    leaderNpcId: 'npc-vessa-thornscale',
    alliedFactionIds: ['faction-house-vell'],
    rivalFactionIds: ['faction-soot-hands'],
    locationIds: ['location-palace-hill', 'location-lamplighters-row'],
    questIds: ['quest-keep-ashgate-from-burning'],
    status: 'neutral',
  },
];

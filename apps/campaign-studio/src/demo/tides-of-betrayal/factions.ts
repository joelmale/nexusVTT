import type { CampaignFaction } from '../ashes-of-veyra/types';
import { TIDES_CAMPAIGN_ID } from './campaign';

export const tidesFactions: CampaignFaction[] = [
  {
    id: 'faction-merchant-council',
    campaignId: TIDES_CAMPAIGN_ID,
    name: 'The Merchant Council',
    publicFace:
      'Seven merchant houses who rule Merrowgate, deeply concerned about disrupted trade routes.',
    hiddenAgenda:
      'Each seat is quietly working out who profits from the attack; at least one of them already knows.',
    leaderNpcId: 'npc-hendrick-bolt',
    alliedFactionIds: ['faction-harbor-watch'],
    rivalFactionIds: ['faction-red-tide'],
    locationIds: ['location-council-hall', 'location-merrowgate'],
    questIds: ['quest-who-sank-the-fleet', 'quest-traitor-on-the-council', 'quest-clear-bolts-name'],
    status: 'neutral',
  },
  {
    id: 'faction-red-tide',
    campaignId: TIDES_CAMPAIGN_ID,
    name: 'The Red Tide',
    publicFace:
      'Pirates who prey on the coast and hide among the reefs south of the Gullrock shoals.',
    hiddenAgenda:
      'Paid by a councilor to sink the spring fleet and seize one strongbox; now hunting the Pearl the strongbox’s chart points to.',
    leaderNpcId: 'npc-morwen-kade',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-merchant-council', 'faction-harbor-watch', 'faction-gull-and-coin'],
    locationIds: ['location-sirens-cove', 'location-drowned-market', 'location-blackwater-reach'],
    questIds: ['quest-who-sank-the-fleet', 'quest-pirate-queens-price', 'quest-free-jory'],
    status: 'opposition',
  },
  {
    id: 'faction-gull-and-coin',
    campaignId: TIDES_CAMPAIGN_ID,
    name: 'The Gull and Coin',
    publicFace:
      'House Vael’s trading company, known for fair contracts and generous charity to sailors’ widows.',
    hiddenAgenda:
      'Vael’s private network of agents, bribed crew and a hired sea mage, all working to deliver the Tidecaller Pearl to her.',
    leaderNpcId: 'npc-seraphine-vael',
    alliedFactionIds: [],
    rivalFactionIds: ['faction-red-tide', 'faction-deepcourt'],
    locationIds: ['location-vael-counting-house', 'location-widows-lantern'],
    questIds: ['quest-traitor-on-the-council', 'quest-tidecaller-pearl', 'quest-dangerous-shipment'],
    status: 'unknown',
  },
  {
    id: 'faction-harbor-watch',
    campaignId: TIDES_CAMPAIGN_ID,
    name: 'The Harbor Watch',
    publicFace: 'Merrowgate’s guard patrols, stretched thin since the attack.',
    hiddenAgenda:
      'The rank and file are honest; their magistrate reports to the Council member who appointed him.',
    leaderNpcId: 'npc-ada-flint',
    alliedFactionIds: ['faction-merchant-council'],
    rivalFactionIds: ['faction-red-tide'],
    locationIds: ['location-dock-ward', 'location-council-hall'],
    questIds: ['quest-who-sank-the-fleet', 'quest-clear-bolts-name'],
    status: 'neutral',
  },
  {
    id: 'faction-longshoremen',
    campaignId: TIDES_CAMPAIGN_ID,
    name: 'The Longshoremen',
    publicFace: 'The dockworkers’ brotherhood who load and unload every ship in the Dock Ward.',
    hiddenAgenda:
      'They see every crate that moves and are scared of the ones they were paid not to see.',
    leaderNpcId: 'npc-brannoc-thole',
    alliedFactionIds: ['faction-shantykeepers'],
    rivalFactionIds: [],
    locationIds: ['location-dock-ward', 'location-shipyard', 'location-salty-seaman'],
    questIds: ['quest-dangerous-shipment', 'quest-pips-lost-dog'],
    status: 'ally',
  },
  {
    id: 'faction-shantykeepers',
    campaignId: TIDES_CAMPAIGN_ID,
    name: 'The Shantykeepers',
    publicFace: 'Old sailors and fishwives who keep the harbor’s songs alive.',
    hiddenAgenda:
      'Their songs remember safe passages, hidden coves and the drowned temple that the city forgot.',
    leaderNpcId: 'npc-old-maeve',
    alliedFactionIds: ['faction-longshoremen', 'faction-deepcourt'],
    rivalFactionIds: [],
    locationIds: ['location-spice-row', 'location-widows-lantern'],
    questIds: ['quest-the-sirens-song', 'quest-tidecaller-pearl'],
    status: 'ally',
  },
  {
    id: 'faction-deepcourt',
    campaignId: TIDES_CAMPAIGN_ID,
    name: 'The Deepcourt',
    publicFace: 'The merfolk realm beyond the reef, rarely seen and rarely friendly.',
    hiddenAgenda:
      'Sold half of an old chart to a surface councilor to pay a debt, and now fears what they have unleashed.',
    leaderNpcId: 'npc-nerissa',
    alliedFactionIds: ['faction-shantykeepers'],
    rivalFactionIds: ['faction-gull-and-coin'],
    locationIds: ['location-sunken-spire', 'location-gullrock-shoals'],
    questIds: ['quest-tidecaller-pearl'],
    status: 'ally',
  },
];

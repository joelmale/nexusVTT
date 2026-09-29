import type { CampaignClue } from '../ashes-of-veyra/types';
import { KHARAD_CAMPAIGN_ID as C } from './campaign';

const S1 = `${C}-session-1`;
const S2 = `${C}-session-2`;
const S3 = `${C}-session-3`;

export const kharadClues: CampaignClue[] = [
  {
    id: 'clue-echoes-run-early',
    campaignId: C,
    title: 'Echoes That Run Early',
    priority: 'medium',
    status: 'resolved',
    meaning:
      'The fault replays sounds a minute before they happen because the engine keeps time ahead of the surface.',
    sourceHandoutIds: ['handout-survey-crew-log'],
    relatedQuestIds: ['quest-rescue-survey-crew'],
    locationIds: ['location-singing-fault'],
    sessionIds: [S1],
  },
  {
    id: 'clue-inverted-constellation',
    campaignId: C,
    title: 'The Inverted Constellation',
    priority: 'high',
    status: 'resolved',
    meaning:
      'The chart is a map of seven holds seen from above, drawn as stars; Kharad is the newly awakened point.',
    sourceHandoutIds: ['handout-inverted-star-chart'],
    relatedQuestIds: ['quest-read-inverted-chart'],
    locationIds: ['location-inverted-observatory'],
    sessionIds: [S1],
  },
  {
    id: 'clue-seven-hold-seals',
    campaignId: C,
    title: 'Seven Hold Seals',
    priority: 'medium',
    status: 'resolved',
    meaning:
      'Seven seal-marks on the chart’s rim match the seven delegations; one, Duskforge, was overwritten in a newer hand.',
    sourceHandoutIds: [
      'handout-inverted-star-chart',
      'lore-seven-holds-charter',
    ],
    relatedQuestIds: ['quest-read-inverted-chart'],
    locationIds: ['location-broken-gate-hall'],
    sessionIds: [S2],
  },
  {
    id: 'clue-gate-custodian-oath',
    campaignId: C,
    title: 'The Custodian’s Oath',
    priority: 'high',
    status: 'resolved',
    meaning:
      'The gate activates only once a named custodian accepts legal and magical responsibility for the engine.',
    sourceHandoutIds: [
      'lore-seven-holds-charter',
      'handout-concord-writ-of-custodianship',
    ],
    relatedQuestIds: ['quest-open-the-transit-gate'],
    locationIds: ['location-broken-gate-hall'],
    sessionIds: [S2],
  },
  {
    id: 'clue-ordrun-orders',
    campaignId: C,
    title: 'Ordrun’s Sealed Orders',
    priority: 'high',
    status: 'resolved',
    meaning:
      'The Ardent Deep Company plans to weaponize the vessel with Duskforge’s quiet backing.',
    sourceHandoutIds: ['handout-ordrun-sealed-orders'],
    relatedQuestIds: [
      'quest-race-ordrun-to-the-engine',
      'quest-sabotage-for-the-holds',
    ],
    locationIds: ['location-transit-line'],
    sessionIds: [S2],
  },
  {
    id: 'clue-engine-ring-alignment',
    campaignId: C,
    title: 'Three Rings Aligning',
    priority: 'high',
    status: 'resolved',
    meaning:
      'The guardian’s goal shifts with each aligned ring; when all three align, it will launch or destroy the vessel.',
    sourceHandoutIds: ['lore-star-engine-purpose'],
    relatedQuestIds: ['quest-fate-of-the-vessel'],
    locationIds: ['location-engine-heart'],
    sessionIds: [S3],
  },
  {
    id: 'clue-astronomers-purpose',
    campaignId: C,
    title: 'The Astronomer’s Purpose',
    priority: 'high',
    status: 'resolved',
    meaning:
      'The guardian was built to carry a civilization to the sky and will yield to any purpose that serves that aim.',
    sourceHandoutIds: [
      'lore-star-engine-purpose',
      'handout-astronomers-final-message',
    ],
    relatedQuestIds: ['quest-fate-of-the-vessel'],
    locationIds: ['location-engine-heart', 'location-zero-gravity-vault'],
    sessionIds: [S3],
  },
  {
    id: 'clue-ark-or-weapon',
    campaignId: C,
    title: 'Ark or Weapon',
    priority: 'medium',
    status: 'partially-understood',
    meaning:
      'The vessel can carry a people or burn a hold; its builders left both purposes without saying which was intended.',
    sourceHandoutIds: [
      'lore-star-engine-purpose',
      'handout-astronomers-final-message',
    ],
    relatedQuestIds: [
      'quest-fate-of-the-vessel',
      'quest-honor-the-seven-promises',
    ],
    locationIds: ['location-engine-heart'],
    sessionIds: [S3],
  },
];

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
  {
    id: 'clue-compass-turns-down',
    campaignId: C,
    title: 'Every Compass Points Down',
    priority: 'low',
    status: 'resolved',
    meaning:
      'The engine’s buried ring acts as a lodestone, so every needle, Orik’s survey hammer and the Collegium’s plumb lines all lean toward the Engine Heart; the effect faded once the deep sun was lit.',
    sourceHandoutIds: ['handout-survey-crew-log', 'lore-star-chart-legend'],
    relatedQuestIds: ['quest-rescue-survey-crew'],
    locationIds: ['location-singing-fault', 'location-kharad-mine'],
    sessionIds: [S1],
  },
  {
    id: 'clue-violet-lamplight',
    campaignId: C,
    title: 'Lamps That Burn Violet',
    priority: 'medium',
    status: 'resolved',
    meaning:
      'Ghostlamp oil burns violet in the engine’s wake because the star-light is a color the old builders used for “someone is awake here”; the flame carried to the evening shrine kept the color.',
    sourceHandoutIds: ['lore-ghostlamp-lamp-liturgy'],
    relatedQuestIds: [
      'quest-rescue-survey-crew',
      'quest-light-the-evening-shrine',
    ],
    locationIds: ['location-kharad-mine', 'location-lift-head-shrine'],
    sessionIds: [S1, S3],
  },
  {
    id: 'clue-broken-in-one-place',
    campaignId: C,
    title: 'Broken in Exactly One Place',
    priority: 'medium',
    status: 'resolved',
    meaning:
      'Each transit route on the chart is broken once on purpose: the builders cut a safety break into every line so no single traveler could cross the whole constellation without a second key.',
    sourceHandoutIds: [
      'handout-thrumhall-line-ledger',
      'handout-inverted-star-chart',
    ],
    relatedQuestIds: [
      'quest-open-the-transit-gate',
      'quest-seal-the-transit-line',
    ],
    locationIds: [
      'location-transit-line',
      'location-thrumhall-switchyard',
    ],
    sessionIds: [S2, S3],
  },
  {
    id: 'clue-ketta-rawls-confession',
    campaignId: C,
    title: 'The Courier’s Confession',
    priority: 'medium',
    status: 'resolved',
    meaning:
      'Ketta Rawl left the sealed orders behind on purpose: the Company’s command word was never meant for a hold’s custodian, only for a guardian that would not argue.',
    sourceHandoutIds: ['handout-ketta-rawls-letter'],
    relatedQuestIds: [
      'quest-the-deserters-bargain',
      'quest-race-ordrun-to-the-engine',
    ],
    locationIds: ['location-meridian-station'],
    sessionIds: [S2],
  },
  {
    id: 'clue-duskforge-margin-script',
    campaignId: C,
    title: 'The Margin in Duskforge Script',
    priority: 'high',
    status: 'resolved',
    meaning:
      'The margin note promising to keep the Concord divided was written in Oskar Deepfire’s own hand, which Ketta’s testimony confirmed; it is the written proof of Duskforge’s collusion with the Company.',
    sourceHandoutIds: [
      'handout-ordrun-sealed-orders',
      'handout-ketta-rawls-letter',
    ],
    relatedQuestIds: [
      'quest-sabotage-for-the-holds',
      'quest-the-deserters-bargain',
    ],
    locationIds: ['location-broken-gate-hall'],
    sessionIds: [S2, S3],
  },
  {
    id: 'clue-highvein-toll-ledger',
    campaignId: C,
    title: 'Highvein’s Toll Ledger',
    priority: 'medium',
    status: 'resolved',
    meaning:
      'Highvein’s counting house has been logging “future tolls” on the Commons’ lamps, bread and bell since before the vote; the schedule was drafted weeks before the deep sun existed.',
    sourceHandoutIds: ['handout-highvein-toll-ledger'],
    relatedQuestIds: ['quest-turn-the-tolls'],
    locationIds: [
      'location-highvein-counting-house',
      'location-kharad-commons',
    ],
    sessionIds: [S3],
  },
  {
    id: 'clue-the-eighth-point',
    campaignId: C,
    title: 'The Eighth Point',
    priority: 'high',
    status: 'unresolved',
    meaning:
      'A faint eighth point lies on the chart’s rim directly under the engine, with no hold seal and no name. The party copied it but never learned what it marks.',
    sourceHandoutIds: [
      'handout-eighth-point-rubbing',
      'lore-star-chart-legend',
      'handout-inverted-star-chart',
    ],
    relatedQuestIds: ['quest-the-eighth-light'],
    locationIds: [
      'location-inverted-observatory',
      'location-eighth-shaft',
    ],
    sessionIds: [S1, S3],
  },
  {
    id: 'clue-empty-berths',
    campaignId: C,
    title: 'Forty Thousand Empty Berths',
    priority: 'high',
    status: 'partially-understood',
    meaning:
      'The manifest in the vessel lists 40,112 sleepers, but every berth the party counted was empty and unmarked by use; whether they left long ago, were burned, or were never real is unknown.',
    sourceHandoutIds: ['handout-marrowstone-sleeper-manifest'],
    relatedQuestIds: [
      'quest-bring-the-ancestors-home',
      'quest-the-eighth-light',
    ],
    locationIds: ['location-berth-galleries'],
    sessionIds: [S3],
  },
  {
    id: 'clue-key-hums-toward-highvein',
    campaignId: C,
    title: 'The Second Key Hums',
    priority: 'medium',
    status: 'unresolved',
    meaning:
      'Fennick says the Ashglass keys were cut as a pair; Nima’s sealed key is gone, but when she carries the spare tuning fork past the Highvein counting house, it sings.',
    sourceHandoutIds: [
      'handout-ashglass-key-letter',
      'handout-epilogue-letter-orla',
    ],
    relatedQuestIds: ['quest-the-eighth-light'],
    locationIds: [
      'location-highvein-counting-house',
      'location-kharad-commons',
    ],
    sessionIds: [S3],
  },
];

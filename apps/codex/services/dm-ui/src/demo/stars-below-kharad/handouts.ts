import type { CampaignHandout } from '../ashes-of-veyra/types';
import { KHARAD_CAMPAIGN_ID as C } from './campaign';

const S1 = `${C}-session-1`;
const S2 = `${C}-session-2`;
const S3 = `${C}-session-3`;

export const kharadHandouts: CampaignHandout[] = [
  {
    id: 'handout-inverted-star-chart',
    campaignId: C,
    title: 'The Inverted Star Chart',
    kind: 'handout',
    summary:
      'A crystal-etched chart in which the stars are caverns and the sky is solid rock.',
    content: [
      'Seven glowing points ring a larger, dimmer one. Beneath each is a hold seal; beneath the largest is a single word in old Dwarvish: Kharad.',
      'The lines between the points are not roads but transit routes, and each is broken in exactly one place.',
    ],
    visibility: 'shared',
    sessionIds: [S1, S2],
    clueIds: ['clue-inverted-constellation', 'clue-seven-hold-seals'],
    questIds: ['quest-read-inverted-chart'],
    locationIds: ['location-inverted-observatory'],
    factionIds: ['faction-chalkline-collegium'],
  },
  {
    id: 'handout-survey-crew-log',
    campaignId: C,
    title: 'Survey Crew Log',
    kind: 'handout',
    summary:
      'A water-stained log kept by the trapped crew before the collapse.',
    content: [
      'Day 3: the fault sang back our own voices before we sang them. Yarrow says it is a trick of the quartz. Nobody laughs.',
      'Day 5: the walls are warm. The compass will not settle. If anyone finds this, do not dig toward the light.',
    ],
    visibility: 'shared',
    sessionIds: [S1],
    clueIds: ['clue-echoes-run-early'],
    questIds: ['quest-rescue-survey-crew'],
    locationIds: ['location-singing-fault', 'location-kharad-mine'],
    factionIds: ['faction-kharad-delvers-union'],
  },
  {
    id: 'lore-seven-holds-charter',
    campaignId: C,
    title: 'The Seven-Hold Charter',
    kind: 'lore',
    summary:
      'The founding compact of the Concord and the seals each hold contributed.',
    content: [
      'Seven holds bound themselves to share the deep roads, and pledged that no one hold should claim any thing found beneath the shared stone.',
      'Article Nine reserves any machine of the old builders to a named custodian who answers to all seven.',
    ],
    visibility: 'dm-only',
    sessionIds: [S2],
    clueIds: ['clue-seven-hold-seals', 'clue-gate-custodian-oath'],
    questIds: ['quest-open-the-transit-gate', 'quest-read-inverted-chart'],
    locationIds: ['location-broken-gate-hall'],
    factionIds: ['faction-seven-hold-concord'],
  },
  {
    id: 'handout-concord-writ-of-custodianship',
    campaignId: C,
    title: 'Writ of Custodianship',
    kind: 'handout',
    summary:
      'The Concord writ naming Dagna Seven-Chalks custodian of the star engine.',
    content: [
      'By the authority of Article Nine, the Concord names Dagna Seven-Chalks custodian of the engine beneath Kharad, answerable to all seven holds.',
      'Witnessed by Magistrate Ilsa Vaunt. The gate will answer only to the named custodian.',
    ],
    visibility: 'shared',
    sessionIds: [S2],
    clueIds: ['clue-gate-custodian-oath'],
    questIds: ['quest-open-the-transit-gate'],
    locationIds: ['location-broken-gate-hall'],
    factionIds: ['faction-seven-hold-concord'],
  },
  {
    id: 'handout-ordrun-sealed-orders',
    campaignId: C,
    title: 'Ordrun’s Sealed Orders',
    kind: 'handout',
    summary:
      'Orders recovered from the marshal’s courier revealing the Company’s plan.',
    content: [
      'Secure the engine at any cost. Should the custodian refuse, the vessel is to be bound to the Company’s command word.',
      'A note in the margin, in Duskforge script: “Our delegate will keep the Concord divided until you are inside.”',
    ],
    visibility: 'dm-only',
    sessionIds: [S2],
    clueIds: ['clue-ordrun-orders'],
    questIds: [
      'quest-race-ordrun-to-the-engine',
      'quest-sabotage-for-the-holds',
    ],
    locationIds: ['location-transit-line'],
    factionIds: ['faction-ardent-deep-company', 'faction-duskforge-hold'],
  },
  {
    id: 'lore-star-engine-purpose',
    campaignId: C,
    title: 'What the Star Engine Is For',
    kind: 'lore',
    summary:
      'The builders’ purpose for the engine, pieced together across the campaign.',
    content: [
      'The engine is a launch cradle for a vessel meant to carry a civilization to the sky, and a failsafe meant to burn the vessel if it falls into hostile hands.',
      'The Astronomer serves whichever purpose the rings select; naming a shared purpose is the only way to hold both at bay.',
    ],
    visibility: 'dm-only',
    sessionIds: [S3],
    clueIds: [
      'clue-engine-ring-alignment',
      'clue-astronomers-purpose',
      'clue-ark-or-weapon',
    ],
    questIds: ['quest-fate-of-the-vessel'],
    locationIds: ['location-engine-heart'],
    factionIds: ['faction-astronomers-watch'],
  },
  {
    id: 'handout-astronomers-final-message',
    campaignId: C,
    title: 'The Astronomer’s Final Message',
    kind: 'handout',
    summary:
      'The guardian’s parting words as the rings fall still.',
    content: [
      'You have named a purpose that neither launches nor destroys. I was not built to answer such a question; I will keep the light you have made.',
      'Tell the holds the sky was never a place. It was a promise, and you have kept it.',
    ],
    visibility: 'shared',
    sessionIds: [S3],
    clueIds: ['clue-astronomers-purpose', 'clue-ark-or-weapon'],
    questIds: ['quest-fate-of-the-vessel'],
    locationIds: ['location-engine-heart'],
    factionIds: ['faction-astronomers-watch'],
  },
  {
    id: 'handout-epilogue-proclamation',
    campaignId: C,
    title: 'Proclamation of the Commons',
    kind: 'handout',
    summary:
      'The Concord proclamation founding the Commons of Seven Chalks under the deep sun.',
    content: [
      'Under the light the heroes made, the seven holds establish a Commons where miners, scholars, and delegates sit as equals.',
      'Custodianship of the engine passes to a rotating council; Dagna Seven-Chalks holds the first seat. Hold Duskforge’s claim to the engine is denied.',
    ],
    visibility: 'shared',
    sessionIds: [S3],
    clueIds: [],
    questIds: ['quest-honor-the-seven-promises'],
    locationIds: ['location-kharad-commons'],
    factionIds: ['faction-seven-hold-concord', 'faction-kharad-delvers-union'],
  },
  {
    id: 'lore-legacy-of-kharad',
    campaignId: C,
    title: 'The Legacy of Kharad',
    kind: 'lore',
    summary:
      'How each hold, and each hero, remembers the night the deep sky opened.',
    content: [
      'Miners call it the Kindling. Scholars call it the Chalk Revision, since Dagna’s theory was vindicated on every syllabus.',
      'Orik keeps the survey hammer at the Commons gate; Nima sealed her engine key inside the deep sun’s casing; Hale-of-Echoes tends the shrine where the evening bell rings.',
    ],
    visibility: 'dm-only',
    sessionIds: [S3],
    clueIds: [],
    questIds: [
      'quest-honor-the-seven-promises',
      'quest-fate-of-the-vessel',
    ],
    locationIds: ['location-kharad-commons', 'location-engine-heart'],
    factionIds: [
      'faction-seven-hold-concord',
      'faction-chalkline-collegium',
      'faction-kharad-delvers-union',
    ],
  },
];

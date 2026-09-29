import type { CampaignClue } from '../ashes-of-veyra/types';
import { MOURNINGFEN_CAMPAIGN_ID, mourningfenSessionId as s } from './campaign';

export const clues: CampaignClue[] = [
  {
    id: 'clue-repeating-landmarks',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Three Landmarks That Repeat',
    priority: 'low',
    status: 'resolved',
    meaning:
      'The fen loops travelers until they surrender a memory at the drowned shrine. The party paid; the price is now recorded on each of their sheets.',
    sourceHandoutIds: ['handout-ferrymans-lantern-tag'],
    relatedQuestIds: ['quest-follow-the-blue-lantern'],
    locationIds: ['location-drowned-shrine'],
    sessionIds: [s(1)],
  },
  {
    id: 'clue-extra-births',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Five Extra Births, No Deaths',
    priority: 'high',
    status: 'partially-understood',
    meaning:
      'The register still counts births for a family that no longer exists. The party knows the family was erased; they have not yet realised the count is seven, plus one.',
    sourceHandoutIds: ['handout-births-register-extract', 'lore-fen-fever'],
    relatedQuestIds: ['quest-village-that-forgot'],
    locationIds: ['location-mourningfen-village'],
    sessionIds: [s(1), s(2)],
  },
  {
    id: 'clue-blank-funeral-page',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Page That Cannot Be Marked',
    priority: 'high',
    status: 'unresolved',
    meaning:
      'A page in Ves’s funeral records refuses ink. It matches a torn signature leaf in the Burial Society archive. Bettin Sallow reacted to it.',
    sourceHandoutIds: ['handout-blank-funeral-page'],
    relatedQuestIds: ['quest-village-that-forgot'],
    locationIds: ['location-mourningfen-village'],
    sessionIds: [s(1), s(3)],
  },
  {
    id: 'clue-lamp-oil-tithe',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Oil Bought for Lamps Nobody Lights',
    priority: 'medium',
    status: 'unresolved',
    meaning:
      'The Wardens purchase far more lamp oil than the marsh lamps burn. The surplus goes to the well on the night of the tithe.',
    sourceHandoutIds: ['handout-wardens-tithe-tally'],
    relatedQuestIds: ['quest-village-that-forgot', 'quest-the-eighth-voice'],
    locationIds: ['location-wardens-lamp-house'],
    sessionIds: [s(1), s(3)],
  },
  {
    id: 'clue-ferry-toll-coin',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Toll Coin With a Worn Face',
    priority: 'medium',
    status: 'unresolved',
    meaning:
      'Odo’s last fare paid with a coin whose face has been rubbed smooth on purpose. The passenger did not want to be remembered.',
    sourceHandoutIds: ['handout-ferrymans-lantern-tag'],
    relatedQuestIds: ['quest-ferrymans-last-fare'],
    locationIds: ['location-crossing-ferry-landing', 'location-drowned-shrine'],
    sessionIds: [s(1), s(3)],
  },
  {
    id: 'clue-mirror-covers',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'Rooms Move When Mirrors Are Covered',
    priority: 'medium',
    status: 'partially-understood',
    meaning:
      'Covering a mirror shifts the house to the layout of the person whose portrait belongs to it. The intended solution is to restore every portrait to its proper room.',
    sourceHandoutIds: ['handout-family-portrait-frames'],
    relatedQuestIds: ['quest-what-the-house-remembers'],
    locationIds: ['location-verrow-homestead', 'location-homestead-nursery'],
    sessionIds: [s(2)],
  },
  {
    id: 'clue-eighth-verse',
    campaignId: MOURNINGFEN_CAMPAIGN_ID,
    title: 'The Verse That Names an Eighth',
    priority: 'high',
    status: 'unresolved',
    meaning:
      'The rhyme counts seven Verrows and then stops. The eighth voice is not a family member. It is the thing the bargain was made with.',
    sourceHandoutIds: ['handout-counting-rhyme', 'lore-forgetting-bargain'],
    relatedQuestIds: [
      'quest-what-the-house-remembers',
      'quest-the-eighth-voice',
    ],
    locationIds: ['location-homestead-nursery', 'location-verrow-well'],
    sessionIds: [s(2), s(4)],
  },
];

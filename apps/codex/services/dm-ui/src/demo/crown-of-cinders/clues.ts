import type { CampaignClue } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID, crownSessionId } from './campaign';

export const crownClues: CampaignClue[] = [
  {
    id: 'clue-heirs-contradictions',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Three Contradictory Rumors',
    priority: 'high',
    status: 'unresolved',
    meaning:
      'Each heir is accused of a different secret; only Ysolde’s unpaid war loan links to someone who wanted the coronation disrupted.',
    sourceHandoutIds: [
      'handout-coronation-program',
      'handout-crown-voice-transcript',
    ],
    relatedQuestIds: ['quest-who-wears-the-crown'],
    locationIds: ['location-hall-of-nine-banners'],
    sessionIds: [crownSessionId(1), crownSessionId(3)],
  },
  {
    id: 'clue-flame-signal',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'The Lamp-Flame Signal',
    priority: 'high',
    status: 'unresolved',
    meaning:
      'The assassins lit their curtains with a Soot Hands guild signal, but the sequence is a decade out of date; someone copied an old code.',
    sourceHandoutIds: ['handout-flame-signal-sketch'],
    relatedQuestIds: ['quest-trace-the-cinder-assassins'],
    locationIds: ['location-guttered-candle', 'location-ashwater-quay'],
    sessionIds: [crownSessionId(1), crownSessionId(2)],
  },
  {
    id: 'clue-unquenched-brand',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Brand of the Unquenched',
    priority: 'medium',
    status: 'unresolved',
    meaning:
      'A three-flame brand under the wights’ collarbones matches a symbol scratched inside the Ember Cloister archive.',
    sourceHandoutIds: ['lore-unquenched-creed'],
    relatedQuestIds: [
      'quest-trace-the-cinder-assassins',
      'quest-who-wears-the-crown',
      'quest-crown-remembers',
    ],
    locationIds: ['location-hall-of-nine-banners', 'location-ashen-catacombs'],
    sessionIds: [crownSessionId(1), crownSessionId(5)],
  },
  {
    id: 'clue-dead-prince-seal',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'Seal of Prince Aurel',
    priority: 'medium',
    status: 'unresolved',
    meaning:
      'The genealogy carries a royal seal ring that was buried with Prince Aurel; either the grave was opened or the seal was never buried.',
    sourceHandoutIds: ['handout-sealed-genealogy'],
    relatedQuestIds: ['quest-dead-princes-genealogy'],
    locationIds: ['location-ashwater-quay', 'location-gilded-exchange'],
    sessionIds: [crownSessionId(1), crownSessionId(3)],
  },
  {
    id: 'clue-burn-list',
    campaignId: CROWN_CAMPAIGN_ID,
    title: 'The Crown’s Burn List',
    priority: 'low',
    status: 'unresolved',
    meaning:
      'The crown recites names in its sleep; nine rulers in nine generations, and the Wardens’ founders are among the accomplices.',
    sourceHandoutIds: ['lore-burned-rulers-roll'],
    relatedQuestIds: ['quest-crown-remembers'],
    locationIds: ['location-crown-vault'],
    sessionIds: [crownSessionId(4)],
  },
];

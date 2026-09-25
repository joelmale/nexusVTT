import type { CampaignClue } from './types';

export const clues: CampaignClue[] = [
  {
    id: 'clue-strange-symbol',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Strange Symbol on Crate',
    priority: 'high',
    status: 'partially-understood',
    meaning:
      'The mark combines Ashen Synod ash script with a seal used by the drowned royal house.',
    sourceHandoutIds: ['handout-burned-shipping-ledger', 'lore-azure-compact'],
    relatedQuestIds: ['quest-find-ember-key', 'quest-fractured-spire'],
    locationIds: ['location-harbor-warehouse', 'location-fishmongers-row'],
    sessionIds: ['session-10', 'session-11', 'session-12'],
  },
  {
    id: 'clue-smuggler-note',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Note from the Smuggler',
    priority: 'medium',
    status: 'unresolved',
    meaning:
      'Mentions a key, an eastern-pier rendezvous, and the phrase "third bell."',
    sourceHandoutIds: [
      'handout-burned-shipping-ledger',
      'handout-harbormasters-warning',
    ],
    relatedQuestIds: ['quest-find-ember-key', 'quest-a-debt-in-blood'],
    locationIds: ['location-south-pier', 'location-north-docks'],
    sessionIds: ['session-11', 'session-12'],
  },
  {
    id: 'clue-sahuagin-activity',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Sahuagin Activity',
    priority: 'medium',
    status: 'unresolved',
    meaning:
      'Patrols avoid one submerged route directly below the Old Customs House.',
    sourceHandoutIds: ['lore-bell-rhyme-shoals'],
    relatedQuestIds: ['quest-find-ember-key', 'quest-whispers-beneath-veyra'],
    locationIds: ['location-south-pier', 'location-old-customs-house'],
    sessionIds: ['session-3', 'session-12', 'session-13'],
  },
  {
    id: 'clue-broken-compass',
    campaignId: 'campaign-ashes-of-veyra',
    title: 'Broken Compass',
    priority: 'low',
    status: 'unresolved',
    meaning:
      'Its needle points inland toward the Fractured Spire instead of north.',
    sourceHandoutIds: [],
    relatedQuestIds: ['quest-fractured-spire'],
    locationIds: ['location-north-docks', 'location-glass-harbor'],
    sessionIds: ['session-4', 'session-8'],
  },
];

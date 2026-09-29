import type { FolderRecord, LibraryObject } from '../ashes-of-veyra/types';
import { CROWN_CAMPAIGN_ID } from './campaign';

const ACT_1 = `${CROWN_CAMPAIGN_ID}-act-1`;
const ACT_2 = `${CROWN_CAMPAIGN_ID}-act-2`;
const ACT_3 = `${CROWN_CAMPAIGN_ID}-act-3`;

export const crownLibraryObjects: LibraryObject[] = [
  {
    id: 'scene-hall-of-nine-banners',
    title: 'The Hall of Nine Banners',
    kind: 'scene',
    folderActId: ACT_1,
    updatedLabel: '20 minutes ago',
  },
  {
    id: 'scene-guttered-candle-cellar',
    title: 'The Guttered Candle Cellar',
    kind: 'scene',
    folderActId: ACT_1,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'scene-crown-vault-template',
    title: 'Crown Vault (template)',
    kind: 'scene',
    folderActId: ACT_2,
    updatedLabel: '3 days ago',
  },
  {
    id: 'npc-corvin-vell',
    title: 'Prince Corvin Vell',
    kind: 'npc',
    folderActId: ACT_1,
    updatedLabel: '1 hour ago',
  },
  {
    id: 'npc-the-crown',
    title: 'The Crown of Cinders',
    kind: 'npc',
    folderActId: ACT_1,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'encounter-cinder-wights-dais',
    title: 'Cinder Wights at the Dais',
    kind: 'encounter',
    folderActId: ACT_1,
    updatedLabel: '20 minutes ago',
  },
  {
    id: 'handout-crown-voice-transcript',
    title: 'The Crown Speaks (transcript)',
    kind: 'handout',
    folderActId: ACT_1,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'handout-sealed-genealogy',
    title: 'The Sealed Genealogy',
    kind: 'handout',
    folderActId: ACT_1,
    updatedLabel: '2 days ago',
  },
  {
    id: 'lore-burned-rulers-roll',
    title: 'Roll of the Burned Rulers',
    kind: 'lore',
    folderActId: ACT_2,
    updatedLabel: '3 days ago',
  },
  {
    id: 'faction-ember-wardens',
    title: 'The Ember Wardens',
    kind: 'faction',
    folderActId: ACT_1,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'quest-who-wears-the-crown',
    title: 'Who Wears the Crown',
    kind: 'quest',
    folderActId: ACT_1,
    updatedLabel: 'Today',
  },
];

export const crownFolders: FolderRecord[] = [
  {
    id: 'folder-crown-act-one',
    title: 'Act I - The Investiture',
    actId: ACT_1,
    objectIds: [
      'scene-hall-of-nine-banners',
      'scene-guttered-candle-cellar',
      'npc-corvin-vell',
      'npc-the-crown',
      'encounter-cinder-wights-dais',
      'handout-crown-voice-transcript',
      'handout-sealed-genealogy',
      'faction-ember-wardens',
      'quest-who-wears-the-crown',
    ],
    children: [
      { kind: 'scene', count: 3 },
      { kind: 'npc', count: 6 },
      { kind: 'encounter', count: 3 },
      { kind: 'handout', count: 4 },
    ],
  },
  {
    id: 'folder-crown-act-two',
    title: 'Act II - A Court of Knives',
    actId: ACT_2,
    objectIds: ['scene-crown-vault-template', 'lore-burned-rulers-roll'],
    children: [
      { kind: 'scene', count: 2 },
      { kind: 'npc', count: 3 },
      { kind: 'encounter', count: 1 },
      { kind: 'handout', count: 2 },
    ],
  },
  {
    id: 'folder-crown-act-three',
    title: 'Act III - The Crown Remembers',
    actId: ACT_3,
    objectIds: [],
    children: [
      { kind: 'scene', count: 1 },
      { kind: 'npc', count: 1 },
      { kind: 'encounter', count: 1 },
      { kind: 'handout', count: 2 },
    ],
  },
];

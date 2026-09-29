import type { FolderRecord, LibraryObject } from '../ashes-of-veyra/types';
import {
  MOURNINGFEN_ACT_1_ID,
  MOURNINGFEN_ACT_2_ID,
  MOURNINGFEN_ACT_3_ID,
} from './campaign';

export const libraryObjects: LibraryObject[] = [
  {
    id: 'scene-mourningfen-lantern-path',
    title: 'The Lantern Path',
    kind: 'scene',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: '6 weeks ago',
  },
  {
    id: 'scene-verrow-homestead-loop',
    title: 'Verrow Homestead: Room Loop',
    kind: 'scene',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'npc-hesper-crane',
    title: 'Reeve Hesper Crane',
    kind: 'npc',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: '4 weeks ago',
  },
  {
    id: 'npc-pim-verrow',
    title: 'Pim Verrow',
    kind: 'npc',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'encounter-shifting-rooms',
    title: 'The Shifting Rooms',
    kind: 'encounter',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'encounter-reedbound-procession',
    title: 'The Reedbound Procession',
    kind: 'encounter',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: '6 weeks ago',
  },
  {
    id: 'handout-counting-rhyme',
    title: "Pim's Counting Rhyme",
    kind: 'handout',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'handout-wardens-tithe-tally',
    title: "Tamsin's Folded Tally",
    kind: 'handout',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: '5 weeks ago',
  },
  {
    id: 'lore-forgetting-bargain',
    title: 'The Forgetting Bargain',
    kind: 'lore',
    folderActId: MOURNINGFEN_ACT_2_ID,
    updatedLabel: '3 weeks ago',
  },
  {
    id: 'faction-lantern-wardens',
    title: 'The Lantern Wardens',
    kind: 'faction',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: '4 weeks ago',
  },
  {
    id: 'quest-what-the-house-remembers',
    title: 'What the House Remembers',
    kind: 'quest',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'quest-village-that-forgot',
    title: 'The Village That Forgot',
    kind: 'quest',
    folderActId: MOURNINGFEN_ACT_1_ID,
    updatedLabel: '5 weeks ago',
  },
];

export const folders: FolderRecord[] = [
  {
    id: 'folder-mf-act-one',
    title: 'Act I - What the Fen Kept',
    actId: MOURNINGFEN_ACT_1_ID,
    objectIds: [
      'scene-mourningfen-lantern-path',
      'scene-verrow-homestead-loop',
      'npc-hesper-crane',
      'npc-pim-verrow',
      'encounter-shifting-rooms',
      'encounter-reedbound-procession',
      'handout-counting-rhyme',
      'handout-wardens-tithe-tally',
      'faction-lantern-wardens',
      'quest-what-the-house-remembers',
      'quest-village-that-forgot',
    ],
    children: [
      { kind: 'scene', count: 3 },
      { kind: 'npc', count: 6 },
      { kind: 'encounter', count: 4 },
      { kind: 'handout', count: 4 },
    ],
  },
  {
    id: 'folder-mf-act-two',
    title: 'Act II - The Eighth Voice',
    actId: MOURNINGFEN_ACT_2_ID,
    objectIds: ['lore-forgetting-bargain'],
    children: [
      { kind: 'scene', count: 2 },
      { kind: 'npc', count: 3 },
      { kind: 'encounter', count: 2 },
      { kind: 'handout', count: 2 },
    ],
  },
  {
    id: 'folder-mf-act-three',
    title: 'Act III - The Naming',
    actId: MOURNINGFEN_ACT_3_ID,
    objectIds: [],
    children: [
      { kind: 'scene', count: 1 },
      { kind: 'npc', count: 2 },
      { kind: 'encounter', count: 2 },
      { kind: 'handout', count: 1 },
    ],
  },
];

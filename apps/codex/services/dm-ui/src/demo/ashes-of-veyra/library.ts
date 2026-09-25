import type { FolderRecord, LibraryObject } from './types';

export const libraryObjects: LibraryObject[] = [
  {
    id: 'scene-glass-harbor-docks',
    title: 'Glass Harbor Docks',
    kind: 'scene',
    folderActId: 'act-glass-harbor',
    updatedLabel: 'Today',
  },
  {
    id: 'npc-captain-serin',
    title: 'Captain Serin',
    kind: 'npc',
    folderActId: 'act-glass-harbor',
    updatedLabel: '42 minutes ago',
  },
  {
    id: 'encounter-dockside-ambush',
    title: 'Dockside Ambush',
    kind: 'encounter',
    folderActId: 'act-glass-harbor',
    updatedLabel: '18 minutes ago',
  },
  {
    id: 'handout-burned-shipping-ledger',
    title: 'Burned Shipping Ledger',
    kind: 'handout',
    folderActId: 'act-glass-harbor',
    updatedLabel: 'Today',
  },
  {
    id: 'faction-azure-compact',
    title: 'The Azure Compact',
    kind: 'lore',
    folderActId: 'act-fractured-tides',
    updatedLabel: 'Yesterday',
  },
  {
    id: 'npc-selka-marr',
    title: 'Selka Marr',
    kind: 'npc',
    folderActId: 'act-glass-harbor',
    updatedLabel: 'Yesterday',
  },
  {
    id: 'handout-harbormasters-warning',
    title: "Harbormaster's Warning",
    kind: 'handout',
    folderActId: 'act-glass-harbor',
    updatedLabel: 'Today',
  },
  {
    id: 'quest-find-ember-key',
    title: 'Find the Ember Key',
    kind: 'quest',
    folderActId: 'act-glass-harbor',
    updatedLabel: 'Today',
  },
];

export const folders: FolderRecord[] = [
  {
    id: 'folder-act-one',
    title: 'Act I - Fractured Tides',
    actId: 'act-fractured-tides',
    objectIds: ['faction-azure-compact'],
    children: [
      { kind: 'scene', count: 6 },
      { kind: 'npc', count: 8 },
      { kind: 'encounter', count: 4 },
      { kind: 'handout', count: 3 },
    ],
  },
  {
    id: 'folder-act-two',
    title: 'Act II - The Glass Harbor',
    actId: 'act-glass-harbor',
    objectIds: [
      'scene-glass-harbor-docks',
      'npc-captain-serin',
      'npc-selka-marr',
      'encounter-dockside-ambush',
      'handout-burned-shipping-ledger',
      'handout-harbormasters-warning',
      'quest-find-ember-key',
    ],
    children: [
      { kind: 'scene', count: 7 },
      { kind: 'npc', count: 12 },
      { kind: 'encounter', count: 5 },
      { kind: 'handout', count: 6 },
    ],
  },
  {
    id: 'folder-act-three',
    title: 'Act III - The Hollow Crown',
    actId: 'act-hollow-crown',
    objectIds: [],
    children: [
      { kind: 'scene', count: 5 },
      { kind: 'npc', count: 8 },
      { kind: 'encounter', count: 3 },
      { kind: 'handout', count: 5 },
    ],
  },
];

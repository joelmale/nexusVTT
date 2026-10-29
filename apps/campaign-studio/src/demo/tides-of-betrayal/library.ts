import type { FixtureId, FolderRecord, LibraryObject } from '../ashes-of-veyra/types';
import { TIDES_CAMPAIGN_ID } from './campaign';
import { tidesEncounters } from './encounters';
import { tidesFactions } from './factions';
import { tidesHandouts } from './handouts';
import { tidesNpcs } from './npcs';
import { tidesQuests } from './quests';
import { tidesSessions } from './sessions';

const ACT_1 = `${TIDES_CAMPAIGN_ID}-act-1`;
const ACT_2 = `${TIDES_CAMPAIGN_ID}-act-2`;
const ACT_3 = `${TIDES_CAMPAIGN_ID}-act-3`;

/** Files an object under the act of the first session that uses it. */
const actFor = (sessionIds: readonly FixtureId[]): FixtureId =>
  tidesSessions.find((session) => sessionIds.includes(session.id))?.actId ??
  ACT_1;

const sceneTemplates: LibraryObject[] = [
  {
    id: 'scene-dock-ward-arrival',
    title: 'Arrival in the Dock Ward',
    kind: 'scene',
    folderActId: ACT_1,
    updatedLabel: '3 weeks ago',
  },
  {
    id: 'scene-sirens-cove-landing',
    title: 'Siren’s Cove at the Ebb',
    kind: 'scene',
    folderActId: ACT_1,
    updatedLabel: '1 week ago',
  },
  {
    id: 'scene-council-masque',
    title: 'The Midsummer Masque',
    kind: 'scene',
    folderActId: ACT_1,
    updatedLabel: '1 hour ago',
  },
  {
    id: 'scene-drowned-market',
    title: 'The Drowned Market',
    kind: 'scene',
    folderActId: ACT_2,
    updatedLabel: 'Yesterday',
  },
  {
    id: 'scene-gilded-gull-deck',
    title: 'Deck of the Gilded Gull',
    kind: 'scene',
    folderActId: ACT_2,
    updatedLabel: '2 days ago',
  },
  {
    id: 'scene-blackwater-reach',
    title: 'Blackwater Reach',
    kind: 'scene',
    folderActId: ACT_2,
    updatedLabel: '4 days ago',
  },
  {
    id: 'scene-sunken-spire-nave',
    title: 'Nave of the Sunken Spire',
    kind: 'scene',
    folderActId: ACT_3,
    updatedLabel: '1 week ago',
  },
  {
    id: 'scene-widows-lantern-gallery',
    title: 'Gallery of the Widow’s Lantern',
    kind: 'scene',
    folderActId: ACT_3,
    updatedLabel: '1 week ago',
  },
];

export const tidesLibraryObjects: LibraryObject[] = [
  ...sceneTemplates,
  ...tidesNpcs.map((npc) => ({
    id: npc.id,
    title: npc.name,
    kind: 'npc' as const,
    folderActId: actFor(npc.sessionIds),
    updatedLabel: 'This month',
  })),
  ...tidesEncounters.map((encounter) => ({
    id: encounter.id,
    title: encounter.title,
    kind: 'encounter' as const,
    folderActId: actFor(encounter.sessionIds),
    updatedLabel: 'This month',
  })),
  ...tidesHandouts.map((handout) => ({
    id: handout.id,
    title: handout.title,
    kind: handout.kind,
    folderActId: actFor(handout.sessionIds),
    updatedLabel: 'This month',
  })),
  ...tidesFactions.map((faction) => ({
    id: faction.id,
    title: faction.name,
    kind: 'faction' as const,
    folderActId: actFor(
      tidesQuests
        .filter((quest) => faction.questIds.includes(quest.id))
        .flatMap((quest) => quest.sessionIds),
    ),
    updatedLabel: 'This month',
  })),
  ...tidesQuests.map((quest) => ({
    id: quest.id,
    title: quest.title,
    kind: 'quest' as const,
    folderActId: actFor(quest.sessionIds),
    updatedLabel: 'This month',
  })),
];

const objectIdsForAct = (actId: string): string[] =>
  tidesLibraryObjects
    .filter((object) => object.folderActId === actId)
    .map((object) => object.id);

const childCounts = (actId: string): FolderRecord['children'] => {
  const objects = tidesLibraryObjects.filter(
    (object) => object.folderActId === actId,
  );
  const count = (kinds: LibraryObject['kind'][]): number =>
    objects.filter((object) => kinds.includes(object.kind)).length;
  return [
    { kind: 'scene', count: count(['scene']) },
    { kind: 'npc', count: count(['npc']) },
    { kind: 'encounter', count: count(['encounter']) },
    { kind: 'handout', count: count(['handout', 'lore']) },
  ];
};

export const tidesFolders: FolderRecord[] = [
  {
    id: 'folder-tides-act-one',
    title: 'Act I - Whispers in the Harbor',
    actId: ACT_1,
    objectIds: objectIdsForAct(ACT_1),
    children: childCounts(ACT_1),
  },
  {
    id: 'folder-tides-act-two',
    title: 'Act II - Blood in the Water',
    actId: ACT_2,
    objectIds: objectIdsForAct(ACT_2),
    children: childCounts(ACT_2),
  },
  {
    id: 'folder-tides-act-three',
    title: 'Act III - The Tidecaller’s Wake',
    actId: ACT_3,
    objectIds: objectIdsForAct(ACT_3),
    children: childCounts(ACT_3),
  },
];

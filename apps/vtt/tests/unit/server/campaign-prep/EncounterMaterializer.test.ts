import { describe, expect, it, vi } from 'vitest';

import {
  EncounterMaterializationError,
  EncounterMaterializer,
  parseMonsterStats,
} from '../../../../server/campaign-prep/EncounterMaterializer.js';

const CAMPAIGN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENCOUNTER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const USER = '11111111-1111-4111-8111-111111111111';

const GOBLIN = {
  key: 'srd:goblin',
  name: 'Goblin',
  cr: '1/4',
  ac: 15,
  hp: 7,
  speed: 30,
  abilities: [8, 14, 10, 10, 8, 8],
};

const ASH_HOUND = {
  key: 'srd:ash-hound',
  name: 'Ash Hound',
  cr: '1/2',
  ac: 13,
  hp: 18,
  speed: 40,
  abilities: [13, 15, 12, 6, 12, 7],
};

function encounterData(composition: unknown[]) {
  return {
    content: { value: { nexusStudio: { fields: { composition } } } },
  };
}

interface LibraryRecord {
  id: string;
  ownerId: string;
  campaignId: string | null;
  kind: string;
  name: string;
  currentRevision: number;
  isArchived: boolean;
}

interface LibraryRevision {
  objectId: string;
  revision: number;
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function setup(options: { composition?: unknown[]; kind?: string } = {}) {
  const library = new Map<string, LibraryRecord>();
  const revisions = new Map<string, LibraryRevision[]>();
  const libraryObjects = {
    getObjectById: vi.fn(async (id: string) => library.get(id) ?? null),
    getRevision: vi.fn(
      async (id: string, revision: number) =>
        (revisions.get(id) ?? []).find((rev) => rev.revision === revision) ??
        null,
    ),
    createObject: vi.fn(
      async (
        object: Omit<LibraryRecord, 'id' | 'currentRevision' | 'isArchived'>,
        initial: { data: LibraryRevision['data'] },
        id: string,
      ) => {
        const record: LibraryRecord = {
          ...object,
          id,
          currentRevision: 1,
          isArchived: false,
        };
        library.set(id, record);
        revisions.set(id, [{ objectId: id, revision: 1, data: initial.data }]);
        return { object: record, revision: { objectId: id, revision: 1 } };
      },
    ),
    addRevision: vi.fn(
      async (id: string, _ruleset: unknown, data: LibraryRevision['data']) => {
        const record = library.get(id)!;
        record.currentRevision += 1;
        const rev: LibraryRevision = {
          objectId: id,
          revision: record.currentRevision,
          // jsonb hands keys back in its own order, so round-trip the payload
          data: JSON.parse(JSON.stringify(data)),
        };
        revisions.get(id)!.push(rev);
        return rev;
      },
    ),
  };
  const campaignPrep = {
    getObject: vi.fn(async () => ({
      id: ENCOUNTER,
      campaignId: CAMPAIGN,
      kind: options.kind ?? 'encounter',
      title: 'Dock ambush',
      currentRevision: 3,
    })),
    getRevision: vi.fn(async () => ({
      data: encounterData(
        options.composition ?? [
          { name: 'Goblin', count: 3, monsterKey: 'srd:goblin', cr: '1/4' },
          { name: 'Ash Hound', count: 1, monsterKey: 'srd:ash-hound', cr: '1/2' },
        ],
      ),
    })),
  };
  const materializer = new EncounterMaterializer({
    campaignPrep: campaignPrep as never,
    libraryObjects: libraryObjects as never,
  });
  const run = (monsters: unknown = [GOBLIN, ASH_HOUND]) =>
    materializer.materialize({
      campaignId: CAMPAIGN,
      objectId: ENCOUNTER,
      principalId: USER,
      monsters,
    });
  return { run, libraryObjects, library, revisions };
}

describe('EncounterMaterializer', () => {
  it('creates library monsters and an encounter that deploy can read', async () => {
    const { run, library, revisions } = setup();
    const result = await run();

    expect(result).toMatchObject({
      encounterRef: { kind: 'encounter', id: ENCOUNTER, revision: 1 },
      monsterCount: 2,
      created: true,
    });
    const encounter = revisions.get(ENCOUNTER)![0].data;
    expect(encounter.groups).toHaveLength(2);
    expect(encounter.groups[0]).toMatchObject({ count: 3, faction: 'hostile' });
    const goblinId = encounter.groups[0].monsterRef.id;
    expect(library.get(goblinId)).toMatchObject({
      kind: 'monster',
      campaignId: CAMPAIGN,
      ownerId: USER,
      name: 'Goblin',
    });
    // The shape DomainCommandService.handleDeployEncounter reads.
    expect(revisions.get(goblinId)![0].data).toMatchObject({
      name: 'Goblin',
      hitPoints: { average: 7 },
      armorClass: [{ value: 15 }],
      speed: { walk: 30 },
      abilities: {
        dex: { score: 14, modifier: 2 },
        str: { score: 8, modifier: -1 },
      },
      source: 'srd',
    });
    const ashHoundId = encounter.groups[1].monsterRef.id;
    expect(library.get(ashHoundId)).toMatchObject({
      kind: 'monster',
      campaignId: CAMPAIGN,
      ownerId: USER,
      name: 'Ash Hound',
    });
    expect(revisions.get(ashHoundId)![0].data).toMatchObject({
      name: 'Ash Hound',
      hitPoints: { average: 18 },
      armorClass: [{ value: 13 }],
      speed: { walk: 40 },
    });
  });

  it('never spawns hazards or lair actions', async () => {
    const { run, revisions } = setup({
      composition: [
        { name: 'Goblin', count: 1, monsterKey: 'srd:goblin', cr: '1/4' },
        { name: 'Grasping Tide', count: 1, nonCreature: true },
      ],
    });
    const result = await run([GOBLIN]);
    expect(result.monsterCount).toBe(1);
    expect(revisions.get(ENCOUNTER)![0].data.groups).toHaveLength(1);
  });

  it('is idempotent: re-running adds no revisions', async () => {
    const { run, libraryObjects } = setup();
    const first = await run();
    const second = await run();
    expect(second.encounterRef).toEqual(first.encounterRef);
    expect(second.created).toBe(false);
    expect(libraryObjects.addRevision).not.toHaveBeenCalled();
    expect(libraryObjects.createObject).toHaveBeenCalledTimes(3);
  });

  it('adds a revision when a stat block changes and pins the new revision', async () => {
    const { run, libraryObjects } = setup();
    await run();
    const result = await run([{ ...GOBLIN, hp: 12 }, ASH_HOUND]);
    // goblin, then the encounter that points at the new goblin revision
    expect(libraryObjects.addRevision).toHaveBeenCalledTimes(2);
    expect(result.encounterRef.revision).toBe(2);
  });

  it('marks homebrew monsters', async () => {
    const { run, revisions } = setup({
      composition: [
        { name: 'Gloomwing', count: 1, monsterKey: 'homebrew:abc', cr: '1/2' },
      ],
    });
    await run([
      { ...GOBLIN, key: 'homebrew:abc', name: 'Gloomwing', cr: '1/2' },
    ]);
    const group = revisions.get(ENCOUNTER)![0].data.groups[0];
    expect(revisions.get(group.monsterRef.id)![0].data.source).toBe('homebrew');
  });

  it('rejects an encounter with an unlinked creature', async () => {
    const { run } = setup({
      composition: [
        { name: 'Goblin', count: 3, monsterKey: 'srd:goblin', cr: '1/4' },
        { name: 'Unlinked Beast', count: 1 },
      ],
    });
    await expect(run()).rejects.toThrowError(
      /Link these monsters to the catalog or a homebrew monster before publishing: Unlinked Beast/,
    );
  });

  it('rejects an encounter when monster stats are missing from client payload', async () => {
    const { run } = setup();
    await expect(run([GOBLIN])).rejects.toThrowError(
      /Stat blocks missing for: Ash Hound/,
    );
  });

  it('handles multiple encounters in the same campaign with different monster stats', async () => {
    const ENCOUNTER_2 = '22222222-2222-4222-8222-222222222222';
    const { run, libraryObjects, revisions } = setup();
    const firstResult = await run();
    expect(firstResult.encounterRef.revision).toBe(1);

    const firstEncounterData = revisions.get(ENCOUNTER)![0].data;
    const goblinId = firstEncounterData.groups[0].monsterRef.id;
    expect(firstEncounterData.groups[0].monsterRef.revision).toBe(1);

    const campaignPrep2 = {
      getObject: vi.fn(async () => ({
        id: ENCOUNTER_2,
        campaignId: CAMPAIGN,
        kind: 'encounter',
        title: 'Boss lair',
        currentRevision: 1,
      })),
      getRevision: vi.fn(async () => ({
        data: encounterData([
          { name: 'Buffed Goblin', count: 1, monsterKey: 'srd:goblin', cr: '1' },
        ]),
      })),
    };
    const mat2 = new EncounterMaterializer({
      campaignPrep: campaignPrep2 as never,
      libraryObjects: libraryObjects as never,
    });
    const secondResult = await mat2.materialize({
      campaignId: CAMPAIGN,
      objectId: ENCOUNTER_2,
      principalId: USER,
      monsters: [{ ...GOBLIN, hp: 25, cr: '1' }],
    });

    expect(secondResult.encounterRef.revision).toBe(1);
    const secondEncounterData = revisions.get(ENCOUNTER_2)![0].data;
    expect(secondEncounterData.groups[0].monsterRef.id).toBe(goblinId);
    expect(secondEncounterData.groups[0].monsterRef.revision).toBe(2);

    // Verify first encounter still has its pinned reference to revision 1
    expect(revisions.get(ENCOUNTER)![0].data.groups[0].monsterRef.revision).toBe(1);
    expect(revisions.get(goblinId)![0].data.hitPoints.average).toBe(7);
    expect(revisions.get(goblinId)![1].data.hitPoints.average).toBe(25);
  });

  it('rejects other kinds, empty encounters, and objects owned elsewhere', async () => {
    await expect(setup({ kind: 'npc' }).run()).rejects.toMatchObject({
      code: 'not-an-encounter',
    });
    await expect(setup({ composition: [] }).run()).rejects.toMatchObject({
      code: 'invalid-payload',
    });
    const { run, library } = setup();
    await run();
    library.get(ENCOUNTER)!.ownerId = '99999999-9999-4999-8999-999999999999';
    await expect(run()).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('parseMonsterStats', () => {
  it('accepts valid stat blocks and treats missing as empty', () => {
    expect(parseMonsterStats([GOBLIN])).toEqual([GOBLIN]);
    expect(parseMonsterStats(undefined)).toEqual([]);
  });

  it.each([
    ['not an array', { key: 'x' }],
    ['bad cr', [{ ...GOBLIN, cr: 'huge' }]],
    ['hp zero', [{ ...GOBLIN, hp: 0 }]],
    ['short abilities', [{ ...GOBLIN, abilities: [10, 10] }]],
    ['non-object', ['goblin']],
    ['missing name', [{ ...GOBLIN, name: ' ' }]],
  ])('rejects %s', (_label, input) => {
    expect(() => parseMonsterStats(input)).toThrow(
      EncounterMaterializationError,
    );
  });
});

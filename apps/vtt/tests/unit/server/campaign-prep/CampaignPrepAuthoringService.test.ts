import { describe, expect, it, vi } from 'vitest';

import {
  CampaignPrepAuthoringError,
  CampaignPrepAuthoringService,
} from '../../../../server/campaign-prep/CampaignPrepAuthoringService.js';
import { CampaignPrepRevisionConflictError } from '../../../../server/repositories/CampaignPrepRepository.js';

const IDS = {
  campaign: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  note: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  plan: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  scene: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
const PRINCIPAL_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const timestamp = '2026-09-25T12:00:00.000Z';

function note(revision = 1) {
  return {
    id: IDS.note,
    campaignId: IDS.campaign,
    schemaVersion: 1,
    revision,
    kind: 'note',
    title: "Harbormaster's Warning",
    visibility: 'dm-only',
    content: { format: 'lexical', schemaVersion: 1, value: {} },
    links: [
      {
        target: 'campaign-object',
        campaignId: IDS.campaign,
        id: IDS.scene,
        revision: 1,
      },
      {
        target: 'campaign-object',
        campaignId: IDS.campaign,
        id: IDS.scene,
        revision: 1,
      },
    ],
    tags: ['glass-harbor'],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function sessionPlan(status: 'draft' | 'ready' = 'draft') {
  return {
    id: IDS.plan,
    campaignId: IDS.campaign,
    schemaVersion: 1,
    revision: 1,
    title: 'Session 12 - The Glass Harbor',
    status,
    steps: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        type: 'activate-scene',
        title: 'Open the docks',
        estimatedMinutes: 5,
        visibility: 'players',
        sceneTemplateRef: {
          target: 'campaign-object',
          campaignId: IDS.campaign,
          id: IDS.scene,
          revision: 1,
        },
      },
    ],
    dependencies: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function repository() {
  return {
    addRevision: vi.fn(),
    createObject: vi.fn(),
    getObject: vi.fn(),
  };
}

describe('CampaignPrepAuthoringService', () => {
  it('creates a validated entry and deduplicates its links', async () => {
    const repo = repository();
    repo.createObject.mockResolvedValue({
      object: { id: IDS.note },
      revision: { objectId: IDS.note, revision: 1 },
    });
    const service = new CampaignPrepAuthoringService(repo);

    const result = await service.create({
      campaignId: IDS.campaign,
      kind: 'note',
      data: note(),
      principalId: PRINCIPAL_ID,
      requestId: REQUEST_ID,
    });

    expect(result.data.title).toBe("Harbormaster's Warning");
    expect(repo.createObject).toHaveBeenCalledWith(
      expect.objectContaining({
        id: IDS.note,
        campaignId: IDS.campaign,
        kind: 'note',
        status: 'draft',
      }),
      expect.objectContaining({
        revision: 1,
        dependencies: [expect.objectContaining({ id: IDS.scene })],
      }),
    );
  });

  it('records step references before the draft manifest is complete', async () => {
    const repo = repository();
    repo.createObject.mockResolvedValue({ object: {}, revision: {} });
    const service = new CampaignPrepAuthoringService(repo);

    await service.create({
      campaignId: IDS.campaign,
      kind: 'session-plan',
      data: sessionPlan(),
      principalId: PRINCIPAL_ID,
      requestId: REQUEST_ID,
    });

    expect(repo.createObject).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dependencies: [expect.objectContaining({ id: IDS.scene })],
      }),
    );
  });

  it('rejects invalid, mismatched, published, and unsupported payloads', async () => {
    const service = new CampaignPrepAuthoringService(repository());

    await expect(
      service.create({
        campaignId: IDS.campaign,
        kind: 'note',
        data: { title: '' },
        principalId: PRINCIPAL_ID,
        requestId: REQUEST_ID,
      }),
    ).rejects.toMatchObject({ code: 'invalid-payload' });

    await expect(
      service.create({
        campaignId: IDS.campaign,
        kind: 'quest',
        data: note(),
        principalId: PRINCIPAL_ID,
        requestId: REQUEST_ID,
      }),
    ).rejects.toMatchObject({ code: 'identity-mismatch' });

    await expect(
      service.create({
        campaignId: IDS.campaign,
        kind: 'session-plan',
        data: sessionPlan('ready'),
        principalId: PRINCIPAL_ID,
        requestId: REQUEST_ID,
      }),
    ).rejects.toMatchObject({ code: 'published-payload' });

    await expect(
      service.create({
        campaignId: IDS.campaign,
        kind: 'campaign-map',
        data: {},
        principalId: PRINCIPAL_ID,
        requestId: REQUEST_ID,
      }),
    ).rejects.toMatchObject({ code: 'unsupported-kind' });
  });

  it('rejects create identity drift from the route campaign', async () => {
    const service = new CampaignPrepAuthoringService(repository());
    await expect(
      service.create({
        campaignId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        kind: 'note',
        data: note(),
        principalId: PRINCIPAL_ID,
        requestId: REQUEST_ID,
      }),
    ).rejects.toBeInstanceOf(CampaignPrepAuthoringError);
  });

  it('adds a draft revision using compare-and-swap', async () => {
    const repo = repository();
    repo.getObject.mockResolvedValue({
      id: IDS.note,
      campaignId: IDS.campaign,
      kind: 'note',
      currentRevision: 1,
    });
    repo.addRevision.mockResolvedValue({
      object: { id: IDS.note, currentRevision: 2 },
      revision: { objectId: IDS.note, revision: 2 },
    });
    const service = new CampaignPrepAuthoringService(repo);

    const result = await service.revise({
      campaignId: IDS.campaign,
      objectId: IDS.note,
      expectedRevision: 1,
      data: note(2),
      principalId: PRINCIPAL_ID,
      requestId: REQUEST_ID,
    });

    expect(result.object.currentRevision).toBe(2);
    expect(repo.addRevision).toHaveBeenCalledWith(
      IDS.campaign,
      IDS.note,
      1,
      expect.objectContaining({ revision: 2, status: 'draft' }),
    );
  });

  it('reports a missing object and rejects a stale revision before parsing', async () => {
    const repo = repository();
    const service = new CampaignPrepAuthoringService(repo);
    repo.getObject.mockResolvedValueOnce(null);
    await expect(
      service.revise({
        campaignId: IDS.campaign,
        objectId: IDS.note,
        expectedRevision: 1,
        data: note(2),
        principalId: PRINCIPAL_ID,
        requestId: REQUEST_ID,
      }),
    ).rejects.toMatchObject({ code: 'not-found' });

    repo.getObject.mockResolvedValueOnce({ currentRevision: 2, kind: 'note' });
    await expect(
      service.revise({
        campaignId: IDS.campaign,
        objectId: IDS.note,
        expectedRevision: 1,
        data: note(2),
        principalId: PRINCIPAL_ID,
        requestId: REQUEST_ID,
      }),
    ).rejects.toBeInstanceOf(CampaignPrepRevisionConflictError);
  });
});

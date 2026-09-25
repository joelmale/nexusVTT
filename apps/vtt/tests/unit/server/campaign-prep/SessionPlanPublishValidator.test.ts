import type { CampaignObjectRef, SessionPlan } from '@nexus/game-contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  SessionPlanPublishValidator,
  type PrepDependencyResolver,
  type PrepDependencyResolution,
} from '../../../../server/campaign-prep/SessionPlanPublishValidator.js';

const IDS = {
  campaign: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  otherCampaign: 'abababab-abab-4bab-8bab-abababababab',
  plan: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  scene: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  note: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  encounter: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
} as const;

function createGlassHarborPlan(): SessionPlan {
  const sceneRef: CampaignObjectRef = {
    target: 'campaign-object',
    campaignId: IDS.campaign,
    id: IDS.scene,
    revision: 4,
  };
  const noteRef: CampaignObjectRef = {
    target: 'campaign-object',
    campaignId: IDS.campaign,
    id: IDS.note,
    revision: 2,
  };
  const encounterRef: CampaignObjectRef = {
    target: 'definition',
    ref: {
      kind: 'encounter',
      id: IDS.encounter,
      revision: 5,
    },
  };
  const handoutRef: CampaignObjectRef = {
    target: 'asset',
    assetId: 'asset-burned-shipping-ledger',
  };
  const rulesRef: CampaignObjectRef = {
    target: 'rules-entity',
    entityType: 'monster',
    ruleset: '2024',
    slug: 'bandit',
    catalogVersion: 1,
  };
  const documentRef: CampaignObjectRef = {
    target: 'document',
    documentId: 'document-glass-harbor-source-notes',
  };

  return {
    id: IDS.plan,
    campaignId: IDS.campaign,
    schemaVersion: 1,
    revision: 3,
    title: 'Session 12 - The Glass Harbor',
    status: 'draft',
    steps: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        type: 'activate-scene',
        title: 'Glass Harbor Docks',
        estimatedMinutes: 5,
        visibility: 'players',
        sceneTemplateRef: sceneRef,
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        type: 'open-entry',
        title: "Harbormaster's Warning",
        estimatedMinutes: 10,
        visibility: 'dm-only',
        entryRef: noteRef,
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        type: 'deploy-encounter',
        title: 'Dockside Ambush',
        estimatedMinutes: 30,
        visibility: 'dm-only',
        encounterRef: encounterRef.ref,
      },
      {
        id: '10000000-0000-4000-8000-000000000004',
        type: 'share-handout',
        title: 'Burned Shipping Ledger',
        estimatedMinutes: 5,
        visibility: 'players',
        assetRef: handoutRef,
      },
      {
        id: '10000000-0000-4000-8000-000000000005',
        type: 'reminder',
        title: 'Closing beat',
        estimatedMinutes: 5,
        visibility: 'dm-only',
        text: 'The bell sounds below the harbor at low tide.',
      },
    ],
    dependencies: [
      sceneRef,
      noteRef,
      encounterRef,
      handoutRef,
      rulesRef,
      documentRef,
    ],
    createdAt: '2026-09-25T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
  };
}

function createResolver(
  overrides = new Map<string, PrepDependencyResolution>(),
): PrepDependencyResolver & { resolve: ReturnType<typeof vi.fn> } {
  const resolve = vi.fn(
    async (reference: CampaignObjectRef): Promise<PrepDependencyResolution> => {
      const key =
        reference.target === 'campaign-object'
          ? reference.id
          : reference.target === 'definition'
            ? reference.ref.id
            : reference.target === 'asset'
              ? reference.assetId
              : reference.target;
      const overridden = overrides.get(key);
      if (overridden) {
        return overridden;
      }

      switch (reference.target) {
        case 'campaign-object':
          return {
            status: 'available',
            objectType:
              reference.id === IDS.scene ? 'scene-template' : 'campaign-entry',
          };
        case 'definition':
          return { status: 'available', objectType: 'definition' };
        case 'rules-entity':
          return { status: 'available', objectType: 'rules-entity' };
        case 'document':
          return { status: 'available', objectType: 'document' };
        case 'asset':
          return { status: 'available', objectType: 'asset' };
      }
    },
  );

  return { resolve };
}

describe('SessionPlanPublishValidator', () => {
  const context = { campaignId: IDS.campaign, principalId: 'dm-1' };

  it('accepts the complete Glass Harbor publishing manifest', async () => {
    const resolver = createResolver();
    const validator = new SessionPlanPublishValidator(resolver);

    const result = await validator.validate(createGlassHarborPlan(), context);

    expect(result.canPublish).toBe(true);
    expect(result.dependencyManifest).toHaveLength(6);
    expect(resolver.resolve).toHaveBeenCalledTimes(6);
    expect(resolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ id: IDS.scene, revision: 4 }),
      context,
    );
  });

  it('rejects malformed input before resolving dependencies', async () => {
    const resolver = createResolver();
    const validator = new SessionPlanPublishValidator(resolver);

    const result = await validator.validate({ title: 'Incomplete' }, context);

    expect(result.canPublish).toBe(false);
    expect(result.issues.every((issue) => issue.code === 'invalid-plan')).toBe(
      true,
    );
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('reports missing and forbidden dependencies together', async () => {
    const resolver = createResolver(
      new Map([
        [IDS.note, { status: 'missing' }],
        ['asset-burned-shipping-ledger', { status: 'forbidden' }],
      ]),
    );
    const validator = new SessionPlanPublishValidator(resolver);

    const result = await validator.validate(createGlassHarborPlan(), context);

    expect(result.canPublish).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['missing-dependency', 'forbidden-dependency']),
    );
  });

  it('reports a missing manifest entry and includes it in the canonical manifest', async () => {
    const plan = createGlassHarborPlan();
    plan.dependencies = plan.dependencies.filter(
      (dependency) =>
        dependency.target !== 'definition' ||
        dependency.ref.id !== IDS.encounter,
    );
    const validator = new SessionPlanPublishValidator(createResolver());

    const result = await validator.validate(plan, context);

    expect(result.canPublish).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'missing-manifest-entry' }),
    );
    expect(result.dependencyManifest).toContainEqual({
      target: 'definition',
      ref: { kind: 'encounter', id: IDS.encounter, revision: 5 },
    });
  });

  it('deduplicates the canonical dependency manifest', async () => {
    const plan = createGlassHarborPlan();
    plan.dependencies.push(plan.dependencies[0]);
    const validator = new SessionPlanPublishValidator(createResolver());

    const result = await validator.validate(plan, context);

    expect(result.canPublish).toBe(true);
    expect(result.dependencyManifest).toHaveLength(6);
  });

  it('blocks cross-campaign references without resolving them', async () => {
    const plan = createGlassHarborPlan();
    const crossCampaignRef: CampaignObjectRef = {
      target: 'campaign-object',
      campaignId: IDS.otherCampaign,
      id: '23232323-2323-4232-8232-232323232323',
      revision: 1,
    };
    plan.dependencies.push(crossCampaignRef);
    const resolver = createResolver();
    const validator = new SessionPlanPublishValidator(resolver);

    const result = await validator.validate(plan, context);

    expect(result.canPublish).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'cross-campaign-reference' }),
    );
    expect(resolver.resolve).not.toHaveBeenCalledWith(
      crossCampaignRef,
      context,
    );
  });

  it('reports route campaign mismatch and retired plans', async () => {
    const plan = createGlassHarborPlan();
    plan.status = 'retired';
    const resolver = createResolver();
    const validator = new SessionPlanPublishValidator(resolver);

    const result = await validator.validate(plan, {
      campaignId: IDS.otherCampaign,
      principalId: 'dm-1',
    });

    expect(result.canPublish).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'campaign-mismatch',
        'retired-plan',
        'cross-campaign-reference',
      ]),
    );
  });

  it('does not publish an already-ready revision again', async () => {
    const plan = createGlassHarborPlan();
    plan.status = 'ready';
    const validator = new SessionPlanPublishValidator(createResolver());

    const result = await validator.validate(plan, context);

    expect(result.canPublish).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'already-ready-plan' }),
    );
  });

  it('rejects a scene reference that resolves to the wrong object type', async () => {
    const resolver = createResolver(
      new Map([
        [IDS.scene, { status: 'available', objectType: 'campaign-entry' }],
      ]),
    );
    const validator = new SessionPlanPublishValidator(resolver);

    const result = await validator.validate(createGlassHarborPlan(), context);

    expect(result.canPublish).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'unexpected-dependency-kind',
        path: 'steps.0',
      }),
    );
  });
});

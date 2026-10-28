import { describe, expect, it } from 'vitest';
import type { SessionPlan as ContractPlan } from '@nexus/game-contracts';

import {
  authoringToContract,
  contractToAuthoring,
  draftContractPlan,
  normalizeAuthoring,
  toAuthoringVisibility,
  toContractVisibility,
} from '../authoringAdapter';

const SAMPLE_AUTHORING = {
  version: 1 as const,
  revision: 2,
  lastEdited: '2026-10-28T00:00:00.000Z',
  estimatedMinutes: 45,
  readiness: [{ id: 'ready-1', label: 'Map ready', complete: true }],
  dependencies: [{ objectId: 'enc-1', status: 'ready' as const }],
  notes: ['Watch the tide clock'],
  playerFacingSummary: 'Enter the Glass Harbor.',
  attachments: ['handout-1'],
  defaultVisibility: 'dm-only' as const,
  steps: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      order: 1,
      kind: 'recap' as const,
      track: 'main' as const,
      title: 'Opening Recap',
      durationMinutes: 15,
      visibility: 'shared' as const,
      body: 'Previously on Ashes of Veyra...',
    },
    {
      id: 'non-uuid-step-id',
      order: 2,
      kind: 'encounter' as const,
      track: 'main' as const,
      title: 'Harbor Ambush',
      durationMinutes: 30,
      visibility: 'dm-only' as const,
      objectId: 'enc-1',
      body: '   ',
    },
  ],
};

describe('authoringAdapter', () => {
  describe('visibility helpers', () => {
    it('normalizes shared and players to shared on the authoring side', () => {
      expect(toAuthoringVisibility('shared')).toBe('shared');
      expect(toAuthoringVisibility('players')).toBe('shared');
      expect(toAuthoringVisibility('dm-only')).toBe('dm-only');
      expect(toAuthoringVisibility(undefined)).toBe('dm-only');
    });

    it('normalizes shared and players to players on the contract side', () => {
      expect(toContractVisibility('shared')).toBe('players');
      expect(toContractVisibility('players')).toBe('players');
      expect(toContractVisibility('dm-only')).toBe('dm-only');
      expect(toContractVisibility(undefined)).toBe('dm-only');
    });
  });

  describe('normalizeAuthoring', () => {
    it('accepts both shared and players visibility vocabulary on read', () => {
      const parsed = normalizeAuthoring({
        ...SAMPLE_AUTHORING,
        defaultVisibility: 'players',
        steps: [
          {
            ...SAMPLE_AUTHORING.steps[0],
            visibility: 'players',
          },
          {
            ...SAMPLE_AUTHORING.steps[1],
            visibility: 'dm-only',
          },
        ],
      });

      expect(parsed.defaultVisibility).toBe('shared');
      expect(parsed.steps[0]?.visibility).toBe('shared');
      expect(parsed.steps[1]?.visibility).toBe('dm-only');
    });

    it('rejects non-object inputs via schema validation', () => {
      expect(() => normalizeAuthoring(null)).toThrow();
    });
  });

  describe('draftContractPlan / authoringToContract', () => {
    it('emits contract visibility (players | dm-only) and valid UUIDs for all steps', () => {
      const contract = draftContractPlan({
        plan: {
          ...SAMPLE_AUTHORING,
          steps: [
            { ...SAMPLE_AUTHORING.steps[0], visibility: 'players' },
            { ...SAMPLE_AUTHORING.steps[1], visibility: 'dm-only' },
          ],
        },
        id: '22222222-2222-4222-8222-222222222222',
        sessionId: '33333333-3333-4333-8333-333333333333',
        campaignId: '44444444-4444-4444-8444-444444444444',
        title: 'Session 1 Plan',
        revision: 3,
        createdAt: '2026-10-28T00:00:00.000Z',
        updatedAt: '2026-10-28T01:00:00.000Z',
      });

      expect(authoringToContract).toBe(draftContractPlan);
      expect(contract.steps).toHaveLength(2);
      expect(contract.steps[0]?.id).toBe(
        '11111111-1111-4111-8111-111111111111',
      );
      expect(contract.steps[0]?.visibility).toBe('players');
      expect(contract.steps[0]?.type).toBe('reminder');
      if (contract.steps[0]?.type === 'reminder') {
        expect(contract.steps[0].text).toBe('Previously on Ashes of Veyra...');
      }

      expect(contract.steps[1]?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(contract.steps[1]?.visibility).toBe('dm-only');
      if (contract.steps[1]?.type === 'reminder') {
        expect(contract.steps[1].text).toBe('Harbor Ambush');
      }
    });
  });

  describe('contractToAuthoring', () => {
    it('returns embedded authoring with normalized visibility and updated revision when present', () => {
      const contractPlan: ContractPlan = {
        id: '22222222-2222-4222-8222-222222222222',
        campaignId: '44444444-4444-4444-8444-444444444444',
        schemaVersion: 1,
        revision: 7,
        title: 'Session 1',
        status: 'ready',
        createdAt: '2026-10-28T00:00:00.000Z',
        updatedAt: '2026-10-28T01:00:00.000Z',
        dependencies: [],
        steps: [],
        authoring: {
          ...SAMPLE_AUTHORING,
          defaultVisibility: 'players' as unknown as 'shared',
          steps: [
            {
              ...SAMPLE_AUTHORING.steps[0],
              visibility: 'players' as unknown as 'shared',
            },
          ],
        },
      };

      const authoring = contractToAuthoring(contractPlan);
      expect(authoring.revision).toBe(7);
      expect(authoring.defaultVisibility).toBe('shared');
      expect(authoring.steps[0]?.visibility).toBe('shared');
    });

    it('maps open-entry, activate-scene, deploy-encounter, share-handout, and reminder steps when authoring is absent', () => {
      const campaignId = '44444444-4444-4444-8444-444444444444';
      const entryId = '55555555-5555-4555-8555-555555555555';
      const sceneId = '66666666-6666-4666-8666-666666666666';
      const encounterId = '77777777-7777-4777-8777-777777777777';
      const assetId = 'asset-handout-letter';

      const contractPlan: ContractPlan = {
        id: '22222222-2222-4222-8222-222222222222',
        campaignId,
        schemaVersion: 1,
        revision: 4,
        title: 'Published Plan Without Authoring',
        status: 'ready',
        createdAt: '2026-10-28T00:00:00.000Z',
        updatedAt: '2026-10-28T02:00:00.000Z',
        dependencies: [],
        steps: [
          {
            id: 'a1111111-1111-4111-8111-111111111111',
            title: 'Read Lore Note',
            estimatedMinutes: 10,
            visibility: 'dm-only',
            track: 'main',
            type: 'open-entry',
            entryRef: {
              target: 'campaign-object',
              campaignId,
              id: entryId,
              revision: 1,
            },
          },
          {
            id: 'b2222222-2222-4222-8222-222222222222',
            title: 'Harbor Docks Scene',
            estimatedMinutes: 20,
            visibility: 'players',
            track: 'main',
            type: 'activate-scene',
            sceneTemplateRef: {
              target: 'campaign-object',
              campaignId,
              id: sceneId,
              revision: 2,
            },
          },
          {
            id: 'c3333333-3333-4333-8333-333333333333',
            title: 'Smuggler Ambush',
            estimatedMinutes: 45,
            visibility: 'dm-only',
            track: 'main',
            type: 'deploy-encounter',
            encounterRef: {
              kind: 'encounter',
              id: encounterId,
              revision: 1,
            },
          },
          {
            id: 'd4444444-4444-4444-8444-444444444444',
            title: 'Harbormaster Ledger',
            estimatedMinutes: 15,
            visibility: 'players',
            track: 'parallel',
            type: 'share-handout',
            assetRef: {
              target: 'asset',
              assetId,
            },
          },
          {
            id: 'e5555555-5555-4555-8555-555555555555',
            title: 'Closing Beat',
            estimatedMinutes: 10,
            visibility: 'shared' as unknown as 'players',
            track: 'main',
            type: 'reminder',
            text: 'Award milestone level.',
          },
        ],
      };

      const authoring = contractToAuthoring(contractPlan);

      expect(authoring.version).toBe(1);
      expect(authoring.revision).toBe(4);
      expect(authoring.estimatedMinutes).toBe(100);
      expect(authoring.steps).toHaveLength(5);

      expect(authoring.steps[0]).toMatchObject({
        order: 1,
        kind: 'note',
        objectId: entryId,
        visibility: 'dm-only',
      });

      expect(authoring.steps[1]).toMatchObject({
        order: 2,
        kind: 'scene',
        sceneTemplateId: sceneId,
        visibility: 'shared',
      });

      expect(authoring.steps[2]).toMatchObject({
        order: 3,
        kind: 'encounter',
        objectId: encounterId,
        encounterId,
        visibility: 'dm-only',
      });

      expect(authoring.steps[3]).toMatchObject({
        order: 4,
        kind: 'handout',
        objectId: assetId,
        track: 'parallel',
        visibility: 'shared',
      });

      expect(authoring.steps[4]).toMatchObject({
        order: 5,
        kind: 'note',
        body: 'Award milestone level.',
        visibility: 'shared',
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CampaignPrepClient } from '../../../src/services/campaignPrepClient';

describe('CampaignPrepClient', () => {
  let client: CampaignPrepClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new CampaignPrepClient('http://localhost:5001');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getActiveSessionPlan', () => {
    it('returns plan and activation when found', async () => {
      const mockData = {
        activation: {
          id: 'act-1',
          campaignId: 'camp-1',
          sessionPlanId: 'plan-1',
          planRevision: 1,
          sessionId: 'session-12',
          currentStepIndex: 0,
          status: 'active',
        },
        plan: {
          id: 'plan-1',
          campaignId: 'camp-1',
          title: 'Glass Harbor Run',
          steps: [],
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const result = await client.getActiveSessionPlan('camp-1', 'session-12');
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/campaigns/camp-1/session-plans/active?sessionId=session-12',
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });

    it('returns null on 404 response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await client.getActiveSessionPlan('camp-1');
      expect(result).toBeNull();
    });

    it('throws on server error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Database failure',
      } as Response);

      await expect(client.getActiveSessionPlan('camp-1')).rejects.toThrow(
        'Failed to fetch active session plan (500): Database failure',
      );
    });
  });

  describe('updateActivationProgress', () => {
    it('updates progress via PATCH', async () => {
      const updatedActivation = {
        id: 'act-1',
        currentStepIndex: 2,
        stepStates: { 'step-1': { completed: true } },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activation: updatedActivation }),
      } as Response);

      const result = await client.updateActivationProgress('camp-1', 'act-1', {
        currentStepIndex: 2,
        stepStates: { 'step-1': { completed: true } },
      });

      expect(result).toEqual(updatedActivation);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/campaigns/camp-1/session-plans/activations/act-1/progress',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            currentStepIndex: 2,
            stepStates: { 'step-1': { completed: true } },
          }),
        }),
      );
    });

    it('throws error when update fails', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid step index',
      } as Response);

      await expect(
        client.updateActivationProgress('camp-1', 'act-1', {
          currentStepIndex: 99,
        }),
      ).rejects.toThrow(
        'Failed to update session plan progress (400): Invalid step index',
      );
    });

    it('can update only the session status', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          activation: { id: 'act-1', currentStepIndex: 2, status: 'completed' },
        }),
      } as Response);

      await client.updateActivationProgress('camp-1', 'act-1', {
        status: 'completed',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/activations/act-1/progress'),
        expect.objectContaining({
          body: JSON.stringify({ status: 'completed' }),
        }),
      );
    });
  });

  describe('getCampaignEntry', () => {
    it('fetches a campaign prep entry by ID', async () => {
      const response = {
        object: { id: 'entry-1', kind: 'note', title: 'Captain Serin' },
        revision: { data: { id: 'entry-1', title: 'Captain Serin' } },
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => response,
      } as Response);

      await expect(
        client.getCampaignEntry('camp-1', 'entry-1'),
      ).resolves.toEqual(response);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/campaigns/camp-1/prep/objects/entry-1',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('activateSessionPlan', () => {
    it('activates plan via POST', async () => {
      const mockResult = {
        activation: { id: 'act-1', currentStepIndex: 0 },
        plan: { id: 'plan-1', title: 'Test Plan' },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResult,
      } as Response);

      const result = await client.activateSessionPlan(
        'camp-1',
        'plan-1',
        2,
        'session-12',
      );
      expect(result).toEqual(mockResult);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/campaigns/camp-1/session-plans/plan-1/activate',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('throws error when activation fails', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => 'Plan not ready',
      } as Response);

      await expect(
        client.activateSessionPlan('camp-1', 'plan-1', 1),
      ).rejects.toThrow(
        'Failed to activate session plan (409): Plan not ready',
      );
    });
  });
});

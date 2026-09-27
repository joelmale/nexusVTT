import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryRouter } from 'react-router-dom';

import { CapabilityNoticeProvider } from '@/features/capability-notice';
import { StudioNavigationProvider } from '@/features/studio-shell/StudioNavigationProvider';
import * as campaignPrepApi from '@/services/campaign-prep-api';
import { SessionPlanRoute } from './SessionPlanRoute';

vi.mock('@/services/campaign-prep-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/campaign-prep-api')>();
  return {
    ...actual,
    activateSessionPlan: vi.fn(),
    fetchSessionPlanStatus: vi.fn(),
    publishSessionPlan: vi.fn(),
  };
});

function renderRoute() {
  return render(
    <MemoryRouter>
      <CapabilityNoticeProvider>
        <StudioNavigationProvider>
          <SessionPlanRoute />
        </StudioNavigationProvider>
      </CapabilityNoticeProvider>
    </MemoryRouter>,
  );
}

describe('SessionPlanRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates published revision on mount when a published plan exists', async () => {
    vi.mocked(campaignPrepApi.fetchSessionPlanStatus).mockResolvedValueOnce({
      isActivated: false,
      plan: {
        campaignId: 'camp-1',
        createdAt: '2026-04-26T12:00:00Z',
        data: {
          dependencies: [],
          estimatedMinutes: 240,
          lastEdited: '2 hours ago',
          readiness: [],
          revision: 4,
          steps: [],
        },
        id: 'plan-12',
        name: 'Session 12 - The Glass Harbor',
        revision: 4,
        status: 'ready',
        type: 'session-plan',
        updatedAt: '2026-04-26T12:00:00Z',
      },
      published: true,
      revision: 4,
      status: 'ready',
    });

    renderRoute();

    await waitFor(() => {
      expect(campaignPrepApi.fetchSessionPlanStatus).toHaveBeenCalledWith({
        campaignTitle: 'Ashes of Veyra',
        planTitle: 'Session 12 - The Glass Harbor',
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /published \(rev 4\)/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getAllByText('Published revision 4 is ready in Nexus VTT.').length,
    ).toBeGreaterThanOrEqual(1);

    const activateBtns = screen.getAllByRole('button', {
      name: /play in vtt/i,
    });
    expect(activateBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('remains in Draft status when no published plan exists on load', async () => {
    vi.mocked(campaignPrepApi.fetchSessionPlanStatus).mockResolvedValueOnce({
      isActivated: false,
      plan: null,
      published: false,
      status: 'draft',
    });

    renderRoute();

    await waitFor(() => {
      expect(campaignPrepApi.fetchSessionPlanStatus).toHaveBeenCalled();
    });

    expect(screen.getByRole('button', { name: /^draft/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play in vtt/i })).toBeNull();
  });

  it('gracefully handles unauthenticated or offline errors during hydration', async () => {
    vi.mocked(campaignPrepApi.fetchSessionPlanStatus).mockRejectedValueOnce(
      new Error('Authentication required: please log in.'),
    );

    renderRoute();

    await waitFor(() => {
      expect(campaignPrepApi.fetchSessionPlanStatus).toHaveBeenCalled();
    });

    // Does not crash or lock up; remains in Draft
    expect(screen.getByRole('button', { name: /^draft/i })).toBeInTheDocument();
  });

  it('publishes the plan and updates to published state with resulting revision', async () => {
    const user = userEvent.setup();
    vi.mocked(campaignPrepApi.fetchSessionPlanStatus).mockResolvedValueOnce({
      isActivated: false,
      plan: null,
      published: false,
      status: 'draft',
    });

    vi.mocked(campaignPrepApi.publishSessionPlan).mockResolvedValueOnce({
      campaign: {
        createdAt: '2026-04-26T12:00:00Z',
        description: 'Test',
        id: 'camp-1',
        title: 'Ashes of Veyra',
        updatedAt: '2026-04-26T12:00:00Z',
      },
      missingDependencies: [],
      plan: {
        campaignId: 'camp-1',
        createdAt: '2026-04-26T12:00:00Z',
        data: {
          dependencies: [],
          estimatedMinutes: 240,
          lastEdited: 'just now',
          readiness: [],
          revision: 5,
          steps: [],
        },
        id: 'plan-12',
        name: 'Session 12 - The Glass Harbor',
        revision: 5,
        status: 'ready',
        type: 'session-plan',
        updatedAt: '2026-04-26T12:00:00Z',
      },
      ready: true,
      validationIssues: [],
    });

    renderRoute();

    const publishBtns = screen.getAllByRole('button', {
      name: /publish plan/i,
    });
    await user.click(publishBtns[0]);

    await waitFor(() => {
      expect(campaignPrepApi.publishSessionPlan).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /published \(rev 5\)/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getAllByText('Published revision 5 to Nexus VTT.').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('activates an already published plan directly without error', async () => {
    const user = userEvent.setup();
    vi.mocked(campaignPrepApi.fetchSessionPlanStatus).mockResolvedValueOnce({
      isActivated: false,
      plan: {
        campaignId: 'camp-1',
        createdAt: '2026-04-26T12:00:00Z',
        data: {
          dependencies: [],
          estimatedMinutes: 240,
          lastEdited: '2 hours ago',
          readiness: [],
          revision: 4,
          steps: [],
        },
        id: 'plan-12',
        name: 'Session 12 - The Glass Harbor',
        revision: 4,
        status: 'ready',
        type: 'session-plan',
        updatedAt: '2026-04-26T12:00:00Z',
      },
      published: true,
      revision: 4,
      status: 'ready',
    });

    vi.mocked(campaignPrepApi.activateSessionPlan).mockResolvedValueOnce({
      activation: {
        activeStepId: 'step-1',
        createdAt: '2026-04-26T12:00:00Z',
        id: 'act-1',
        planId: 'plan-12',
        sessionId: 'session-12',
        status: 'active',
      },
      plan: {
        campaignId: 'camp-1',
        createdAt: '2026-04-26T12:00:00Z',
        data: {
          dependencies: [],
          estimatedMinutes: 240,
          lastEdited: '2 hours ago',
          readiness: [],
          revision: 4,
          steps: [],
        },
        id: 'plan-12',
        name: 'Session 12 - The Glass Harbor',
        revision: 4,
        status: 'ready',
        type: 'session-plan',
        updatedAt: '2026-04-26T12:00:00Z',
      },
    });

    renderRoute();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /published \(rev 4\)/i }),
      ).toBeInTheDocument();
    });

    const activateBtns = screen.getAllByRole('button', {
      name: /play in vtt/i,
    });
    await user.click(activateBtns[0]);

    await waitFor(() => {
      expect(campaignPrepApi.activateSessionPlan).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/Plan activated for session session-12!/i).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});

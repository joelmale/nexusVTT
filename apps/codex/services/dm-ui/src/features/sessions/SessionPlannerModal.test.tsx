import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import type { BundleStore } from '@/features/section-shell/bundleStore';

import { SessionPlannerModal } from './SessionPlannerModal';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe('SessionPlannerModal', () => {
  const bundle = getFixtureBundle('crown-of-cinders');
  let mockStore: BundleStore;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      bundle,
      status: 'ready',
      editable: true,
      reload: vi.fn(),
      updateItem: vi.fn().mockResolvedValue({ ok: true }),
      addItem: vi.fn().mockResolvedValue({ ok: true, id: 'session-new-123' }),
      reorderNotes: vi.fn().mockResolvedValue({ ok: true }),
    };

    // HTMLDialogElement polyfill for JSDOM
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function () {
        this.open = false;
      };
    }
  });

  it('renders modal with default next session number and tabs', () => {
    render(
      <SessionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
        basePath="/campaigns/test"
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('tab-basics')).toBeInTheDocument();
    expect(screen.getByTestId('tab-hub')).toBeInTheDocument();
    expect(screen.getByTestId('tab-spine')).toBeInTheDocument();
    expect(screen.getByTestId('tab-prep')).toBeInTheDocument();

    const sessionNumInput = screen.getByTestId(
      'input-session-number',
    ) as HTMLInputElement;
    expect(Number(sessionNumInput.value)).toBeGreaterThan(0);
  });

  it('allows navigating across tabs and toggling campaign entities in the hub', async () => {
    const user = userEvent.setup();
    render(
      <SessionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
        basePath="/campaigns/test"
      />,
    );

    // Switch to Campaign Hub tab
    await user.click(screen.getByTestId('tab-hub'));
    expect(screen.getByText('Primary Location / Setting')).toBeInTheDocument();
    expect(screen.getByText('Active Quests & Objectives')).toBeInTheDocument();

    // Toggle a quest chip
    if (bundle.quests.length > 0) {
      const questChip = screen.getByTestId(`chip-quest-${bundle.quests[0].id}`);
      await user.click(questChip);
      expect(questChip.className).toContain('selectionCardActive');
    }

    // Toggle an encounter chip
    if (bundle.encounters.length > 0) {
      const encChip = screen.getByTestId(
        `chip-encounter-${bundle.encounters[0].id}`,
      );
      await user.click(encChip);
      expect(encChip.className).toContain('selectionCardActive');
    }

    // Switch to Run-Sheet Beats tab
    await user.click(screen.getByTestId('tab-spine'));
    expect(screen.getByTestId('generate-spine-btn')).toBeInTheDocument();
    expect(screen.getByTestId('add-step-btn')).toBeInTheDocument();

    // Switch to DM Prep & Readiness tab
    await user.click(screen.getByTestId('tab-prep'));
    expect(screen.getByText('Readiness Checklist')).toBeInTheDocument();
    expect(screen.getByLabelText('Private DM Prep Notes')).toBeInTheDocument();
  });

  it('supports adding, reordering, and deleting run-sheet beats', async () => {
    const user = userEvent.setup();
    render(
      <SessionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
        basePath="/campaigns/test"
      />,
    );

    await user.click(screen.getByTestId('tab-spine'));

    // Count initial beats
    const initialSteps = screen.getAllByTestId(/^step-card-/);
    const count = initialSteps.length;

    // Add a custom beat
    await user.click(screen.getByTestId('add-step-btn'));
    const updatedSteps = screen.getAllByTestId(/^step-card-/);
    expect(updatedSteps.length).toBe(count + 1);

    // Delete the newly added beat
    const deleteBtn = screen.getByLabelText(`Delete Step ${count + 1}`);
    await user.click(deleteBtn);
    expect(screen.getAllByTestId(/^step-card-/).length).toBe(count);
  });

  it('validates required session title before saving', async () => {
    const user = userEvent.setup();
    render(
      <SessionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
        basePath="/campaigns/test"
      />,
    );

    const titleInput = screen.getByTestId('input-session-title');
    fireEvent.change(titleInput, { target: { value: '' } });

    await user.click(screen.getByTestId('save-draft-btn'));
    expect(screen.getByText('Session title is required.')).toBeInTheDocument();
    expect(mockStore.addItem).not.toHaveBeenCalled();
  });

  it('persists new session via store.addItem and calls onSessionSaved', async () => {
    const user = userEvent.setup();
    const onSessionSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <SessionPlannerModal
        isOpen={true}
        onClose={onClose}
        bundle={bundle}
        store={mockStore}
        basePath="/campaigns/test"
        onSessionSaved={onSessionSaved}
      />,
    );

    const titleInput = screen.getByTestId('input-session-title');
    fireEvent.change(titleInput, {
      target: { value: 'Incursion into the Caldera' },
    });

    await user.click(screen.getByTestId('save-draft-btn'));

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'session',
        expect.objectContaining({
          title: 'Incursion into the Caldera',
          plan: expect.objectContaining({
            steps: expect.any(Array),
          }),
        }),
      );
      expect(onSessionSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('persists and navigates to the run sheet when clicking Save & Open Run Sheet', async () => {
    const user = userEvent.setup();
    render(
      <SessionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
        basePath="/campaigns/test"
      />,
    );

    const titleInput = screen.getByTestId('input-session-title');
    fireEvent.change(titleInput, { target: { value: 'The Obsidian Crypt' } });

    await user.click(screen.getByTestId('save-and-open-runsheet-btn'));

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalled();
      expect(mockedNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/campaigns\/test\/sessions\/session-.*\/plan/),
      );
    });
  });

  it('correctly resolves and displays quest objective titles instead of UUID strings', async () => {
    const user = userEvent.setup();
    const customBundle: CampaignFixtureBundle = {
      ...bundle,
      quests: [
        {
          id: 'quest-uuid-test',
          campaignId: bundle.campaign.id,
          title: 'The Stolen Relic',
          status: 'active',
          priority: 'high',
          summary: 'Investigate the missing holy seal.',
          factionIds: [],
          sessionIds: [],
          locationIds: [],
          objectiveIds: [
            '2625061e-e442-4c58-a39a-51cfaa31ed45',
            'b41cdbc7-22ba-40c4-8f58-a03ed081bfc',
          ],
        },
      ],
      objectives: [
        {
          id: '2625061e-e442-4c58-a39a-51cfaa31ed45',
          questId: 'quest-uuid-test',
          order: 1,
          title: 'Interrogate the temple guard',
          status: 'active',
          clueIds: [],
          locationIds: [],
        },
      ],
    };

    render(
      <SessionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={customBundle}
        store={mockStore}
        basePath="/campaigns/test"
      />,
    );

    await user.click(screen.getByTestId('tab-hub'));
    const questChip = screen.getByTestId('chip-quest-quest-uuid-test');
    await user.click(questChip);

    // The first objective must display its real title, NOT "2625061e e442 4c58 a39a 51cfaa31ed45"
    expect(
      screen.getByText('Interrogate the temple guard'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2625061e e442/)).not.toBeInTheDocument();

    // The second objective without a title should fallback to "Objective 2", NOT the raw UUID with spaces
    expect(screen.getByText('Objective 2')).toBeInTheDocument();
    expect(screen.queryByText(/b41cdbc7 22ba/)).not.toBeInTheDocument();
  });
});

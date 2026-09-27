import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SessionPlanViewModel } from './sessionPlanModels';
import { SessionPlan } from './SessionPlan';

const model: SessionPlanViewModel = {
  attachments: [],
  breadcrumb: 'Sessions > Session 12',
  campaignTitle: 'Test Campaign',
  checklist: [
    { complete: true, id: 'ready-1', label: 'Scene linked' },
    { complete: false, id: 'ready-2', label: 'Summary written' },
  ],
  compendiumObjects: [],
  counts: [{ count: 1, label: 'All Objects', type: 'all' }],
  dateLabel: 'Sat, Apr 26, 2025',
  dependencies: [
    { id: 'scene-1', kind: 'scene', label: 'Glass Harbor Docks', ready: true },
  ],
  durationLabel: '~3-4 hours',
  folders: [],
  lastEditedLabel: 'Last edited 2 hours ago',
  notes: 'Private prep notes.',
  partyLevel: 5,
  playerFacing: 'Meet at the eastern pier.',
  recentObjects: [
    { id: 'npc-1', subtitle: 'NPC', title: 'Captain Serin', type: 'npc' },
  ],
  revision: 3,
  steps: [
    {
      body: 'Serin delivers a warning.',
      command: 'Open note',
      durationMinutes: 10,
      id: 'step-1',
      referenceLabel: 'Captain Serin',
      title: "Harbormaster's Warning",
      track: 'main',
      visibility: 'shared',
    },
  ],
  tags: ['Urban'],
  title: 'Session 12 - The Glass Harbor',
};

describe('SessionPlan', () => {
  it('adds an in-memory step and exposes future commands through one callback', async () => {
    const user = userEvent.setup();
    const onCapability = vi.fn();
    render(<SessionPlan model={model} onCapability={onCapability} />);

    expect(
      screen.getByRole('heading', { name: model.title }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add step/i }));
    expect(
      screen.getByText('Check in with the party before the final scene'),
    ).toBeInTheDocument();

    const publishButtons = screen.getAllByRole('button', {
      name: /publish plan/i,
    });
    expect(publishButtons).toHaveLength(2);
    await user.click(publishButtons[0]);
    expect(onCapability).toHaveBeenCalledWith('session-plan.publish');
  });

  it('filters campaign objects locally', async () => {
    const user = userEvent.setup();
    render(<SessionPlan model={model} onCapability={vi.fn()} />);

    await user.type(
      screen.getByRole('textbox', { name: 'Search campaign objects' }),
      'missing',
    );
    expect(
      screen.getByText('No objects match this search.'),
    ).toBeInTheDocument();
  });

  it('uses the functional publisher and reports its current state across both controls', async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    const { rerender } = render(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onPublish={onPublish}
        publishMessage="Saving campaign objects."
        publishState="publishing"
      />,
    );

    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThanOrEqual(1);
    expect(statuses[0]).toHaveTextContent('Saving campaign objects.');

    const publishingButtons = screen.getAllByRole('button', {
      name: /publishing/i,
    });
    expect(publishingButtons).toHaveLength(2);
    publishingButtons.forEach((btn) => expect(btn).toBeDisabled());

    rerender(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onPublish={onPublish}
      />,
    );
    const publishButtons = screen.getAllByRole('button', {
      name: /publish plan/i,
    });
    expect(publishButtons).toHaveLength(2);
    await user.click(publishButtons[1]); // Test clicking the mobile action bar button
    expect(onPublish).toHaveBeenCalledWith(model.steps);
  });

  it('renders Play in VTT button when published and calls onActivate', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { rerender } = render(
      <SessionPlan
        activateState="idle"
        model={model}
        onActivate={onActivate}
        onCapability={vi.fn()}
        publishState="published"
      />,
    );

    const activateBtns = screen.getAllByRole('button', {
      name: /play in vtt/i,
    });
    expect(activateBtns).toHaveLength(2);
    await user.click(activateBtns[0]);
    expect(onActivate).toHaveBeenCalledWith(model.steps);

    rerender(
      <SessionPlan
        activateState="activating"
        model={model}
        onActivate={onActivate}
        onCapability={vi.fn()}
        publishState="published"
      />,
    );
    const activatingBtns = screen.getAllByRole('button', {
      name: /activating in vtt/i,
    });
    expect(activatingBtns).toHaveLength(2);
    activatingBtns.forEach((btn) => expect(btn).toBeDisabled());

    rerender(
      <SessionPlan
        activateState="activated"
        model={model}
        onActivate={onActivate}
        onCapability={vi.fn()}
        publishState="published"
      />,
    );
    const restartButtons = screen.getAllByRole('button', {
      name: /restart run in vtt/i,
    });
    expect(restartButtons).toHaveLength(2);
    await user.click(restartButtons[0]);
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('protects an unchanged publication and can create an editable draft', async () => {
    const user = userEvent.setup();
    const onBeginDraft = vi.fn();
    const { rerender } = render(
      <SessionPlan
        isDirty={false}
        model={model}
        onBeginDraft={onBeginDraft}
        onCapability={vi.fn()}
        persistedRevision={3}
        publishState="published"
      />,
    );

    const publishedButtons = screen.getAllByRole('button', {
      name: /^published$/i,
    });
    expect(publishedButtons).toHaveLength(2);
    publishedButtons.forEach((button) => expect(button).toBeDisabled());

    const draftButtons = screen.getAllByRole('button', {
      name: /create draft/i,
    });
    expect(draftButtons).toHaveLength(2);
    await user.click(draftButtons[0]);
    expect(onBeginDraft).toHaveBeenCalledOnce();

    rerender(
      <SessionPlan
        isDirty
        model={model}
        onCapability={vi.fn()}
        persistedRevision={3}
        publishState="idle"
      />,
    );
    screen
      .getAllByRole('button', { name: /publish changes/i })
      .forEach((button) => expect(button).toBeEnabled());
  });

  it('updates header draft button to show revision when published', () => {
    const { rerender } = render(
      <SessionPlan model={model} onCapability={vi.fn()} publishState="idle" />,
    );
    expect(screen.getByRole('button', { name: /^draft/i })).toBeInTheDocument();

    rerender(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        publishState="published"
      />,
    );
    expect(
      screen.getByRole('button', {
        name: new RegExp(`published \\(rev ${model.revision}\\)`, 'i'),
      }),
    ).toBeInTheDocument();
  });

  it('exposes a dedicated mobile action bar region with accessibility attributes', () => {
    render(<SessionPlan model={model} onCapability={vi.fn()} />);
    const region = screen.getByRole('region', { name: 'Session actions' });
    expect(region).toBeInTheDocument();
  });

  it('moves the selected step to the parallel track before publishing', async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    render(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onPublish={onPublish}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /select harbormaster's warning/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Parallel' }));
    const publishButtons = screen.getAllByRole('button', {
      name: /publish plan/i,
    });
    await user.click(publishButtons[0]);

    expect(onPublish).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'step-1', track: 'parallel' }),
    ]);
  });
});

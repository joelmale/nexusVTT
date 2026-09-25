import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SessionPlanViewModel } from './sessionPlanModels';
import { SessionPlan } from './SessionPlan';

const model: SessionPlanViewModel = {
  attachments: [],
  breadcrumb: 'Sessions > Session 12',
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

    await user.click(screen.getByRole('button', { name: /publish plan/i }));
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

  it('uses the functional publisher and reports its current state', async () => {
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

    expect(screen.getByRole('status')).toHaveTextContent(
      'Saving campaign objects.',
    );
    expect(screen.getByRole('button', { name: /publishing/i })).toBeDisabled();

    rerender(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onPublish={onPublish}
      />,
    );
    await user.click(screen.getByRole('button', { name: /publish plan/i }));
    expect(onPublish).toHaveBeenCalledOnce();
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

    const activateBtn = screen.getByRole('button', { name: /play in vtt/i });
    expect(activateBtn).toBeInTheDocument();
    await user.click(activateBtn);
    expect(onActivate).toHaveBeenCalledOnce();

    rerender(
      <SessionPlan
        activateState="activating"
        model={model}
        onActivate={onActivate}
        onCapability={vi.fn()}
        publishState="published"
      />,
    );
    expect(
      screen.getByRole('button', { name: /activating in vtt/i }),
    ).toBeDisabled();
  });
});

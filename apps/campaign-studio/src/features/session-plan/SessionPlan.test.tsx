import { render, screen, within } from '@testing-library/react';
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
  it('commits edited prose and per-step visibility instead of changing only the DOM', async () => {
    const user = userEvent.setup();
    const onStepsChange = vi.fn();
    render(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onStepsChange={onStepsChange}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Session step notes' });
    await user.clear(editor);
    await user.type(editor, 'New private instructions');
    expect(onStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ body: 'New private instructions' }),
    ]);
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Visibility for/ }),
      'dm-only',
    );
    expect(onStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        visibility: 'dm-only',
        body: 'New private instructions',
      }),
    ]);
  });

  it('blocks ordinary activation while a published plan has dirty changes', () => {
    render(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        publishState="published"
        persistedRevision={3}
        isDirty
      />,
    );
    for (const button of screen.getAllByRole('button', { name: 'Play in VTT' }))
      expect(button).toBeDisabled();
  });

  it('commits readiness and scratchpad changes to authoring', async () => {
    const user = userEvent.setup();
    const onAuthoringChange = vi.fn();
    render(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onAuthoringChange={onAuthoringChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Summary written' }));
    expect(onAuthoringChange).toHaveBeenCalledWith({
      readiness: [
        model.checklist[0],
        { ...model.checklist[1], complete: true },
      ],
    });
    await user.click(screen.getByRole('tab', { name: 'Session Notes' }));
    await user.clear(screen.getByRole('textbox', { name: 'Session Notes' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Session Notes' }),
      'Remember the clue',
    );
    expect(onAuthoringChange).toHaveBeenLastCalledWith({
      notes: ['Remember the clue'],
    });
  });
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

  it('supports inline step title, duration, command type and entity selection (CS-38)', async () => {
    const user = userEvent.setup();
    const onStepsChange = vi.fn();
    const testModel: SessionPlanViewModel = {
      ...model,
      recentObjects: [
        {
          id: 'scene-1',
          subtitle: 'Scene',
          title: 'Glass Harbor Docks',
          type: 'scene',
        },
        {
          id: 'enc-1',
          subtitle: 'Encounter',
          title: 'Smuggler Ambush',
          type: 'encounter',
        },
      ],
    };
    render(
      <SessionPlan
        model={testModel}
        onCapability={vi.fn()}
        onStepsChange={onStepsChange}
      />,
    );

    // Edit step title
    const titleInput = screen.getByRole('textbox', {
      name: /Title for Harbormaster's Warning/i,
    });
    await user.clear(titleInput);
    await user.type(titleInput, 'Interrogate Captain Serin');
    expect(onStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ title: 'Interrogate Captain Serin' }),
    ]);

    // Edit duration via input
    const durationInput = screen.getByRole('spinbutton', {
      name: /Duration for/i,
    });
    await user.clear(durationInput);
    await user.type(durationInput, '25');
    expect(onStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ durationMinutes: 25 }),
    ]);

    // Quick duration button
    await user.click(screen.getByRole('button', { name: '+5m' }));
    expect(onStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ durationMinutes: 30 }),
    ]);

    // Change command type
    const commandSelect = screen.getByRole('combobox', {
      name: /Command for/i,
    });
    await user.selectOptions(commandSelect, 'deploy-encounter');
    expect(onStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ command: 'deploy-encounter' }),
    ]);

    // Target entity selector appears when command is not reminder
    const entitySelect = screen.getByRole('combobox', {
      name: /Target entity for/i,
    });
    await user.selectOptions(entitySelect, 'enc-1');
    expect(onStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        encounterId: 'enc-1',
        objectId: 'enc-1',
        referenceLabel: 'Smuggler Ambush',
      }),
    ]);
  });

  it('deletes a step when the delete button is clicked (CS-38)', async () => {
    const user = userEvent.setup();
    const onStepsChange = vi.fn();
    render(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onStepsChange={onStepsChange}
      />,
    );

    const deleteBtn = screen.getByRole('button', {
      name: /Delete Harbormaster's Warning/i,
    });
    await user.click(deleteBtn);
    expect(onStepsChange).toHaveBeenCalledWith([]);
  });

  it('inserts and links selected library objects into the plan (CS-37)', async () => {
    const user = userEvent.setup();
    const onStepsChange = vi.fn();
    const testModel: SessionPlanViewModel = {
      ...model,
      recentObjects: [
        {
          id: 'enc-1',
          subtitle: 'Encounter',
          title: 'Dockside Brawl',
          type: 'encounter',
        },
      ],
    };
    render(
      <SessionPlan
        model={testModel}
        onCapability={vi.fn()}
        onStepsChange={onStepsChange}
      />,
    );

    // Click "Insert into Plan"
    const insertBtn = screen.getByRole('button', { name: /Insert into Plan/i });
    await user.click(insertBtn);
    expect(onStepsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'deploy-encounter',
          encounterId: 'enc-1',
          objectId: 'enc-1',
          title: 'Dockside Brawl',
        }),
      ]),
    );

    // Click "Link to active step" after selecting step-1
    await user.click(
      screen.getByRole('button', { name: /select harbormaster's warning/i }),
    );
    const linkBtn = screen.getByRole('button', {
      name: /Link to active step/i,
    });
    await user.click(linkBtn);
    expect(onStepsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'deploy-encounter',
          encounterId: 'enc-1',
          id: 'step-1',
          objectId: 'enc-1',
          referenceLabel: 'Dockside Brawl',
        }),
      ]),
    );
  });

  it('applies bold, italic, and @ reference formatting in StepRow (CS-32)', async () => {
    const user = userEvent.setup();
    const onStepsChange = vi.fn();
    render(
      <SessionPlan
        model={model}
        onCapability={vi.fn()}
        onStepsChange={onStepsChange}
      />,
    );

    const boldBtn = screen.getByRole('button', { name: 'Bold' });
    const italicBtn = screen.getByRole('button', { name: 'Italic' });
    const refBtn = screen.getByRole('button', { name: 'Insert reference' });

    expect(boldBtn).toBeEnabled();
    expect(italicBtn).toBeEnabled();
    expect(refBtn).toBeEnabled();

    await user.click(boldBtn);
    expect(onStepsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        body: expect.stringContaining('**'),
      }),
    ]);

    await user.click(italicBtn);
    expect(onStepsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        body: expect.stringContaining('*'),
      }),
    ]);

    await user.click(refBtn);
    expect(onStepsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        body: expect.stringContaining('@['),
      }),
    ]);
  });

  it('renders the references tab with referenced entities and backlinks (CS-33)', async () => {
    const user = userEvent.setup();
    const testModel: SessionPlanViewModel = {
      ...model,
      attachments: [
        {
          id: 'att-1',
          subtitle: 'Handout',
          title: 'Smuggler Ledger',
          type: 'handout',
        },
      ],
      dependencies: [
        { id: 'dep-1', kind: 'scene', label: 'Warehouse Docks', ready: true },
      ],
      folders: [
        { id: 'folder-1', subtitle: 'Folder', title: 'Act 1: Arrival' },
      ],
      steps: [
        {
          body: 'Meet at docks',
          command: 'Deploy encounter',
          durationMinutes: 15,
          encounterId: 'enc-1',
          id: 'step-1',
          objectId: 'enc-1',
          referenceLabel: 'Ambush at Pier',
          title: 'Pier Encounter',
          track: 'main',
          visibility: 'dm-only',
        },
      ],
    };

    render(<SessionPlan model={testModel} onCapability={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: 'References' }));
    const refRegion = screen.getByRole('region', {
      name: 'References inspector',
    });
    expect(refRegion).toBeInTheDocument();
    expect(within(refRegion).getByText('Ambush at Pier')).toBeInTheDocument();
    expect(within(refRegion).getByText('Warehouse Docks')).toBeInTheDocument();
    expect(within(refRegion).getByText('Smuggler Ledger')).toBeInTheDocument();
    expect(within(refRegion).getByText('Test Campaign')).toBeInTheDocument();
  });

  it('handles estimate all durations and preview modal (CS-34)', async () => {
    const user = userEvent.setup();
    const onStepsChange = vi.fn();
    const onAuthoringChange = vi.fn();
    const testModel: SessionPlanViewModel = {
      ...model,
      steps: [
        {
          body: '',
          command: 'Reminder',
          durationMinutes: 0,
          id: 'step-1',
          title: 'Step 1',
          track: 'main',
          visibility: 'dm-only',
        },
        {
          body: '',
          command: 'Reminder',
          durationMinutes: 15,
          id: 'step-2',
          title: 'Step 2',
          track: 'main',
          visibility: 'dm-only',
        },
      ],
    };

    render(
      <SessionPlan
        model={testModel}
        onAuthoringChange={onAuthoringChange}
        onCapability={vi.fn()}
        onStepsChange={onStepsChange}
      />,
    );

    // Click "Estimate All"
    await user.click(screen.getByRole('button', { name: /Estimate All/i }));
    // Step 1 had 0 duration, bumped to default 10m, total 25m
    expect(onAuthoringChange).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedMinutes: 25 }),
    );
    expect(onStepsChange).toHaveBeenCalledWith([
      expect.objectContaining({ durationMinutes: 10, id: 'step-1' }),
      expect.objectContaining({ durationMinutes: 15, id: 'step-2' }),
    ]);

    // Click "Preview"
    await user.click(screen.getByRole('button', { name: /Preview/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Session Run Sheet Export')).toBeInTheDocument();
  });

  it('opens revision history modal and cleanly labels Chat Prep as experimental (CS-35)', async () => {
    const user = userEvent.setup();
    const onCapability = vi.fn();
    render(<SessionPlan model={model} onCapability={onCapability} />);

    // View history
    await user.click(screen.getByRole('button', { name: /View history/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Revision History/i)).toBeInTheDocument();

    // Chat Prep tab
    const chatTab = screen.getByRole('tab', { name: /Chat Prep/i });
    expect(chatTab).toHaveTextContent('Experimental');
    await user.click(chatTab);
    expect(onCapability).toHaveBeenCalledWith('session-plan.chat-prep');
    expect(screen.getByText('AI Chat Preparation')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Conversational session prep with the Codex AI assistant/i,
      ),
    ).toBeInTheDocument();
  });

  it('filters library objects by type counter and act folder structure (CS-36)', async () => {
    const user = userEvent.setup();
    const testModel: SessionPlanViewModel = {
      ...model,
      counts: [
        { count: 3, label: 'All Objects', type: 'all' },
        { count: 1, label: 'Scenes', type: 'scene' },
        { count: 1, label: 'Encounters', type: 'encounter' },
        { count: 1, label: 'NPCs', type: 'npc' },
      ],
      folders: [
        {
          childCounts: [{ count: 1, label: 'Scenes' }],
          id: 'act-1',
          subtitle: 'Act 1',
          title: 'Act 1: Whispers',
        },
      ],
      recentObjects: [
        { id: 'npc-1', subtitle: 'NPC', title: 'Captain Serin', type: 'npc' },
        {
          id: 'scene-1',
          subtitle: 'Scene',
          title: 'Glass Harbor Docks',
          type: 'scene',
        },
        {
          id: 'enc-1',
          subtitle: 'Encounter',
          title: 'Smuggler Ambush',
          type: 'encounter',
        },
      ],
    };

    render(<SessionPlan model={testModel} onCapability={vi.fn()} />);

    // Filter by "Scenes"
    const libraryAside = screen.getByLabelText('Campaign object library');
    const objectTypesSection = screen.getByLabelText('Object types');
    const scenesBtn = within(objectTypesSection).getByRole('button', {
      name: /Scenes/i,
    });
    await user.click(scenesBtn);
    expect(within(libraryAside).getByText('Glass Harbor Docks')).toBeInTheDocument();
    expect(within(libraryAside).queryByText('Captain Serin')).not.toBeInTheDocument();

    // Reset to "All Objects"
    const allBtn = within(objectTypesSection).getByRole('button', {
      name: /All Objects/i,
    });
    await user.click(allBtn);
    expect(within(libraryAside).getAllByText('Captain Serin')[0]).toBeInTheDocument();
    expect(within(libraryAside).getByText('Glass Harbor Docks')).toBeInTheDocument();

    // Expand folder and click folder child
    const structureSection = screen.getByLabelText('Campaign structure');
    const folderToggle = within(structureSection).getByRole('button', {
      name: /Act 1: Whispers/i,
    });
    await user.click(folderToggle);
    const childBtn = within(structureSection).getByRole('button', {
      name: /Scenes/i,
    });
    await user.click(childBtn);
    expect(within(libraryAside).getByText('Glass Harbor Docks')).toBeInTheDocument();
  });

  it('supports adding and removing attachments in the Attachments tab (CS-40)', async () => {
    const user = userEvent.setup();
    const onAuthoringChange = vi.fn();
    const testModel: SessionPlanViewModel = {
      ...model,
      attachments: [
        {
          id: 'att-1',
          subtitle: 'Handout',
          title: 'Pirate Map',
          type: 'handout',
        },
      ],
      recentObjects: [
        {
          id: 'att-2',
          subtitle: 'Handout',
          title: 'Royal Decree',
          type: 'handout',
        },
      ],
    };

    render(
      <SessionPlan
        model={testModel}
        onAuthoringChange={onAuthoringChange}
        onCapability={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Attachments' }));
    const mainWorkspace = screen.getByRole('main');
    expect(within(mainWorkspace).getByText('Pirate Map')).toBeInTheDocument();

    // Add Royal Decree as attachment
    const select = screen.getByRole('combobox', {
      name: /Select object to attach/i,
    });
    await user.selectOptions(select, 'att-2');
    await user.click(within(mainWorkspace).getByRole('button', { name: /^Attach$/i }));
    expect(within(mainWorkspace).getByText('Royal Decree')).toBeInTheDocument();
    expect(onAuthoringChange).toHaveBeenLastCalledWith({
      attachments: ['att-1', 'att-2'],
    });

    // Remove Pirate Map
    const removeBtn = screen.getByRole('button', {
      name: /Remove attachment Pirate Map/i,
    });
    await user.click(removeBtn);
    expect(
      within(mainWorkspace).queryByText('Pirate Map'),
    ).not.toBeInTheDocument();
    expect(onAuthoringChange).toHaveBeenLastCalledWith({
      attachments: ['att-2'],
    });
  });
});

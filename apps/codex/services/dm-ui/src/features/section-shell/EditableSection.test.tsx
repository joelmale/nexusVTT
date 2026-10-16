import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BundleStore, SaveResult } from './bundleStore';
import { AddRow, EditableSection } from './EditableSection';
import { renderInSection } from './testUtils';

const initial = { name: 'Captain Serin', role: 'Harbor Master' };

function Section() {
  return (
    <EditableSection
      id="npc-1"
      initialDraft={initial}
      heading="Captain Serin"
      kind="npc"
      renderForm={(draft, setDraft) => (
        <label>
          Name
          <input
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            value={String(draft.name)}
          />
        </label>
      )}
    >
      <p>read view</p>
    </EditableSection>
  );
}

function editableStore(
  updateItem: BundleStore['updateItem'],
  extra: Partial<BundleStore> = {},
): Partial<BundleStore> {
  return { editable: true, updateItem, ...extra };
}

describe('EditableSection', () => {
  it('has no Edit button when the store is read-only', () => {
    renderInSection(<Section />);
    expect(
      screen.getByRole('heading', { name: 'Captain Serin' }),
    ).toBeVisible();
    expect(screen.getByText('read view')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('saves the diff on blur and stays in edit mode', async () => {
    let resolve!: (result: SaveResult) => void;
    const updateItem = vi.fn(
      () => new Promise<SaveResult>((r) => (resolve = r)),
    );
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'Serin Dhal');
    expect(updateItem).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.tab();

    expect(updateItem).toHaveBeenCalledWith('npc', 'npc-1', {
      name: 'Serin Dhal',
    });
    expect(screen.getByText('Saving…')).toBeInTheDocument();

    resolve({ ok: true });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeVisible();
    expect(screen.queryByText('read view')).toBeNull();
  });

  it('does not call the store when blur has no changes', async () => {
    const updateItem = vi.fn();
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByLabelText('Name'));
    await user.tab();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('serializes two quick edits into two sequential calls', async () => {
    const resolvers: Array<(result: SaveResult) => void> = [];
    const updateItem = vi.fn(
      () => new Promise<SaveResult>((r) => resolvers.push(r)),
    );
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByLabelText('Name');
    await user.type(input, 'A');
    await user.tab();
    expect(updateItem).toHaveBeenCalledTimes(1);

    await user.click(input);
    await user.type(input, 'B');
    await user.tab();
    // the second save waits for the first
    expect(updateItem).toHaveBeenCalledTimes(1);

    resolvers[0]({ ok: true });
    await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(2));
    expect(updateItem.mock.calls[0][2]).toEqual({ name: 'Captain SerinA' });
    expect(updateItem.mock.calls[1][2]).toEqual({ name: 'Captain SerinAB' });
    resolvers[1]({ ok: true });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('flushes a dirty draft on unmount', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user, unmount } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    expect(updateItem).not.toHaveBeenCalled();
    unmount();
    expect(updateItem).toHaveBeenCalledWith('npc', 'npc-1', {
      name: 'Captain Serin!',
    });
  });

  it('Done saves pending edits and exits edit mode', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByText('read view')).toBeVisible());
    expect(updateItem).toHaveBeenCalledTimes(1);
  });

  it('renders headerActions next to Edit', () => {
    renderInSection(
      <EditableSection
        headerActions={<button type="button">Remove</button>}
        id="npc-1"
        initialDraft={initial}
        heading="Captain Serin"
        kind="npc"
        renderForm={() => null}
      >
        <p>read view</p>
      </EditableSection>,
      { store: editableStore(vi.fn()) },
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  it('shows a conflict banner, pauses autosave and Reload latest reloads', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: false, conflict: true });
    const reload = vi.fn().mockResolvedValue(undefined);
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem, { reload }),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.tab();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'changed elsewhere',
    );
    expect(screen.queryByText('Saved')).toBeNull();
    // stays in edit mode so the draft is not lost
    expect(screen.getByLabelText('Name')).toBeVisible();

    // further edits do not hit the store while paused
    await user.type(screen.getByLabelText('Name'), '?');
    await user.tab();
    expect(updateItem).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Reload latest' }));
    expect(reload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('read view')).toBeVisible();
  });

  it('Keep my changes re-sends the same patch after a conflict', async () => {
    const updateItem = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, conflict: true })
      .mockResolvedValueOnce({ ok: true });
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.tab();
    await user.click(
      await screen.findByRole('button', { name: 'Keep my changes' }),
    );
    await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(2));
    expect(updateItem.mock.calls[1]).toEqual(updateItem.mock.calls[0]);
    expect(await screen.findByText('Saved')).toBeVisible();
  });

  it('shows an error banner and never "saved" on failure', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: false, error: 'boom' });
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save: boom',
    );
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('treats a thrown save as an error', async () => {
    const updateItem = vi.fn().mockRejectedValue(new Error('offline'));
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
  });
});

describe('AddRow', () => {
  const row = (
    <AddRow kind="npc" label="Add NPC" nameField="name" sectionPath="npcs" />
  );

  it('renders nothing for a read-only store', () => {
    renderInSection(row);
    expect(screen.queryByRole('button', { name: /Add NPC/ })).toBeNull();
  });

  it('creates the object and navigates to it', async () => {
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'npc-new' });
    const { user } = renderInSection(row, {
      store: { editable: true, addItem },
    });
    await user.click(screen.getByRole('button', { name: '+ Add NPC' }));
    await user.type(screen.getByLabelText('Add NPC name'), 'Bram');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(addItem).toHaveBeenCalledWith('npc', { name: 'Bram' });
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/demo/ashes-of-veyra/npcs/npc-new',
      ),
    );
  });

  it('requires a name and shows server errors', async () => {
    const addItem = vi.fn().mockResolvedValue({ ok: false, error: 'nope' });
    const { user } = renderInSection(row, {
      store: { editable: true, addItem },
    });
    await user.click(screen.getByRole('button', { name: '+ Add NPC' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
    expect(addItem).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Add NPC name'), 'Bram');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
  });
});

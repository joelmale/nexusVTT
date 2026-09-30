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

  it('shows saving, then saved only after the promise resolves ok', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateItem).toHaveBeenCalledWith('npc', 'npc-1', {
      name: 'Serin Dhal',
    });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).toBeNull();

    resolve({ ok: true });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.getByText('read view')).toBeVisible();
  });

  it('cancel discards the draft without calling the store', async () => {
    const updateItem = vi.fn();
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), ' Jr');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateItem).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Captain Serin');
  });

  it('shows a conflict banner and Reload latest reloads the store', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: false, conflict: true });
    const reload = vi.fn().mockResolvedValue(undefined);
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem, { reload }),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'changed elsewhere',
    );
    expect(screen.queryByText('Saved.')).toBeNull();
    // stays in edit mode so the draft is not lost
    expect(screen.getByLabelText('Name')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Reload latest' }));
    expect(reload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('read view')).toBeVisible();
  });

  it('shows an error banner and never "saved" on failure', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: false, error: 'boom' });
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save: boom',
    );
    expect(screen.queryByText('Saved.')).toBeNull();
  });

  it('treats a thrown save as an error', async () => {
    const updateItem = vi.fn().mockRejectedValue(new Error('offline'));
    const { user } = renderInSection(<Section />, {
      store: editableStore(updateItem),
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Name'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
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

import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  createEmptyBundle,
  getFixtureBundle,
  type CampaignFixtureBundle,
  type CampaignNote,
} from '@/demo/fixture-registry';
import {
  TEST_CAMPAIGN,
  renderInSection,
  renderSection,
} from '@/features/section-shell/testUtils';

import { NotesSection } from './NotesSection';

const ROUTED = (
  <Routes>
    <Route element={<NotesSection />} path="/campaigns/:id/notes/:noteId?" />
  </Routes>
);

const NOTES = '/campaigns/campaign-blank/notes';
const base = getFixtureBundle('ashes-of-veyra')!;

const mk = (
  id: string,
  order: number,
  extra: Partial<CampaignNote> = {},
): CampaignNote => ({
  id,
  campaignId: base.campaignId,
  title: `Note ${id}`,
  body: `Body of **${id}**\n\n- item`,
  anchor: { type: 'campaign' },
  audience: 'none',
  color: 'yellow',
  size: 'small',
  order,
  ...extra,
});

function editableBundle(): CampaignFixtureBundle {
  const session = base.sessions[0];
  return {
    ...base,
    notes: [
      mk('a', 0),
      mk('b', 1, { anchor: { type: 'session', id: session.id } }),
      mk('c', 2, { audience: 'all' }),
    ],
  };
}

describe('NotesSection examples', () => {
  it.each([
    'ashes-of-veyra',
    'crown-of-cinders',
    'lanterns-of-mourningfen',
    'stars-below-kharad',
  ])('renders %s notes read-only, including shared handouts', (slug) => {
    const fixture = getFixtureBundle(slug)!;
    const shared = fixture.notes.filter((note) => note.audience === 'all');
    renderSection(`/demo/${slug}/notes`);
    const nav = screen.getByRole('navigation', { name: 'Note list' });
    expect(within(nav).getAllByRole('link')).toHaveLength(fixture.notes.length);
    expect(shared.length).toBeGreaterThan(0);
    expect(within(nav).getAllByText('Shared')).toHaveLength(shared.length);
    expect(screen.queryByRole('button', { name: /Add note/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('shows the Shared with players note for a shared handout', () => {
    const fixture = getFixtureBundle('ashes-of-veyra')!;
    const handout = fixture.notes.find((note) => note.audience === 'all')!;
    renderSection(`/demo/ashes-of-veyra/notes/${handout.id}`);
    expect(
      screen.getByRole('heading', { level: 2, name: handout.title }),
    ).toBeVisible();
    expect(screen.getByText(/Shared with players\./)).toBeVisible();
    expect(screen.getByText(/Shared with all players/)).toBeVisible();
  });

  it('does not show the shared note on a private note', () => {
    const fixture = getFixtureBundle('ashes-of-veyra')!;
    const lore = fixture.notes.find((note) => note.audience === 'none')!;
    renderSection(`/demo/ashes-of-veyra/notes/${lore.id}`);
    expect(screen.queryByText(/Shared with players\./)).toBeNull();
  });

  it('shows not-found for unknown ids', () => {
    renderSection('/demo/ashes-of-veyra/notes/nope');
    expect(screen.getByText('Not found in this campaign')).toBeVisible();
  });
});

describe('NotesSection real campaign', () => {
  it('offers Add note on an empty real campaign', () => {
    const empty = createEmptyBundle(TEST_CAMPAIGN);
    expect(empty.notes).toEqual([]);
    renderInSection(ROUTED, {
      path: NOTES,
      store: { bundle: empty, editable: true },
    });
    expect(screen.getByText('No notes yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: '+ Add note' })).toBeVisible();
  });

  it('adds a note through the single Add row', async () => {
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'n1' });
    const { user } = renderInSection(ROUTED, {
      path: NOTES,
      store: { bundle: editableBundle(), editable: true, addItem },
    });
    expect(screen.getAllByRole('button', { name: /Add note/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '+ Add note' }));
    await user.type(screen.getByLabelText('Add note name'), 'Idea');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith(
        'note',
        expect.objectContaining({
          title: 'Idea',
          audience: 'none',
          anchor: { type: 'campaign' },
        }),
      ),
    );
  });

  it('edits the body and saves only the change', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(ROUTED, {
      path: `${NOTES}/a`,
      store: { bundle: editableBundle(), editable: true, updateItem },
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const body = screen.getByLabelText('Note');
    await user.clear(body);
    await user.type(body, 'Rewritten');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('note', 'a', {
        body: 'Rewritten',
      }),
    );
  });

  it('changes the anchor to a session', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const b = editableBundle();
    const { user } = renderInSection(ROUTED, {
      path: `${NOTES}/a`,
      store: { bundle: b, editable: true, updateItem },
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(
      screen.getByLabelText('Anchor'),
      `session:${b.sessions[0].id}`,
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('note', 'a', {
        anchor: { type: 'session', id: b.sessions[0].id },
      }),
    );
  });

  it('shares with selected characters via the single share control', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const b = editableBundle();
    const pc = b.catalog.playerCharacters[0];
    const { user } = renderInSection(ROUTED, {
      path: `${NOTES}/a`,
      store: { bundle: b, editable: true, updateItem },
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const share = screen.getByLabelText('Share with players');
    expect(share).toHaveValue('none');
    await user.selectOptions(share, 'selected');
    await user.click(screen.getByRole('checkbox', { name: pc.name }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('note', 'a', {
        audience: [pc.id],
      }),
    );
  });

  it('shares with all players', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(ROUTED, {
      path: `${NOTES}/a`,
      store: { bundle: editableBundle(), editable: true, updateItem },
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(
      screen.getByLabelText('Share with players'),
      'all',
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('note', 'a', { audience: 'all' }),
    );
  });

  it('filters by anchor and search', async () => {
    const b = editableBundle();
    const { user } = renderInSection(ROUTED, {
      path: NOTES,
      store: { bundle: b },
    });
    const nav = () => screen.getByRole('navigation', { name: 'Note list' });
    expect(within(nav()).getAllByRole('link')).toHaveLength(3);
    await user.selectOptions(
      screen.getByLabelText('Show'),
      `session:${b.sessions[0].id}`,
    );
    expect(within(nav()).getAllByRole('link')).toHaveLength(1);
    expect(within(nav()).getByText('Note b')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Show'), 'campaign');
    expect(within(nav()).getAllByRole('link')).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Show'), '');
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No notes match these filters.')).toBeVisible();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderSection } from '@/features/section-shell/testUtils';

import { npcDraftToPatch } from './NpcsSection';

describe('NpcsSection', () => {
  it('lists NPCs grouped by faction and selects from the URL', () => {
    renderSection('/demo/ashes-of-veyra/npcs/npc-captain-serin');
    const nav = screen.getByRole('navigation', { name: 'NPC list' });
    expect(
      within(nav).getByRole('heading', { name: 'Unaffiliated' }),
    ).toBeVisible();
    expect(
      within(nav).getByRole('link', { name: /Captain Serin Dhal/ }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Captain Serin Dhal' }),
    ).toBeVisible();
    expect(screen.getByText('Motivation')).toBeVisible();
    expect(screen.getByText('Relationship to party')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Find the Ember Key/ }),
    ).toBeVisible();
  });

  it('is read-only on examples', () => {
    renderSection('/demo/ashes-of-veyra/npcs/npc-captain-serin');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add NPC/ })).toBeNull();
  });

  it('shows a Leads chip for faction leaders', () => {
    renderSection('/demo/ashes-of-veyra/npcs/npc-elian-rook');
    expect(
      screen.getByRole('link', { name: /Harbor Watch \(Leads\)/ }),
    ).toBeVisible();
  });

  it('never shows the Unused marker on an active campaign', () => {
    renderSection('/demo/ashes-of-veyra/npcs');
    expect(screen.queryByText('Unused')).toBeNull();
  });

  it('shows not-found for unknown ids', () => {
    renderSection('/demo/ashes-of-veyra/npcs/npc-nope');
    expect(screen.getByText('Not found in this campaign')).toBeVisible();
  });

  it.each([
    ['crown-of-cinders', 'Prince Corvin Vell'],
    ['lanterns-of-mourningfen', 'Reeve Hesper Crane'],
    ['stars-below-kharad', 'Foreman Tamsin Brack'],
  ])('renders %s NPCs', (slug, name) => {
    renderSection(`/demo/${slug}/npcs`);
    expect(screen.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  });

  it('shows an empty list on a real campaign', async () => {
    renderSection('/campaigns/campaign-blank/npcs');
    expect(await screen.findByText('No NPCs yet.')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'NPCs' })).toBeVisible(),
    );
  });
});

describe('npcDraftToPatch', () => {
  const initial = {
    name: 'A',
    role: 'r',
    ancestry: '',
    motivation: '',
    relationship: '',
    tags: 'x',
    factionId: 'f1',
  };
  it('emits only changed fields and converts tags and faction', () => {
    expect(
      npcDraftToPatch(
        { ...initial, role: 'boss', tags: 'a, b ,', factionId: 'f2' },
        initial,
        { factionIds: ['f1', 'f3'] },
      ),
    ).toEqual({ role: 'boss', tags: ['a', 'b'], factionIds: ['f2', 'f3'] });
    expect(npcDraftToPatch(initial, initial, { factionIds: ['f1'] })).toEqual(
      {},
    );
    expect(
      npcDraftToPatch({ ...initial, factionId: '' }, initial, {
        factionIds: ['f1', 'f3'],
      }),
    ).toEqual({ factionIds: ['f3'] });
  });
});

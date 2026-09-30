import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  renderInSection,
  renderSection,
} from '@/features/section-shell/testUtils';

import { QuestsSection } from './QuestsSection';

describe('QuestsSection', () => {
  it('lists quests with progress and is read-only on examples', () => {
    renderSection('/demo/ashes-of-veyra/quests', { singlePane: false });
    const list = screen.getByRole('navigation', { name: 'Quest list' });
    expect(within(list).getByText('Find the Ember Key')).toBeInTheDocument();
    expect(
      within(list).getAllByLabelText(/objectives complete/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Add quest/ })).toBeNull();
  });

  it('shows objectives with anchors and no Edit on examples', () => {
    renderSection('/demo/ashes-of-veyra/quests/quest-find-ember-key', {
      singlePane: false,
    });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Find the Ember Key' }),
    ).toBeInTheDocument();
    const bundle = getFixtureBundle('ashes-of-veyra')!;
    const objective = bundle.objectives.find(
      (o) => o.questId === 'quest-find-ember-key',
    )!;
    const item = screen.getByText(objective.title).closest('li');
    expect(item).toHaveAttribute('id', `objective-${objective.id}`);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('shows resolution for complete quests', () => {
    const bundle = getFixtureBundle('stars-below-kharad')!;
    const quest = bundle.quests.find((q) => q.status === 'complete')!;
    const withRes = {
      ...bundle,
      quests: bundle.quests.map((q) =>
        q.id === quest.id ? { ...q, resolution: 'The gate stayed shut.' } : q,
      ),
    };
    renderInSection(<QuestsSection />, {
      slug: 'stars-below-kharad',
      path: `/demo/stars-below-kharad/quests/${quest.id}`,
      store: { bundle: withRes },
      singlePane: false,
    });
    expect(screen.getByText('The gate stayed shut.')).toBeInTheDocument();
  });

  it('renders for all four fixtures, with Open thread in the paused one', () => {
    for (const slug of [
      'ashes-of-veyra',
      'crown-of-cinders',
      'lanterns-of-mourningfen',
      'stars-below-kharad',
    ]) {
      const { unmount } = renderSection(`/demo/${slug}/quests`, {
        singlePane: false,
      });
      expect(
        screen.getByRole('heading', { level: 1, name: 'Quests' }),
      ).toBeInTheDocument();
      if (slug === 'lanterns-of-mourningfen') {
        expect(screen.getAllByText('Open thread').length).toBeGreaterThan(0);
      }
      unmount();
    }
  });

  it('renders an empty state on a real empty campaign', () => {
    renderSection('/campaigns/campaign-blank/quests', { singlePane: false });
    expect(screen.getByText('No quests yet.')).toBeInTheDocument();
  });

  it('edits a quest with a new objective when the store is editable', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(<QuestsSection />, {
      path: '/campaigns/campaign-blank/quests/quest-find-ember-key',
      store: { editable: true, updateItem },
      singlePane: false,
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Add objective' }));
    const bundle = getFixtureBundle('ashes-of-veyra')!;
    const count = bundle.objectives.filter(
      (o) => o.questId === 'quest-find-ember-key',
    ).length;
    await user.type(
      screen.getByLabelText(`Objective ${count + 1} title`),
      'New step',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateItem.mock.calls[0][0]).toBe('quest');
    const patch = updateItem.mock.calls[0][2];
    expect(patch.objectives.at(-1)).toMatchObject({
      title: 'New step',
      order: count + 1,
    });
    expect(
      screen.getByRole('button', { name: /Add quest/ }),
    ).toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { listFixtureBundles } from '@/demo/fixture-registry';
import { renderSection } from '@/features/section-shell/testUtils';

describe('WorldSection', () => {
  it('renders the Ashes tree with roots expanded and selects a location', async () => {
    const { user } = renderSection('/demo/ashes-of-veyra/world');
    const tree = await screen.findByRole('tree', { name: 'Location tree' });
    const items = within(tree).getAllByRole('treeitem');
    expect(items.length).toBeGreaterThan(1);
    expect(items[0]).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(tree).getByRole('link', { name: /North Docks/ }));
    expect(screen.getByTestId('location').textContent).toContain(
      '/world/location-north-docks',
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'North Docks' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('expands and collapses with arrow keys and persists ?open=', async () => {
    const { user } = renderSection('/demo/ashes-of-veyra/world');
    const tree = await screen.findByRole('tree');
    within(tree).getAllByRole('treeitem')[0].focus();
    await user.keyboard('{ArrowLeft}');
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(1);
    expect(screen.getByTestId('location').textContent).toContain('open=');
    await user.keyboard('{ArrowRight}');
    expect(within(tree).getAllByRole('treeitem').length).toBeGreaterThan(1);
    await user.keyboard('{ArrowDown}');
    expect(within(tree).getAllByRole('treeitem')[1]).toHaveFocus();
  });

  it('flattens results with a breadcrumb when searching', async () => {
    const { user } = renderSection('/demo/ashes-of-veyra/world');
    await user.type(await screen.findByRole('searchbox'), 'north docks');
    const results = screen.getByRole('navigation', {
      name: 'Location results',
    });
    expect(within(results).getByText('Glass Harbor')).toBeInTheDocument();
    expect(screen.queryByRole('tree')).toBeNull();
  });

  it('shows the map chip, related entities and DM-only notes', async () => {
    renderSection('/demo/ashes-of-veyra/world/location-glass-harbor');
    await screen.findByRole('heading', { level: 2, name: 'Glass Harbor' });
    expect(
      document.querySelector(
        'a[href="/demo/ashes-of-veyra/maps/map-glass-harbor?pin=pin-north-docks"]',
      ),
    ).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: 'NPCs' }),
    ).toBeInTheDocument();
    expect(screen.getByText('DM only')).toBeInTheDocument();
  });

  it('shows not-found for an unknown id', async () => {
    renderSection('/demo/ashes-of-veyra/world/nope');
    expect(
      await screen.findByText('Not found in this campaign'),
    ).toBeInTheDocument();
  });

  it('renders every fixture', async () => {
    for (const bundle of listFixtureBundles('test')) {
      const { unmount } = renderSection(`/demo/${bundle.slug}/world`);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'World' }),
      ).toBeInTheDocument();
      if (bundle.locations.length > 0) {
        expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(0);
      } else {
        expect(screen.getByText('No locations yet.')).toBeInTheDocument();
      }
      unmount();
    }
  });

  it('shows the empty state for a real empty campaign', async () => {
    renderSection('/campaigns/campaign-blank/world');
    expect(await screen.findByText('No locations yet.')).toBeInTheDocument();
  });
});

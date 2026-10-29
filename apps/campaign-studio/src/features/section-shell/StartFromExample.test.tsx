import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ServerBundleBackend } from './bundleStore';
import { SectionLayout } from './SectionLayout';
import { renderInSection } from './testUtils';

const layout = (
  <SectionLayout list={<p>list</p>} sectionPath="npcs" title="NPCs" />
);

describe('Start from this example', () => {
  it('is shown on example campaigns only', () => {
    const { unmount } = renderInSection(layout);
    expect(
      screen.getByRole('button', { name: 'Start from this example' }),
    ).toBeInTheDocument();
    unmount();

    renderInSection(layout, { path: '/campaigns/campaign-blank/npcs' });
    expect(
      screen.queryByRole('button', { name: 'Start from this example' }),
    ).toBeNull();
  });

  it('shows the capability notice when no backend is available', async () => {
    const { user } = renderInSection(layout);
    await user.click(
      screen.getByRole('button', { name: 'Start from this example' }),
    );
    expect(
      await screen.findByText(/Create a new editable campaign/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/demo/ashes-of-veyra/npcs',
    );
  });

  it('seeds through the backend and opens the same section in the new campaign', async () => {
    const seedFromFixture = vi.fn().mockResolvedValue('campaign-new');
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn(),
      seedFromFixture,
    };
    const { user, campaignContext } = renderInSection(layout, { backend });
    await user.click(
      screen.getByRole('button', { name: 'Start from this example' }),
    );
    expect(seedFromFixture).toHaveBeenCalledWith('ashes-of-veyra');
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/campaigns/campaign-new/npcs',
      ),
    );
    expect(campaignContext.reload).toHaveBeenCalled();
  });

  it('shows what the clone skipped and opens the campaign on request', async () => {
    const seedFromFixture = vi.fn().mockResolvedValue({
      campaignId: 'campaign-new',
      failedCount: 1,
      notes: [
        '1 item could not be copied: Mira (boom).',
        'Maps are not copied yet. Scene steps became reminders.',
      ],
    });
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn(),
      seedFromFixture,
    };
    const { user } = renderInSection(layout, { backend });
    await user.click(
      screen.getByRole('button', { name: 'Start from this example' }),
    );

    expect(
      await screen.findByText('Your copy was created, with some gaps.'),
    ).toBeVisible();
    expect(screen.getByText(/Mira \(boom\)/)).toBeVisible();
    expect(screen.getByText(/Maps are not copied yet/)).toBeVisible();
    // Stays on the example until the DM chooses to open the copy.
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/demo/ashes-of-veyra/npcs',
    );
    await user.click(screen.getByRole('button', { name: 'Open campaign' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/campaigns/campaign-new/npcs',
    );
  });

  it('opens straight away when the backend reports nothing to flag', async () => {
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn(),
      seedFromFixture: vi.fn().mockResolvedValue({
        campaignId: 'campaign-clean',
        failedCount: 0,
        notes: [],
      }),
    };
    const { user } = renderInSection(layout, { backend });
    await user.click(
      screen.getByRole('button', { name: 'Start from this example' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/campaigns/campaign-clean/npcs',
      ),
    );
  });

  it('shows an error and stays put when seeding fails', async () => {
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn(),
      seedFromFixture: vi.fn().mockRejectedValue(new Error('server down')),
    };
    const { user } = renderInSection(layout, { backend });
    await user.click(
      screen.getByRole('button', { name: 'Start from this example' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('server down');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/demo/ashes-of-veyra/npcs',
    );
  });
});

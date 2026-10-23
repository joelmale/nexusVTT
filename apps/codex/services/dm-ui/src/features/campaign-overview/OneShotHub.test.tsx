import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle, type CampaignFixtureBundle } from '@/demo/fixture-registry';
import { OneShotHub } from './OneShotHub';

describe('OneShotHub', () => {
  const baseBundle = getFixtureBundle('stars-below-kharad', 'test')!;
  const oneShotBundle: CampaignFixtureBundle = {
    ...baseBundle,
    campaign: {
      ...baseBundle.campaign,
      mode: 'one-shot',
    },
  };

  it('renders one-shot mode badge, pacing badge, and scene count badge', () => {
    render(
      <MemoryRouter>
        <OneShotHub bundle={oneShotBundle} basePath="/demo/stars-below-kharad" />
      </MemoryRouter>,
    );

    expect(screen.getByText('One-Shot Mode')).toBeInTheDocument();
    expect(screen.getByTestId('pacing-badge')).toBeInTheDocument();
    expect(screen.getByTestId('scene-count-badge')).toBeInTheDocument();
  });

  it('renders the 4 adventure stages: Hook, Scenes, Climax, and Rewards', () => {
    render(
      <MemoryRouter>
        <OneShotHub bundle={oneShotBundle} basePath="/demo/stars-below-kharad" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Stage 1 · Hook/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 2 · Scenes/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 3 · Climax/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 4 · Rewards & Wrap/i)).toBeInTheDocument();
  });

  it('renders pacing progress bar with segments', () => {
    render(
      <MemoryRouter>
        <OneShotHub bundle={oneShotBundle} basePath="/demo/stars-below-kharad" />
      </MemoryRouter>,
    );

    const progressBar = screen.getByRole('progressbar', {
      name: 'Adventure Pacing Timeline',
    });
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.children.length).toBeGreaterThanOrEqual(3);
  });

  it('allows changing target budget via select dropdown and updates pacing status', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OneShotHub bundle={oneShotBundle} basePath="/demo/stars-below-kharad" />
      </MemoryRouter>,
    );

    const select = screen.getByRole('combobox', {
      name: 'Target Time Budget',
    });
    expect(select).toHaveValue('240');

    // Change to 2 hours (120 minutes) - will likely mark it over budget
    await user.selectOptions(select, '120');
    expect(select).toHaveValue('120');

    expect(screen.getByTestId('pacing-badge').textContent).toContain('2h target');
    expect(screen.getByTestId('pacing-badge').textContent).toContain('Over budget');
  });

  it('calls onExportRunSheet when provided and user clicks export button', async () => {
    const user = userEvent.setup();
    const handleExport = vi.fn();

    render(
      <MemoryRouter>
        <OneShotHub
          bundle={oneShotBundle}
          basePath="/demo/stars-below-kharad"
          onExportRunSheet={handleExport}
        />
      </MemoryRouter>,
    );

    const exportBtn = screen.getByRole('button', {
      name: 'Export One-Shot Run Sheet',
    });
    await user.click(exportBtn);

    expect(handleExport).toHaveBeenCalledTimes(1);
  });

  it('opens RunSheetExportModal internally when onExportRunSheet is not passed', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OneShotHub bundle={oneShotBundle} basePath="/demo/stars-below-kharad" />
      </MemoryRouter>,
    );

    const exportBtn = screen.getByRole('button', {
      name: 'Export One-Shot Run Sheet',
    });
    await user.click(exportBtn);

    expect(
      screen.getByRole('heading', { level: 2, name: /Session Run Sheet Export/i }),
    ).toBeInTheDocument();
  });

  it('renders plan adventure link pointing to sessions path', () => {
    render(
      <MemoryRouter>
        <OneShotHub bundle={oneShotBundle} basePath="/demo/stars-below-kharad" />
      </MemoryRouter>,
    );

    const planLink = screen.getByRole('link', {
      name: 'Plan Adventure in Session View',
    });
    expect(planLink).toHaveAttribute('href', '/demo/stars-below-kharad/sessions');
  });

  it('handles empty session steps gracefully with fallback structure', () => {
    const emptyStepsBundle: CampaignFixtureBundle = {
      ...oneShotBundle,
      sessions: [
        {
          id: 'session-empty',
          number: 1,
          title: 'Empty One-Shot',
          summary: 'A short mission',
          status: 'planned',
          targetDate: '2026-10-25',
          prepStatus: 'draft',
          plan: {
            steps: [],
          },
        },
      ],
    };

    render(
      <MemoryRouter>
        <OneShotHub bundle={emptyStepsBundle} basePath="/demo/stars-below-kharad" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Call to Adventure (The Hook)')).toBeInTheDocument();
    expect(screen.getByText('The Showdown (Climax)')).toBeInTheDocument();
    expect(screen.getByText('Resolution, Treasure & Epilogue')).toBeInTheDocument();
  });
});

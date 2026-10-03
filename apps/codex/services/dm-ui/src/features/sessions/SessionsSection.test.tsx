import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { renderSection } from '@/features/section-shell/testUtils';

import { buildSessionsModel } from './sessionsModels';

const SLUGS = [
  'ashes-of-veyra',
  'crown-of-cinders',
  'lanterns-of-mourningfen',
  'stars-below-kharad',
];

function bundleOf(slug: string) {
  const bundle = getFixtureBundle(slug, 'test');
  if (!bundle) throw new Error(slug);
  return bundle;
}

describe('SessionsSection', () => {
  it.each(SLUGS)('%s renders a timeline and a default detail', (slug) => {
    const model = buildSessionsModel(bundleOf(slug));
    renderSection(`/demo/${slug}/sessions`);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sessions' }),
    ).toBeTruthy();
    const nav = screen.getByRole('navigation', {
      name: `Session ${model.timelineLabel.toLowerCase()}`,
    });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(model.totalCount);
    const current = links.find(
      (link) => link.getAttribute('aria-current') === 'page',
    );
    expect(current?.getAttribute('href')).toContain(
      `/sessions/${model.defaultSessionId}`,
    );
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(
      0,
    );
  });

  it('shows Open run sheet only for sessions with a plan', () => {
    const bundle = bundleOf('ashes-of-veyra');
    const planned = bundle.sessions.find((s) => s.plan);
    const unplanned = bundle.sessions.find((s) => !s.plan);
    expect(planned).toBeTruthy();
    const first = renderSection(`/demo/ashes-of-veyra/sessions/${planned?.id}`);
    const link = screen.getByRole('link', { name: 'Open run sheet' });
    expect(link.getAttribute('href')).toBe(
      `/demo/ashes-of-veyra/sessions/${planned?.id}/plan`,
    );
    first.unmount();
    if (unplanned) {
      renderSection(`/demo/ashes-of-veyra/sessions/${unplanned.id}`);
      expect(screen.queryByRole('link', { name: 'Open run sheet' })).toBeNull();
    }
  });

  it('navigates when a row is clicked', async () => {
    const { user } = renderSection('/demo/ashes-of-veyra/sessions');
    const target = bundleOf('ashes-of-veyra').sessions.find(
      (s) => s.number === 1,
    );
    const nav = screen.getByRole('navigation', { name: /Session/ });
    const row = within(nav)
      .getAllByRole('link')
      .find((l) => l.getAttribute('href')?.endsWith(`/${target?.id}`));
    expect(row).toBeTruthy();
    await user.click(row as HTMLElement);
    expect(screen.getByTestId('location').textContent).toContain(
      `/sessions/${target?.id}`,
    );
  });

  it('shows not found for an unknown session id', () => {
    renderSection('/demo/ashes-of-veyra/sessions/session-nope');
    expect(screen.getByText('Not found in this campaign')).toBeTruthy();
  });

  it('filters by status through the query string', async () => {
    const { user } = renderSection('/demo/ashes-of-veyra/sessions');
    await user.selectOptions(screen.getByLabelText('Status'), 'complete');
    const expected = bundleOf('ashes-of-veyra').sessions.filter(
      (s) => s.status === 'complete',
    ).length;
    const nav = screen.getByRole('navigation', { name: /Session/ });
    expect(within(nav).getAllByRole('link')).toHaveLength(expected);
  });

  it('shows an empty state for a real campaign', () => {
    renderSection('/campaigns/campaign-blank/sessions');
    expect(screen.getByText('No sessions yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plan a session' })).toBeTruthy();
  });

  it('opens SessionPlannerModal when clicking Plan a session header button', async () => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
    }
    const { user } = renderSection('/demo/ashes-of-veyra/sessions');
    const planBtn = screen.getByTestId('plan-session-header-btn');
    await user.click(planBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Plan a Session/)).toBeInTheDocument();
  });

  it('opens SessionPlannerModal pre-filled when clicking Edit plan', async () => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
    }
    const bundle = bundleOf('ashes-of-veyra');
    const sessionWithPlan = bundle.sessions.find((s) => s.plan);
    const { user } = renderSection(`/demo/ashes-of-veyra/sessions/${sessionWithPlan?.id}`);
    const editBtn = screen.getByTestId(`edit-plan-btn-${sessionWithPlan?.id}`);
    await user.click(editBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Plan Session #${sessionWithPlan?.number}`))).toBeInTheDocument();
  });
});

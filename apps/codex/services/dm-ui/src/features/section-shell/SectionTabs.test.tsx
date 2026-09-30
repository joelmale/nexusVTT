import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionTabs } from './SectionTabs';
import { renderInSection } from './testUtils';

const tabs = [
  { id: 'notes', label: 'Notes', count: 3 },
  { id: 'handouts', label: 'Handouts' },
];

function renderTabs(active: string) {
  return renderInSection(
    <SectionTabs
      activeTab={active}
      ariaLabel="Lore sections"
      sectionPath="lore"
      tabs={tabs}
    />,
    { path: `/demo/ashes-of-veyra/lore/${active}` },
  );
}

describe('SectionTabs', () => {
  it('marks the URL tab selected with roving tabindex', () => {
    renderTabs('notes');
    expect(
      screen.getByRole('tablist', { name: 'Lore sections' }),
    ).toBeVisible();
    const notes = screen.getByRole('tab', { name: /Notes/ });
    const handouts = screen.getByRole('tab', { name: 'Handouts' });
    expect(notes).toHaveAttribute('aria-selected', 'true');
    expect(notes).toHaveAttribute('tabindex', '0');
    expect(handouts).toHaveAttribute('aria-selected', 'false');
    expect(handouts).toHaveAttribute('tabindex', '-1');
    expect(handouts).toHaveAttribute(
      'href',
      '/demo/ashes-of-veyra/lore/handouts',
    );
  });

  it('navigates and moves focus with arrow keys', async () => {
    const { user } = renderTabs('notes');
    screen.getByRole('tab', { name: /Notes/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/demo/ashes-of-veyra/lore/handouts',
    );
    expect(screen.getByRole('tab', { name: 'Handouts' })).toHaveFocus();
  });

  it('switches tabs by click', async () => {
    const { user } = renderTabs('notes');
    await user.click(screen.getByRole('tab', { name: 'Handouts' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/demo/ashes-of-veyra/lore/handouts',
    );
  });
});

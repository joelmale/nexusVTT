import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';
import { SectionLayout } from './SectionLayout';
import { renderInSection } from './testUtils';

const detail = (
  <section>
    <h2>Captain Serin Dhal</h2>
  </section>
);

function layout(props: Partial<ComponentProps<typeof SectionLayout>>) {
  return (
    <SectionLayout
      detail={detail}
      list={<p>the list</p>}
      sectionPath="npcs"
      summary={<p>the summary</p>}
      title="NPCs"
      {...props}
    />
  );
}

describe('SectionLayout', () => {
  it('shows list and detail together on wide screens', () => {
    renderInSection(layout({ selectedId: 'npc-captain-serin' }), {
      singlePane: false,
    });
    expect(screen.getByText('the list')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Captain Serin Dhal' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /All NPCs/ })).toBeNull();
  });

  it('shows the summary when nothing is selected', () => {
    renderInSection(layout({}), { singlePane: false });
    expect(screen.getByText('the summary')).toBeInTheDocument();
  });

  it('is single-pane below 1020px: list without id, detail with back link with id', () => {
    const { unmount } = renderInSection(layout({}), { singlePane: true });
    expect(screen.getByText('the list')).toBeInTheDocument();
    expect(screen.queryByText('the summary')).toBeNull();
    unmount();

    renderInSection(layout({ selectedId: 'npc-captain-serin' }), {
      singlePane: true,
    });
    expect(screen.queryByText('the list')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Captain Serin Dhal' }),
    ).toHaveFocus();
    expect(screen.getByRole('link', { name: /All NPCs/ })).toHaveAttribute(
      'href',
      '/demo/ashes-of-veyra/npcs',
    );
  });

  it('replaces the panes with the empty state', () => {
    renderInSection(layout({ empty: <EmptyState title="No NPCs yet." /> }), {
      singlePane: false,
    });
    expect(screen.getByText('No NPCs yet.')).toBeInTheDocument();
    expect(screen.queryByText('the list')).toBeNull();
  });

  it('shows an inline not-found for an unknown id', () => {
    renderInSection(layout({ selectedId: 'nope', notFound: true }), {
      singlePane: false,
    });
    expect(
      screen.getByRole('heading', { name: 'Not found in this campaign' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to NPCs' })).toHaveAttribute(
      'href',
      '/demo/ashes-of-veyra/npcs',
    );
  });

  it('renders the list footer under the list', () => {
    renderInSection(layout({ listFooter: <p>footer</p> }), {
      singlePane: false,
    });
    expect(screen.getByText('footer')).toBeInTheDocument();
  });
});

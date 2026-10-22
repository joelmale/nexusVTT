import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Shield from 'lucide-react/dist/esm/icons/shield';

import { RichEntityRow } from './RichEntityRow';
import { sortByPinned } from './entityMeta';

describe('RichEntityRow', () => {
  it('renders primary title and subtitle correctly', () => {
    render(
      <RichEntityRow
        title="Lord Neverember"
        subtitle="Open Lord of Waterdeep"
      />,
    );

    expect(screen.getByText('Lord Neverember')).toBeInTheDocument();
    expect(screen.getByText('Open Lord of Waterdeep')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <RichEntityRow
        icon={<Shield data-testid="shield-icon" />}
        title="Lords' Alliance"
      />,
    );

    expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
  });

  it('renders meta parts with separator dots', () => {
    render(
      <RichEntityRow
        title="Goblin Ambush"
        metaParts={[
          { key: 'kind', content: 'Combat' },
          { key: 'cr', content: 'CR 1/4' },
          { key: 'xp', content: '50 XP' },
        ]}
      />,
    );

    expect(screen.getByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('CR 1/4')).toBeInTheDocument();
    expect(screen.getByText('50 XP')).toBeInTheDocument();
    expect(screen.getAllByText('·')).toHaveLength(2);
  });

  it('renders badges when provided', () => {
    render(
      <RichEntityRow
        title="Rescue the Blacksmith"
        badges={<span data-testid="badge">In Progress</span>}
      />,
    );

    expect(screen.getByTestId('badge')).toHaveLength
      ? undefined
      : expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders a static pin indicator when isPinned is true and no onTogglePin is passed', () => {
    render(
      <RichEntityRow
        title="Pinned Item"
        isPinned={true}
      />,
    );

    const pinIndicator = screen.getByLabelText('Pinned');
    expect(pinIndicator).toBeInTheDocument();
    expect(screen.getByText('Pinned Item').closest('[data-pinned="true"]')).not.toBeNull();
  });

  it('renders interactive pin button and triggers onTogglePin on click', () => {
    const handleToggle = vi.fn();
    render(
      <RichEntityRow
        title="Important Quest"
        isPinned={false}
        onTogglePin={handleToggle}
      />,
    );

    const pinBtn = screen.getByRole('button', { name: 'Pin item to top' });
    expect(pinBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pinBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders interactive pin button when already pinned with proper aria-label', () => {
    const handleToggle = vi.fn();
    render(
      <RichEntityRow
        title="Important Quest"
        isPinned={true}
        onTogglePin={handleToggle}
      />,
    );

    const pinBtn = screen.getByRole('button', { name: 'Unpin item' });
    expect(pinBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(pinBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('applies veiled class when veiled prop is true', () => {
    const { container } = render(
      <RichEntityRow
        title="Secret Treason"
        veiled={true}
      />,
    );

    const row = container.firstChild as HTMLElement;
    expect(row.className).toMatch(/veiled/);
  });
});

describe('sortByPinned', () => {
  it('returns original array when pinnedIds is empty or undefined', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(sortByPinned(items, (item) => item.id)).toEqual(items);
    expect(sortByPinned(items, (item) => item.id, [])).toEqual(items);
  });

  it('places pinned items at the top while preserving relative ordering', () => {
    const items = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
      { id: '4', name: 'Delta' },
    ];
    const pinnedIds = ['3', '1'];

    const sorted = sortByPinned(items, (item) => item.id, pinnedIds);
    expect(sorted.map((item) => item.id)).toEqual(['1', '3', '2', '4']);
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PropPanel } from '@/components/Props/PropPanel';
import type { Prop } from '@/types/prop';

const mockProps: Prop[] = [
  {
    id: 'prop-1',
    name: 'Wooden Chair',
    category: 'furniture',
    image: '/assets/chair.png',
    size: 'small',
    tags: ['seat', 'wood'],
  },
  {
    id: 'prop-2',
    name: 'Gold Chest',
    category: 'treasure',
    image: '/assets/chest.png',
    size: 'medium',
    tags: ['loot', 'storage'],
  },
  {
    id: 'prop-3',
    name: 'Oak Door',
    category: 'door',
    image: '/assets/door.png',
    size: 'medium',
    tags: ['portal', 'wood'],
  },
];

let mockIsHost = true;
const mockGetAllProps = vi.fn(() => mockProps);

vi.mock('@/services/propAssets', () => ({
  usePropAssets: () => ({
    getAllProps: mockGetAllProps,
  }),
}));

vi.mock('@/stores/gameStore', () => ({
  useIsHost: () => mockIsHost,
}));

vi.mock('@/utils/safeUrl', () => ({
  safeImageUrl: (url: string) => url,
}));

vi.mock('@/components/Props/PropCreationPanel', () => ({
  PropCreationPanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="prop-creation-panel">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

describe('PropPanel component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsHost = true;
    mockGetAllProps.mockReturnValue(mockProps);
    localStorage.clear();
  });

  it('renders header, categories, and prop cards', () => {
    render(<PropPanel />);

    expect(screen.getByText('🎭 Props')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search props...')).toBeInTheDocument();
    expect(screen.getByText('Wooden Chair')).toBeInTheDocument();
    expect(screen.getByText('Gold Chest')).toBeInTheDocument();
    expect(screen.getByText('Oak Door')).toBeInTheDocument();
    expect(screen.getByText(/3 props/i)).toBeInTheDocument();
  });

  it('filters props when category tab is selected', () => {
    render(<PropPanel />);

    const treasureTab = screen.getByRole('button', { name: /treasure/i });
    fireEvent.click(treasureTab);

    expect(screen.getByText('Gold Chest')).toBeInTheDocument();
    expect(screen.queryByText('Wooden Chair')).not.toBeInTheDocument();
    expect(screen.queryByText('Oak Door')).not.toBeInTheDocument();
    expect(screen.getByText(/1 prop •/i)).toBeInTheDocument();
  });

  it('filters props based on search query', async () => {
    render(<PropPanel />);

    const searchInput = screen.getByPlaceholderText('Search props...');
    fireEvent.change(searchInput, { target: { value: 'seat' } });

    await waitFor(() => {
      expect(screen.getByText('Wooden Chair')).toBeInTheDocument();
      expect(screen.queryByText('Gold Chest')).not.toBeInTheDocument();
      expect(screen.queryByText('Oak Door')).not.toBeInTheDocument();
    });
  });

  it('invokes onPropSelect when a prop is clicked', () => {
    const handleSelect = vi.fn();
    render(<PropPanel onPropSelect={handleSelect} />);

    fireEvent.click(screen.getByText('Gold Chest'));
    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(mockProps[1]);
  });

  it('sets dataTransfer on drag start', () => {
    render(<PropPanel />);

    const chairElement = screen.getByText('Wooden Chair').closest('div')!;
    const setData = vi.fn();
    fireEvent.dragStart(chairElement, {
      dataTransfer: {
        setData,
        effectAllowed: '',
      },
    });

    expect(setData).toHaveBeenCalledWith(
      'application/prop',
      JSON.stringify(mockProps[0]),
    );
  });

  it('shows host action buttons when isHost is true and toggles modal', () => {
    render(<PropPanel />);

    const addBtn = screen.getByRole('button', { name: '+ Add Prop' });
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn);
    expect(screen.getByTestId('prop-creation-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Modal'));
    expect(screen.queryByTestId('prop-creation-panel')).not.toBeInTheDocument();
  });

  it('hides host buttons when isHost is false', () => {
    mockIsHost = false;
    render(<PropPanel />);

    expect(screen.queryByRole('button', { name: '+ Add Prop' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('renders "Load More..." button when items exceed 40', () => {
    const manyProps: Prop[] = Array.from({ length: 45 }, (_, i) => ({
      id: `prop-${i}`,
      name: `Prop ${i}`,
      category: 'furniture',
      image: `/assets/prop-${i}.png`,
    }));
    mockGetAllProps.mockReturnValue(manyProps);

    render(<PropPanel />);

    expect(screen.getByText('Load More...')).toBeInTheDocument();
    expect(screen.getByText('Prop 39')).toBeInTheDocument();
    expect(screen.queryByText('Prop 40')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Load More...'));
    expect(screen.getByText('Prop 40')).toBeInTheDocument();
    expect(screen.queryByText('Load More...')).not.toBeInTheDocument();
  });
});

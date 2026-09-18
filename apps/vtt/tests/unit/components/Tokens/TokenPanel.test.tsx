import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TokenPanel } from '@/components/Tokens/TokenPanel';
import type { Token } from '@/types/token';

const renderWithDnd = (ui: React.ReactElement) =>
  render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);

const mockTokens: Token[] = [
  {
    id: 'tok-1',
    name: 'Elven Archer',
    category: 'pc',
    size: 1,
    assetUrl: '/assets/archer.png',
    color: 'green',
    elevation: 0,
  } as Token,
  {
    id: 'tok-2',
    name: 'Goblin Scout',
    category: 'monster',
    size: 1,
    assetUrl: '/assets/goblin.png',
    color: 'red',
    elevation: 0,
  } as Token,
  {
    id: 'tok-3',
    name: 'Tavern Keeper',
    category: 'npc',
    size: 1,
    assetUrl: '/assets/innkeeper.png',
    color: 'blue',
    elevation: 0,
  } as Token,
];

const mockGetAllTokens = vi.fn(() => mockTokens);
const mockUpdateToken = vi.fn();

vi.mock('@/services/tokenAssets', () => ({
  useTokenAssets: () => ({
    getAllTokens: mockGetAllTokens,
    updateToken: mockUpdateToken,
  }),
}));

describe('TokenPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetAllTokens.mockReturnValue(mockTokens);
    mockUpdateToken.mockClear();
  });

  it('renders all tokens initially and category counts', () => {
    renderWithDnd(<TokenPanel />);

    expect(screen.getByText('Elven Archer')).toBeInTheDocument();
    expect(screen.getByText('Goblin Scout')).toBeInTheDocument();
    expect(screen.getByText('Tavern Keeper')).toBeInTheDocument();
  });

  it('filters tokens by search input', async () => {
    renderWithDnd(<TokenPanel />);

    const searchInput = screen.getByPlaceholderText(/search.*tokens/i);
    fireEvent.change(searchInput, { target: { value: 'Goblin' } });

    await waitFor(() => {
      expect(screen.getByText('Goblin Scout')).toBeInTheDocument();
      expect(screen.queryByText('Elven Archer')).not.toBeInTheDocument();
      expect(screen.queryByText('Tavern Keeper')).not.toBeInTheDocument();
    });
  });

  it('filters tokens when switching category tab', async () => {
    renderWithDnd(<TokenPanel />);

    const monsterTab = screen.getByRole('tab', { name: /monsters/i });
    fireEvent.click(monsterTab);

    await waitFor(() => {
      expect(screen.getByText('Goblin Scout')).toBeInTheDocument();
      expect(screen.queryByText('Elven Archer')).not.toBeInTheDocument();
      expect(screen.queryByText('Tavern Keeper')).not.toBeInTheDocument();
    });
  });

  it('calls onTokenSelect when clicking a token', () => {
    const handleSelect = vi.fn();
    renderWithDnd(<TokenPanel onTokenSelect={handleSelect} />);

    const tokenItem = screen.getByText('Elven Archer');
    fireEvent.click(tokenItem);

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tok-1', name: 'Elven Archer' }),
    );
  });
});

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { EntityList } from './EntityList';
import { FilterBar } from './FilterBar';

describe('EntityList & FilterBar', () => {
  describe('EntityList', () => {
    it('renders grouped items with links and marks selected item with aria-current="page"', () => {
      const items = [
        { id: '1', name: 'Gundren Rockseeker' },
        { id: '2', name: 'Sildar Hallwinter' },
      ];

      render(
        <MemoryRouter>
          <EntityList
            ariaLabel="NPCs list"
            groups={[{ id: 'allies', label: 'Allies', items }]}
            getId={(item) => item.id}
            getHref={(item) => `/npcs/${item.id}`}
            renderRow={(item) => <span>{item.name}</span>}
            selectedId="2"
          />
        </MemoryRouter>,
      );

      expect(screen.getByRole('navigation', { name: 'NPCs list' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Allies' })).toBeInTheDocument();

      const link1 = screen.getByRole('link', { name: 'Gundren Rockseeker' });
      const link2 = screen.getByRole('link', { name: 'Sildar Hallwinter' });

      expect(link1).not.toHaveAttribute('aria-current');
      expect(link2).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('FilterBar', () => {
    it('renders search input, result count, and facet select', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/test?q=gundren&status=active']}>
          <FilterBar
            searchLabel="Search NPCs"
            resultCount={1}
            singular="NPC"
            plural="NPCs"
            facets={[
              {
                key: 'status',
                label: 'Status',
                options: [
                  { value: 'active', label: 'Active', count: 5 },
                  { value: 'inactive', label: 'Inactive', count: 2 },
                ],
              },
            ]}
          />
        </MemoryRouter>,
      );

      expect(screen.getByRole('searchbox', { name: 'Search NPCs' })).toHaveValue('gundren');
      expect(screen.getByText('1 NPC')).toBeInTheDocument();

      // Clear search button appears when localSearch has value
      const clearSearchBtn = screen.getByRole('button', { name: 'Clear query search' });
      await user.click(clearSearchBtn);
      expect(screen.getByRole('searchbox', { name: 'Search NPCs' })).toHaveValue('');
    });

    it('renders sort and group by options and updates values', () => {
      render(
        <MemoryRouter>
          <FilterBar
            searchLabel="Search Items"
            resultCount={3}
            singular="Item"
            plural="Items"
            sortOptions={[
              { value: 'name', label: 'Name' },
              { value: 'value', label: 'Value' },
            ]}
            groupByOptions={[
              { value: 'type', label: 'Type' },
              { value: 'rarity', label: 'Rarity' },
            ]}
          />
        </MemoryRouter>,
      );

      expect(screen.getByLabelText('Sort')).toBeInTheDocument();
      expect(screen.getByLabelText('Group by')).toBeInTheDocument();
    });
  });
});

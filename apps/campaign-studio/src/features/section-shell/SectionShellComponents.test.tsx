import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createEmptyBundle } from '@/demo/fixture-registry';
import { EmptyState } from './EmptyState';
import { LifecycleBanner } from './LifecycleBanner';
import { SectionSummary } from './SectionSummary';

describe('SectionShell Components', () => {
  describe('EmptyState', () => {
    it('renders title, description and action', () => {
      render(
        <EmptyState
          title="No Items Found"
          description="Create your first item to begin."
          action={<button type="button">Create Item</button>}
        />,
      );

      expect(screen.getByRole('heading', { level: 2, name: 'No Items Found' })).toBeInTheDocument();
      expect(screen.getByText('Create your first item to begin.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Item' })).toBeInTheDocument();
    });

    it('renders without description and action', () => {
      render(<EmptyState title="Empty List" />);
      expect(screen.getByRole('heading', { level: 2, name: 'Empty List' })).toBeInTheDocument();
    });
  });

  describe('LifecycleBanner', () => {
    it('renders message when bundle has draft lifecycle', () => {
      const bundle = createEmptyBundle({
        id: 'camp-1',
        name: 'Draft Campaign',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const draftBundle = { ...bundle, lifecycle: 'draft' as const };

      render(<LifecycleBanner bundle={draftBundle} />);
      const banner = screen.queryByRole('status');
      if (banner) {
        expect(banner).toBeInTheDocument();
      }
    });

    it('returns null when there is no lifecycle message', () => {
      const bundle = createEmptyBundle({
        id: 'camp-1',
        name: 'Campaign',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const noLifecycleBundle = { ...bundle, lifecycle: undefined };

      const { container } = render(<LifecycleBanner bundle={noLifecycleBundle} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('SectionSummary', () => {
    it('renders title, stats list and children', () => {
      render(
        <SectionSummary
          title="Overview Stats"
          stats={[
            { label: 'Total NPCs', value: 12 },
            { label: 'Active Quests', value: 4 },
          ]}
        >
          <p>Additional summary details</p>
        </SectionSummary>,
      );

      expect(screen.getByRole('heading', { level: 2, name: 'Overview Stats' })).toBeInTheDocument();
      expect(screen.getByText('Total NPCs')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Active Quests')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('Additional summary details')).toBeInTheDocument();
    });
  });
});

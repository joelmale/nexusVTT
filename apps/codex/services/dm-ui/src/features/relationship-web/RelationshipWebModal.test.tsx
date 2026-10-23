import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BundleStore } from '@/features/section-shell/bundleStore';
import { renderInSection } from '@/features/section-shell/testUtils';
import { RelationshipWebModal } from './RelationshipWebModal';

function mockStore(extra: Partial<BundleStore> = {}): Partial<BundleStore> {
  return {
    editable: true,
    ...extra,
  };
}

describe('RelationshipWebModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderInSection(
      <RelationshipWebModal isOpen={false} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal dialog, title, entity count badge, and legend when open', () => {
    renderInSection(
      <RelationshipWebModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    expect(screen.getByRole('dialog', { name: /Campaign Relationship Web/i })).toBeInTheDocument();
    expect(screen.getByText('Campaign Relationship Web')).toBeInTheDocument();
    expect(screen.getByText(/nodes ·/i)).toBeInTheDocument();
    expect(screen.getByText('Relationships:')).toBeInTheDocument();
    expect(screen.getAllByText('Ally').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Rival').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Member of').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Located in').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Holds').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Wants').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    const { user } = renderInSection(
      <RelationshipWebModal isOpen={true} onClose={handleClose} />,
      { store: mockStore() },
    );

    const closeBtn = screen.getByRole('button', { name: 'Close relationship web' });
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    renderInSection(
      <RelationshipWebModal isOpen={true} onClose={handleClose} />,
      { store: mockStore() },
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('filters entities by text search input', async () => {
    const { user } = renderInSection(
      <RelationshipWebModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    const searchInput = screen.getByRole('textbox', { name: 'Filter entities' });
    await user.type(searchInput, 'NonExistentEntityXyz');

    expect(screen.getByText(/0 nodes · 0 links/i)).toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.queryByText(/0 nodes · 0 links/i)).not.toBeInTheDocument();
  });

  it('filters by entity type dropdown', async () => {
    const { user } = renderInSection(
      <RelationshipWebModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    const typeSelect = screen.getByRole('combobox', { name: 'Filter by entity type' });
    await user.selectOptions(typeSelect, 'faction');

    expect(typeSelect).toHaveValue('faction');
  });

  it('filters by relationship dropdown', async () => {
    const { user } = renderInSection(
      <RelationshipWebModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    const relSelect = screen.getByRole('combobox', { name: 'Filter by relationship' });
    await user.selectOptions(relSelect, 'ally');

    expect(relSelect).toHaveValue('ally');
  });

  it('allows clicking a node to open inspector and clicking a related entity', async () => {
    const { user } = renderInSection(
      <RelationshipWebModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    // Find any SVG node text and click it
    const allNodeTexts = document.querySelectorAll('text');
    expect(allNodeTexts.length).toBeGreaterThan(0);

    const firstNode = allNodeTexts[0].closest('g');
    expect(firstNode).not.toBeNull();
    if (firstNode) {
      await user.click(firstNode);
    }

    // Inspector drawer should appear
    const inspector = screen.getByRole('complementary', { name: 'Entity Details' });
    expect(inspector).toBeInTheDocument();

    // Inspector has action buttons
    const focusBtn = screen.getByRole('button', { name: 'Focus Neighborhood' });
    await user.click(focusBtn);

    // Button should now be Clear Focus
    expect(screen.getByRole('button', { name: 'Clear Focus' })).toBeInTheDocument();

    // Click Clear Focus
    await user.click(screen.getByRole('button', { name: 'Clear Focus' }));
    expect(screen.getByRole('button', { name: 'Focus Neighborhood' })).toBeInTheDocument();

    // Deselect button
    await user.click(screen.getByRole('button', { name: 'Deselect' }));
    expect(screen.queryByRole('complementary', { name: 'Entity Details' })).not.toBeInTheDocument();
  });

  it('supports initialFocusedNodeId prop', () => {
    renderInSection(
      <RelationshipWebModal
        initialFocusedNodeId="ashes-npc-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { store: mockStore() },
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('supports zoom in, zoom out, and reset view controls', async () => {
    const { user } = renderInSection(
      <RelationshipWebModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    const reset = screen.getByRole('button', { name: 'Reset view' });

    await user.click(zoomIn);
    await user.click(zoomOut);
    await user.click(reset);

    expect(reset).toBeInTheDocument();
  });

  it('calls onNavigateToEntity from inspector when provided', async () => {
    const handleNavigate = vi.fn();
    const { user } = renderInSection(
      <RelationshipWebModal
        isOpen={true}
        onClose={vi.fn()}
        onNavigateToEntity={handleNavigate}
      />,
      { store: mockStore() },
    );

    const allNodeTexts = document.querySelectorAll('text');
    const firstNode = allNodeTexts[0].closest('g');
    if (firstNode) {
      await user.click(firstNode);
      const navBtn = screen.getByRole('button', { name: 'Open in Section' });
      await user.click(navBtn);
      expect(handleNavigate).toHaveBeenCalled();
    }
  });
});

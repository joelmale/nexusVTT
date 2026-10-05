import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import type { Document } from '@/services/documentService';

// Mock DocumentViewer lazy component
vi.mock('@/components/DocumentViewer', () => ({
  DocumentViewer: () => <div data-testid="document-viewer">Mock Document Viewer</div>,
}));

// Mock EntityStatCard
vi.mock('@/components/Dashboard/molecules/EntityStatCard', () => ({
  EntityStatCard: ({ type, data }: { type: string; data: unknown }) => (
    <div data-testid={`entity-stat-card-${type}`}>{JSON.stringify(data)}</div>
  ),
}));

// Mock mapSrdEntity
vi.mock('@/utils/srdEntity', () => ({
  mapSrdEntity: vi.fn((type: string, data: unknown) => ({
    name: 'Mapped Entity',
    type,
    raw: data,
  })),
}));

const mockLoadDocuments = vi.fn();
const mockSetFilters = vi.fn();
const mockQuickSearch = vi.fn();
const mockClearSearch = vi.fn();
const mockOpenDocument = vi.fn();
const mockLoadStructuredDataForDocument = vi.fn();

let mockStoreState = {
  documents: [] as Document[],
  isLoadingDocuments: false,
  quickSearchResults: [] as Array<{
    documentId: string;
    title: string;
    snippet: string;
    type: string;
    score: number;
    tags: string[];
    matches: Array<{ field: string; snippet: string }>;
  }>,
  isSearching: false,
  loadDocuments: mockLoadDocuments,
  setFilters: mockSetFilters,
  quickSearch: mockQuickSearch,
  clearSearch: mockClearSearch,
  openDocument: mockOpenDocument,
  structuredEntities: {} as Record<string, Array<{ id: string; type: string; name: string; data: Record<string, unknown> }>>,
  loadStructuredDataForDocument: mockLoadStructuredDataForDocument,
};

let mockSession: { campaignId?: string } | null = { campaignId: 'campaign-123' };

vi.mock('@/stores/documentStore', () => ({
  useDocumentStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

vi.mock('@/stores/gameStore', () => ({
  useGameStore: (selector: (state: { session: typeof mockSession }) => unknown) =>
    selector({ session: mockSession }),
}));

describe('DocumentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { campaignId: 'campaign-123' };
    mockStoreState = {
      documents: [],
      isLoadingDocuments: false,
      quickSearchResults: [],
      isSearching: false,
      loadDocuments: mockLoadDocuments,
      setFilters: mockSetFilters,
      quickSearch: mockQuickSearch,
      clearSearch: mockClearSearch,
      openDocument: mockOpenDocument,
      structuredEntities: {},
      loadStructuredDataForDocument: mockLoadStructuredDataForDocument,
    };
  });

  it('renders the documents header and description', async () => {
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });
    expect(screen.getByText('📚 Documents')).toBeInTheDocument();
    expect(
      screen.getByText('Quick reference for your campaign'),
    ).toBeInTheDocument();
  });

  it('renders type filter dropdown with All Types and all document options', async () => {
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', {
      name: /filter documents by type/i,
    });
    expect(select).toBeInTheDocument();
    expect(select).toHaveClass('type-filter-select');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(7);
    expect(options[0]).toHaveTextContent('All Types');
    expect(options[0]).toHaveValue('');
    expect(options[1]).toHaveTextContent('📕 Rulebooks');
    expect(options[1]).toHaveValue('rulebook');
    expect(options[2]).toHaveTextContent('📄 Handouts');
    expect(options[2]).toHaveValue('handout');
    expect(options[3]).toHaveTextContent('📝 Campaign Notes');
    expect(options[3]).toHaveValue('campaign_note');
    expect(options[4]).toHaveTextContent('🗺️ Maps');
    expect(options[4]).toHaveValue('map');
    expect(options[5]).toHaveTextContent('⚔️ Character Sheets');
    expect(options[5]).toHaveValue('character_sheet');
    expect(options[6]).toHaveTextContent('🔮 Homebrew');
    expect(options[6]).toHaveValue('homebrew');
  });

  it('triggers setFilters when a type option is selected', async () => {
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', {
      name: /filter documents by type/i,
    });

    fireEvent.change(select, { target: { value: 'rulebook' } });
    expect(mockSetFilters).toHaveBeenCalledWith({ type: 'rulebook' });

    fireEvent.change(select, { target: { value: '' } });
    expect(mockSetFilters).toHaveBeenCalledWith({ type: undefined });
  });

  it('handles search query changes and clearing', async () => {
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /search rulebooks, handouts/i,
    );
    expect(searchInput).toHaveClass('search-input');

    // Typing less than 2 characters clears search
    fireEvent.change(searchInput, { target: { value: 'a' } });
    expect(mockClearSearch).toHaveBeenCalled();

    // Typing 2+ characters triggers quickSearch
    fireEvent.change(searchInput, { target: { value: 'fireball' } });
    expect(mockQuickSearch).toHaveBeenCalledWith('fireball', 'campaign-123');

    // Clear search button appears and resets input
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(mockClearSearch).toHaveBeenCalled();
    expect(searchInput).toHaveValue('');
  });

  it('loads documents on mount and sets campaign filter when session exists', async () => {
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });
    expect(mockSetFilters).toHaveBeenCalledWith({ campaign: 'campaign-123' });
    expect(mockLoadDocuments).toHaveBeenCalled();
  });

  it('renders loading state when loading documents', async () => {
    mockStoreState.isLoadingDocuments = true;
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state when no documents are found', async () => {
    mockStoreState.documents = [];
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });
    expect(screen.getByText('No documents available')).toBeInTheDocument();
    expect(
      screen.getByText('Upload documents from the Dashboard'),
    ).toBeInTheDocument();
  });

  it('renders document items and handles document click', async () => {
    const doc: Document = {
      id: 'doc-1',
      title: 'Player Handbook',
      description: 'Core rules for 5e',
      type: 'rulebook',
      tags: ['rules', 'core', 'phb'],
      campaignId: 'campaign-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileUrl: '/uploads/phb.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      userId: 'user-1',
    };

    mockStoreState.documents = [doc];
    render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    expect(screen.getByText('Player Handbook')).toBeInTheDocument();
    expect(screen.getByText('Core rules for 5e')).toBeInTheDocument();
    expect(screen.getByText('rules')).toBeInTheDocument();
    expect(screen.getByText('core')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument(); // +1 tag overflow
    expect(screen.getByText('1 document')).toBeInTheDocument();

    const item = screen.getByText('Player Handbook');
    fireEvent.click(item);
    expect(mockOpenDocument).toHaveBeenCalledWith('doc-1');
  });

  it('handles SRD content documents toggle and expansion', async () => {
    const srdDoc: Document = {
      id: 'srd-spell-1',
      title: 'Fireball',
      description: '3rd level evocation',
      type: 'srd_content',
      tags: ['spell'],
      campaignId: 'campaign-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileUrl: '',
      fileSize: 0,
      mimeType: 'text/markdown',
      userId: 'system',
    };

    mockStoreState.documents = [srdDoc];
    mockStoreState.structuredEntities = {
      'srd-spell-1': [
        {
          id: 'ent-1',
          type: 'spell',
          name: 'Fireball',
          data: { level: 3, school: 'Evocation' },
        },
      ],
    };

    const { rerender } = render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    const item = screen.getByText('Fireball');
    fireEvent.click(item);
    expect(mockLoadStructuredDataForDocument).toHaveBeenCalledWith(
      'srd-spell-1',
    );

    rerender(<DocumentsPanel />);
    expect(screen.getByTestId('entity-stat-card-spell')).toBeInTheDocument();

    // Clicking again collapses it
    fireEvent.click(item);
    rerender(<DocumentsPanel />);
    expect(
      screen.queryByTestId('entity-stat-card-spell'),
    ).not.toBeInTheDocument();
  });

  it('renders quick search results and handles quick result item expansion with fallback text', async () => {
    mockStoreState.quickSearchResults = [
      {
        documentId: 'srd-monster-1',
        title: 'Goblin',
        snippet: 'Small humanoid with sharp teeth',
        type: 'srd_content',
        score: 0.95,
        tags: ['monster'],
        matches: [{ field: 'title', snippet: 'Goblin' }],
      },
    ];

    const { rerender } = render(<DocumentsPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('document-viewer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /search rulebooks, handouts/i,
    );
    fireEvent.change(searchInput, { target: { value: 'goblin' } });

    expect(screen.getByText('Quick Results')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(
      screen.getByText('Small humanoid with sharp teeth'),
    ).toBeInTheDocument();

    // Click quick result to expand
    const resultItem = screen.getByText('Goblin');
    fireEvent.click(resultItem);
    expect(mockLoadStructuredDataForDocument).toHaveBeenCalledWith(
      'srd-monster-1',
    );

    // Shows fallback when structured entity has not finished loading
    expect(
      screen.getByText('Reading archives transcripts...'),
    ).toBeInTheDocument();

    // When structured entity data is available
    mockStoreState.structuredEntities = {
      'srd-monster-1': [
        {
          id: 'ent-goblin',
          type: 'monster',
          name: 'Goblin',
          data: { cr: '1/4', hp: 7 },
        },
      ],
    };

    rerender(<DocumentsPanel />);
    expect(
      screen.getByTestId('entity-stat-card-monster'),
    ).toBeInTheDocument();
  });
});
